import diff from 'deep-diff'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { fixTeam } from '#libs-shared'
import { is_main, report_job, update_play } from '#libs-server'
import { get_game_play_by_play } from '#libs-server/sportradar/sportradar-api.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'
import {
  preload_plays,
  find_play,
  get_cache_stats,
  MultiplePlayMatchError
} from '#libs-server/play-cache.mjs'
import {
  preload_active_players,
  find_player
} from '#libs-server/player-cache.mjs'
import transform_play_route from '#libs-server/transform-play-route.mjs'

// Import refactored modules
import {
  map_play_type,
  transform_qb_position,
  transform_hash_position,
  transform_run_gap,
  transform_pocket_location,
  parse_clock_to_seconds,
  calculate_time_remaining,
  parse_yardline,
  normalize_drive_duration
} from '#libs-server/sportradar/sportradar-transforms.mjs'

import {
  map_passing_stats,
  map_receiving_stats,
  map_rushing_stats,
  map_field_goal_stats,
  map_punt_stats,
  map_kickoff_stats,
  map_return_stats,
  map_penalty_stats,
  map_play_details
} from '#libs-server/sportradar/sportradar-stats-mappers.mjs'

import {
  print_import_summary,
  print_dry_mode_comparison,
  print_collision_summary,
  should_track_collision
} from '#libs-server/sportradar/sportradar-reporting.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-plays-sportradar')
debug.enable('import-plays-sportradar,sportradar')

const load_team_mappings = async () => {
  const config_row = await db('config')
    .where({ key: 'sportradar_team_mappings' })
    .first()

  if (!config_row || !config_row.value) {
    log('No team mappings found in config table')
    return new Map()
  }

  const team_mappings = new Map(Object.entries(config_row.value))
  log(`Loaded ${team_mappings.size} team mappings`)
  return team_mappings
}

const get_team_abbreviation = ({
  sportradar_team_id,
  sportradar_alias,
  team_mappings_cache
}) => {
  if (sportradar_team_id && team_mappings_cache.has(sportradar_team_id)) {
    return team_mappings_cache.get(sportradar_team_id).abbrev
  }
  return sportradar_alias ? fixTeam(sportradar_alias) : null
}

const resolve_player_id = async ({
  sportradar_player_id,
  player_name,
  team_abbrev
}) => {
  if (!sportradar_player_id) return null

  const db_player = await db('player')
    .where({ sportradar_id: sportradar_player_id })
    .first()

  if (db_player) {
    return {
      pid: db_player.pid,
      gsisid: db_player.gsisid,
      sportradar_id: sportradar_player_id
    }
  }

  if (player_name && team_abbrev) {
    const cached_player = find_player({
      name: player_name,
      teams: [team_abbrev],
      ignore_free_agent: false,
      ignore_retired: false
    })

    if (cached_player) {
      return {
        pid: cached_player.pid,
        gsisid: cached_player.gsisid,
        sportradar_id: sportradar_player_id
      }
    }
  }

  log(
    `Player not found: ${player_name || 'unknown'} (${sportradar_player_id}) - ${team_abbrev || 'unknown team'}`
  )
  return null
}

const set_boolean_if_defined = (mapped, source, source_key, target_key) => {
  if (source[source_key] === true) {
    mapped[target_key] = true
  } else if (source[source_key] === false) {
    mapped[target_key] = false
  }
}

const set_if_defined = (mapped, source, source_key, target_key) => {
  if (source[source_key] !== null && source[source_key] !== undefined) {
    mapped[target_key || source_key] = source[source_key]
  }
}

const map_basic_play_data = ({
  sportradar_play: play,
  game_context,
  drive_context
}) => {
  const mapped = {
    sportradar_game_id: game_context.sportradar_game_id,
    sportradar_play_id: play.id,
    sportradar_drive_id: drive_context.id,
    sportradar_play_type: play.play_type,
    qtr: game_context.period_number
  }

  if (play.wall_clock) {
    mapped.wall_clock = new Date(play.wall_clock)
  }

  if (play.start_situation) {
    const { down, yfd } = play.start_situation
    mapped.dwn = down && down !== 0 ? down : null
    mapped.yards_to_go = yfd && yfd !== 0 ? yfd : null
  }

  set_if_defined(mapped, play, 'sequence')

  if (play.play_type) {
    mapped.play_type = map_play_type(play.play_type)
  }

  set_boolean_if_defined(mapped, play, 'kneel_down', 'qb_kneel')
  set_boolean_if_defined(mapped, play, 'spike', 'qb_spike')

  return mapped
}

const map_contextual_data = ({
  sportradar_play: play,
  game_context,
  team_mappings_cache
}) => {
  const mapped = {}

  // Time data
  if (play.clock) {
    mapped.game_clock_start = play.clock
    const sec_rem_qtr = parse_clock_to_seconds(play.clock)
    Object.assign(
      mapped,
      calculate_time_remaining(game_context.period_number, sec_rem_qtr)
    )
  }

  // Team data
  if (play.start_situation?.possession) {
    const pos_team = get_team_abbreviation({
      sportradar_team_id: play.start_situation.possession.id,
      sportradar_alias: play.start_situation.possession.alias,
      team_mappings_cache
    })
    mapped.pos_team = pos_team
    mapped.off = pos_team
    mapped.def =
      pos_team === game_context.home_team
        ? game_context.away_team
        : game_context.home_team
  }

  // Field position
  if (play.start_situation?.location && mapped.pos_team) {
    const start_ydl = parse_yardline(
      play.start_situation.location,
      mapped.pos_team
    )
    Object.assign(mapped, {
      ydl_side: start_ydl.ydl_side,
      ydl_num: start_ydl.ydl_num,
      ydl_100: start_ydl.ydl_100,
      ydl_start: start_ydl.ydl_str
    })
  }

  if (play.end_situation?.location && mapped.pos_team) {
    const end_ydl = parse_yardline(play.end_situation.location, mapped.pos_team)
    mapped.ydl_end = end_ydl.ydl_str
  }

  // Score
  set_if_defined(mapped, play, 'home_points', 'home_score')
  set_if_defined(mapped, play, 'away_points', 'away_score')

  return mapped
}

const map_formation_data = ({ sportradar_play: play }) => {
  const mapped = {}

  if (play.qb_at_snap) {
    mapped.qb_position = transform_qb_position(play.qb_at_snap)
  }
  if (play.hash_mark) {
    mapped.starting_hash = transform_hash_position(play.hash_mark)
  }
  if (play.running_lane !== null && play.running_lane !== undefined) {
    mapped.run_gap = transform_run_gap(play.running_lane)
  }
  if (play.pocket_location) {
    mapped.pocket_location = transform_pocket_location(play.pocket_location)
  }
  if (play.pass_route) {
    mapped.route = transform_play_route(play.pass_route)
  }

  set_boolean_if_defined(mapped, play, 'play_action', 'play_action')
  set_boolean_if_defined(mapped, play, 'screen_pass', 'screen_pass')
  set_boolean_if_defined(mapped, play, 'run_pass_option', 'run_play_option')
  set_boolean_if_defined(mapped, play, 'fake_punt', 'fake_punt')
  set_boolean_if_defined(mapped, play, 'fake_field_goal', 'fake_field_goal')

  if (play.huddle === 'No Huddle') {
    mapped.no_huddle = true
  } else if (play.huddle === 'Huddle') {
    mapped.no_huddle = false
  }

  set_if_defined(mapped, play, 'men_in_box', 'box_defenders')
  set_if_defined(mapped, play, 'players_rushed', 'pass_rushers')
  set_if_defined(mapped, play, 'blitz')
  set_if_defined(mapped, play, 'left_tightends')
  set_if_defined(mapped, play, 'right_tightends')

  return mapped
}

const map_drive_data = ({ drive_context }) => {
  if (!drive_context) return {}

  const mapped = {
    drive_seq: drive_context.sequence,
    drive_play_count: drive_context.play_count,
    drive_top: normalize_drive_duration(drive_context.duration),
    drive_yds: drive_context.gain,
    drive_fds: drive_context.first_downs,
    drive_yds_penalized: drive_context.penalty_yards
  }

  if (drive_context.start_reason) {
    mapped.drive_start_transition = drive_context.start_reason
      .toUpperCase()
      .replace(/ /g, '_')
  }
  if (drive_context.end_reason) {
    mapped.drive_end_transition = drive_context.end_reason
      .toUpperCase()
      .replace(/ /g, '_')
  }

  return mapped
}

const build_match_criteria = (game_esbid, mapped_play) => {
  const criteria = {
    esbid: game_esbid,
    qtr: mapped_play.qtr,
    dwn: mapped_play.dwn,
    yards_to_go: mapped_play.yards_to_go,
    off: mapped_play.off,
    def: mapped_play.def,
    play_type: mapped_play.play_type
  }

  if (mapped_play.play_type !== 'KOFF' && mapped_play.play_type !== 'CONV') {
    criteria.ydl_100 = mapped_play.ydl_100
  }

  const special_teams_types = ['KOFF', 'PUNT', 'FGXP']
  if (
    special_teams_types.includes(mapped_play.play_type) &&
    mapped_play.sec_rem_qtr != null
  ) {
    criteria.sec_rem_qtr = mapped_play.sec_rem_qtr
    criteria.sec_rem_qtr_tolerance = 10
  }

  return criteria
}

const match_play_to_db = ({
  game,
  mapped_play,
  sportradar_play,
  unmatched_reasons
}) => {
  const match_criteria = build_match_criteria(game.esbid, mapped_play)
  let db_play = null
  let multiple_match_error = false

  try {
    db_play = find_play(match_criteria)

    if (!db_play && match_criteria.yards_to_go != null) {
      for (const offset of [-1, 1]) {
        const fuzzy_criteria = {
          ...match_criteria,
          yards_to_go: match_criteria.yards_to_go + offset
        }
        db_play = find_play(fuzzy_criteria)
        if (db_play) {
          log(
            `Fuzzy match: yards_to_go ${match_criteria.yards_to_go} -> ${fuzzy_criteria.yards_to_go}`
          )
          break
        }
      }
    }
  } catch (error) {
    if (error instanceof MultiplePlayMatchError) {
      log(`MULTIPLE MATCH ERROR: ${game.esbid} - ${sportradar_play.id}`)
      log(`Description: ${sportradar_play.description}`)
      log(`Matched ${error.match_count} plays`)
      log('Match criteria:', match_criteria)
      multiple_match_error = true
    } else {
      throw error
    }
  }

  if (!db_play && !multiple_match_error) {
    const play_type = mapped_play.play_type
    unmatched_reasons[play_type] = (unmatched_reasons[play_type] || 0) + 1
  }

  return { db_play, multiple_match_error }
}

const track_collisions = ({
  db_play,
  mapped_play,
  sportradar_play,
  game,
  all_collisions
}) => {
  const differences = diff(db_play, mapped_play)
  if (!differences) return

  const edits = differences.filter((d) => d.kind === 'E')
  for (const edit of edits) {
    const field = edit.path[0]
    if (
      should_track_collision({
        field,
        existing_value: edit.lhs,
        new_value: edit.rhs
      })
    ) {
      all_collisions.push({
        field,
        existing: edit.lhs,
        new: edit.rhs,
        play_info: {
          esbid: game.esbid,
          playId: db_play.playId,
          qtr: db_play.qtr,
          game_clock: db_play.game_clock_start,
          play_type: mapped_play.play_type,
          description: sportradar_play.description?.substring(0, 80)
        }
      })
    }
  }
}

const map_sportradar_play_to_nfl_play = async ({
  sportradar_play: play,
  game_context,
  drive_context,
  team_mappings_cache
}) => {
  const mapped = map_basic_play_data({
    sportradar_play: play,
    game_context,
    drive_context
  })

  Object.assign(
    mapped,
    map_contextual_data({
      sportradar_play: play,
      game_context,
      team_mappings_cache
    }),
    map_formation_data({ sportradar_play: play }),
    map_drive_data({ drive_context })
  )

  const stats = play.statistics || []
  const get_stat = (type) => stats.find((s) => s.stat_type === type)
  const get_stats = (type) => stats.filter((s) => s.stat_type === type)

  const resolve_player = resolve_player_id
  const get_team_abbrev = (params) =>
    get_team_abbreviation({ ...params, team_mappings_cache })

  const stat_mappers = [
    map_passing_stats({
      pass_stats: get_stat('pass'),
      resolve_player,
      pos_team: mapped.pos_team
    }),
    map_receiving_stats({
      receive_stats: get_stat('receive'),
      resolve_player,
      pos_team: mapped.pos_team
    }),
    map_rushing_stats({
      rush_stats: get_stat('rush'),
      resolve_player,
      pos_team: mapped.pos_team,
      is_sack: mapped.sk
    }),
    map_field_goal_stats({
      field_goal_stats: get_stat('field_goal'),
      resolve_player,
      pos_team: mapped.pos_team
    }),
    map_punt_stats({
      punt_stats: get_stat('punt'),
      resolve_player,
      pos_team: mapped.pos_team
    }),
    map_kickoff_stats({
      kick_stats: get_stat('kick'),
      resolve_player,
      pos_team: mapped.pos_team
    }),
    map_return_stats({
      return_stats: get_stat('return'),
      resolve_player,
      def_team: mapped.def
    }),
    map_penalty_stats({
      penalty_stats: get_stats('penalty'),
      resolve_player,
      get_team_abbrev
    }),
    map_play_details({
      details: play.details || [],
      resolve_player,
      get_team_abbrev,
      def_team: mapped.def
    })
  ]

  const results = await Promise.all(stat_mappers)
  results.forEach((result) => Object.assign(mapped, result))

  // Calculate goal_to_go after all field position data is available
  if (mapped.ydl_100 !== null && mapped.yards_to_go !== null) {
    mapped.goal_to_go = mapped.ydl_100 + mapped.yards_to_go >= 100
  }

  const broken_tackles_rush = mapped.broken_tackles_rush || 0
  const broken_tackles_rec = mapped.broken_tackles_rec || 0
  if (broken_tackles_rush > 0 || broken_tackles_rec > 0) {
    mapped.mbt = broken_tackles_rush + broken_tackles_rec
  }

  const fumble_stats = get_stats('fumble')
  if (fumble_stats.length > 0) {
    mapped.fuml = fumble_stats.some((f) => f.fumble === 1)
  }

  if (play.nullified) {
    mapped.deleted = true
  }

  mapped.updated = Math.floor(Date.now() / 1000)
  return mapped
}

/**
 * Import play-by-play data for games with Sportradar game IDs
 */
const import_plays_sportradar = async ({
  year,
  week,
  game_id,
  all = false,
  dry = false,
  ignore_conflicts = false
} = {}) => {
  console.time('import-plays-sportradar-total')

  // Load team mappings
  const team_mappings_cache = await load_team_mappings()

  let games_query = db('nfl_games')
    .whereNotNull('sportradar_game_id')
    .select('esbid', 'year', 'week', 'sportradar_game_id', 'v', 'h')

  if (game_id) {
    games_query = games_query.where({ esbid: game_id })
  } else if (!all) {
    if (year) games_query = games_query.where({ year })
    if (week) games_query = games_query.where({ week })
  }

  const games = await games_query
  log(`Found ${games.length} games with Sportradar game IDs`)

  if (games.length === 0) {
    log('No games found - exiting')
    console.timeEnd('import-plays-sportradar-total')
    return
  }

  log('Preloading play cache...')
  console.time('play-cache-preload')
  await preload_plays({
    years: [...new Set(games.map((g) => g.year))],
    weeks: [...new Set(games.map((g) => g.week))],
    esbids: games.map((g) => g.esbid)
  })
  console.timeEnd('play-cache-preload')
  log('Play cache stats:', get_cache_stats())

  log('Preloading player cache...')
  console.time('player-cache-preload')
  await preload_active_players({ all_players: true })
  console.timeEnd('player-cache-preload')

  // Process each game
  let total_plays_processed = 0
  let total_plays_matched = 0
  let total_plays_updated = 0
  let total_plays_multiple_matches = 0
  const unmatched_plays = []
  const multiple_match_plays = []
  const unmatched_reasons = {} // Track unmatched plays by play type
  const sample_plays_by_type = {} // For --dry mode: collect sample plays by type
  const all_collisions = [] // Track all field collisions for summary

  for (const game of games) {
    log(`\nProcessing game ${game.esbid} (${game.v} @ ${game.h})...`)

    try {
      // Fetch play-by-play data
      const pbp_data = await get_game_play_by_play({
        sportradar_game_id: game.sportradar_game_id
      })

      if (!pbp_data || !pbp_data.periods) {
        log(`No play-by-play data for game ${game.esbid}`)
        continue
      }

      for (const period of pbp_data.periods) {
        for (const pbp_item of period.pbp || []) {
          if (pbp_item.type !== 'drive') continue

          const drive_context = {
            id: pbp_item.id,
            sequence: pbp_item.sequence,
            play_count: pbp_item.play_count,
            duration: pbp_item.duration,
            gain: pbp_item.gain,
            first_downs: pbp_item.first_downs,
            penalty_yards: pbp_item.penalty_yards,
            start_reason: pbp_item.start_reason,
            end_reason: pbp_item.end_reason
          }

          for (const event of pbp_item.events || []) {
            if (event.type !== 'play') continue

            total_plays_processed++

            const game_context = {
              esbid: game.esbid,
              sportradar_game_id: game.sportradar_game_id,
              period_number: period.number,
              home_team: game.h,
              away_team: game.v
            }

            const mapped_play = await map_sportradar_play_to_nfl_play({
              sportradar_play: event,
              game_context,
              drive_context,
              team_mappings_cache
            })

            const { db_play, multiple_match_error } = match_play_to_db({
              game,
              mapped_play,
              sportradar_play: event,
              unmatched_reasons
            })

            if (db_play) {
              total_plays_matched++
              track_collisions({
                db_play,
                mapped_play,
                sportradar_play: event,
                game,
                all_collisions
              })

              if (dry) {
                const play_type = mapped_play.play_type || 'UNKNOWN'
                if (!sample_plays_by_type[play_type]) {
                  sample_plays_by_type[play_type] = {
                    sportradar_play: event,
                    mapped_play,
                    db_play
                  }
                }
              } else {
                const updates_made = await update_play({
                  play_row: db_play,
                  update: mapped_play,
                  ignore_conflicts
                })
                if (updates_made > 0) total_plays_updated++
              }
            } else if (multiple_match_error) {
              total_plays_multiple_matches++
              multiple_match_plays.push({
                esbid: game.esbid,
                sportradar_play_id: event.id,
                description: event.description,
                qtr: mapped_play.qtr,
                clock: mapped_play.game_clock_start
              })
            } else {
              unmatched_plays.push({
                esbid: game.esbid,
                sportradar_play_id: event.id,
                description: event.description,
                qtr: mapped_play.qtr,
                clock: mapped_play.game_clock_start
              })
            }
          }
        }
      }

      log(`Game ${game.esbid} processed`)
    } catch (error) {
      log(`Error processing game ${game.esbid}: ${error.message}`)
      continue
    }
  }

  // Print summary reports
  print_import_summary({
    total_plays_processed,
    total_plays_matched,
    total_plays_updated,
    total_plays_multiple_matches,
    unmatched_plays,
    multiple_match_plays,
    unmatched_reasons
  })

  if (dry) {
    print_dry_mode_comparison({ sample_plays_by_type })
  }

  print_collision_summary({ all_collisions })

  console.timeEnd('import-plays-sportradar-total')
}

const main = async () => {
  let error
  try {
    const year = argv.year ? parseInt(argv.year) : null
    const week = argv.week ? parseInt(argv.week) : null
    const game_id = argv['game-id'] || null
    const all = argv.all || false
    const dry = argv.dry || false
    const ignore_conflicts = argv['ignore-conflicts'] || false

    await import_plays_sportradar({
      year,
      week,
      game_id,
      all,
      dry,
      ignore_conflicts
    })
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.IMPORT_PLAYS_SPORTRADAR,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default import_plays_sportradar
