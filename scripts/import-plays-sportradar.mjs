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

/**
 * Load team mappings from config table
 * @returns {Map} Map of team data keyed by Sportradar team ID
 */
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

/**
 * Get team abbreviation from Sportradar team ID or alias
 * @param {Object} params
 * @param {string} params.sportradar_team_id - Sportradar team UUID
 * @param {string} params.sportradar_alias - Team alias from API
 * @param {Map} params.team_mappings_cache - Cached team mappings
 * @returns {string} Team abbreviation
 */
const get_team_abbreviation = ({
  sportradar_team_id,
  sportradar_alias,
  team_mappings_cache
}) => {
  if (sportradar_team_id && team_mappings_cache.has(sportradar_team_id)) {
    return team_mappings_cache.get(sportradar_team_id).abbrev
  }

  if (sportradar_alias) {
    return fixTeam(sportradar_alias)
  }

  return null
}

/**
 * Resolve player ID from Sportradar player ID
 * @param {Object} params
 * @param {string} params.sportradar_player_id - Sportradar player ID
 * @param {string} params.player_name - Player name (fallback)
 * @param {string} params.team_abbrev - Team abbreviation (for fallback lookup)
 * @returns {Promise<Object|null>} Player object with pid and gsisid, or null
 */
const resolve_player_id = async ({
  sportradar_player_id,
  player_name,
  team_abbrev
}) => {
  if (!sportradar_player_id) {
    return null
  }

  // Primary lookup: direct DB query by sportradar_id
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

  // Fallback lookup: use player_cache by name
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

// Transformation functions now imported from sportradar-transforms.mjs

/**
 * Map basic play metadata (identifiers, down/distance, play type, etc.)
 */
const map_basic_play_data = ({
  sportradar_play,
  game_context,
  drive_context
}) => {
  const play = sportradar_play
  const mapped = {}

  // Sportradar identifiers
  mapped.sportradar_game_id = game_context.sportradar_game_id
  mapped.sportradar_play_id = play.id
  mapped.sportradar_drive_id = drive_context.id
  mapped.sportradar_play_type = play.play_type

  // Wall clock time
  if (play.wall_clock) {
    mapped.wall_clock = new Date(play.wall_clock)
  }

  // Quarter
  mapped.qtr = game_context.period_number

  // Down and distance (null for special teams plays)
  if (play.start_situation) {
    const down = play.start_situation.down
    mapped.dwn = down !== undefined && down !== null && down !== 0 ? down : null

    const yfd = play.start_situation.yfd
    mapped.yards_to_go =
      yfd !== undefined && yfd !== null && yfd !== 0 ? yfd : null
  }

  // Play sequence and type
  if (play.sequence) {
    mapped.sequence = play.sequence
  }

  if (play.play_type) {
    mapped.play_type = map_play_type(play.play_type)
  }

  // Boolean flags - only set if we have explicit data
  if (play.kneel_down === true) {
    mapped.qb_kneel = true
  } else if (play.kneel_down === false) {
    mapped.qb_kneel = false
  }

  if (play.spike === true) {
    mapped.qb_spike = true
  } else if (play.spike === false) {
    mapped.qb_spike = false
  }

  return mapped
}

/**
 * Map game clock and time remaining
 */
const map_time_data = ({ sportradar_play, qtr }) => {
  const mapped = {}

  if (sportradar_play.clock) {
    mapped.game_clock_start = sportradar_play.clock
    const sec_rem_qtr = parse_clock_to_seconds(sportradar_play.clock)
    const time_remaining = calculate_time_remaining(qtr, sec_rem_qtr)
    Object.assign(mapped, time_remaining)
  }

  return mapped
}

/**
 * Map team identification fields
 */
const map_team_data = ({
  sportradar_play,
  game_context,
  team_mappings_cache
}) => {
  const mapped = {}

  if (sportradar_play.start_situation?.possession) {
    const pos_team = get_team_abbreviation({
      sportradar_team_id: sportradar_play.start_situation.possession.id,
      sportradar_alias: sportradar_play.start_situation.possession.alias,
      team_mappings_cache
    })
    mapped.pos_team = pos_team
    mapped.off = pos_team

    // Defensive team
    const home_team = game_context.home_team
    const away_team = game_context.away_team
    mapped.def = pos_team === home_team ? away_team : home_team
  }

  return mapped
}

/**
 * Map field position and yardline data
 */
const map_field_position = ({ sportradar_play, pos_team, yards_to_go }) => {
  const mapped = {}

  // Start yardline
  if (sportradar_play.start_situation?.location && pos_team) {
    const start_ydl = parse_yardline(
      sportradar_play.start_situation.location,
      pos_team
    )
    mapped.ydl_side = start_ydl.ydl_side
    mapped.ydl_num = start_ydl.ydl_num
    mapped.ydl_100 = start_ydl.ydl_100
    mapped.ydl_start = start_ydl.ydl_str
  }

  // End yardline
  if (sportradar_play.end_situation?.location && pos_team) {
    const end_ydl = parse_yardline(
      sportradar_play.end_situation.location,
      pos_team
    )
    mapped.ydl_end = end_ydl.ydl_str
  }

  // Goal to go
  if (mapped.ydl_100 !== null && yards_to_go !== null) {
    mapped.goal_to_go = mapped.ydl_100 + yards_to_go >= 100
  }

  return mapped
}

/**
 * Map score tracking
 */
const map_score_data = ({ sportradar_play }) => {
  const mapped = {}

  if (sportradar_play.home_points !== undefined) {
    mapped.home_score = sportradar_play.home_points
  }
  if (sportradar_play.away_points !== undefined) {
    mapped.away_score = sportradar_play.away_points
  }

  return mapped
}

/**
 * Map formation and tactical data
 */
const map_formation_data = ({ sportradar_play }) => {
  const mapped = {}

  // QB position at snap
  if (sportradar_play.qb_at_snap) {
    mapped.qb_position = transform_qb_position(sportradar_play.qb_at_snap)
  }

  // Hash mark position
  if (sportradar_play.hash_mark) {
    mapped.starting_hash = transform_hash_position(sportradar_play.hash_mark)
  }

  // Running lane/gap
  if (
    sportradar_play.running_lane !== null &&
    sportradar_play.running_lane !== undefined
  ) {
    mapped.run_gap = transform_run_gap(sportradar_play.running_lane)
  }

  // Play action and tempo - only set if we have explicit data
  if (sportradar_play.play_action === true) {
    mapped.play_action = true
  } else if (sportradar_play.play_action === false) {
    mapped.play_action = false
  }

  if (sportradar_play.screen_pass === true) {
    mapped.screen_pass = true
  } else if (sportradar_play.screen_pass === false) {
    mapped.screen_pass = false
  }

  if (sportradar_play.huddle === 'No Huddle') {
    mapped.no_huddle = true
  } else if (sportradar_play.huddle === 'Huddle') {
    mapped.no_huddle = false
  }

  if (sportradar_play.run_pass_option === true) {
    mapped.run_play_option = true
  } else if (sportradar_play.run_pass_option === false) {
    mapped.run_play_option = false
  }

  // Defensive alignment
  if (
    sportradar_play.men_in_box !== null &&
    sportradar_play.men_in_box !== undefined
  ) {
    mapped.box_defenders = sportradar_play.men_in_box
  }
  if (
    sportradar_play.players_rushed !== null &&
    sportradar_play.players_rushed !== undefined
  ) {
    mapped.pass_rushers = sportradar_play.players_rushed
  }
  if (sportradar_play.blitz !== null && sportradar_play.blitz !== undefined) {
    mapped.blitz = sportradar_play.blitz
  }

  // QB pocket
  if (sportradar_play.pocket_location) {
    mapped.pocket_location = transform_pocket_location(
      sportradar_play.pocket_location
    )
  }

  // TE alignment
  if (
    sportradar_play.left_tightends !== null &&
    sportradar_play.left_tightends !== undefined
  ) {
    mapped.left_tightends = sportradar_play.left_tightends
  }
  if (
    sportradar_play.right_tightends !== null &&
    sportradar_play.right_tightends !== undefined
  ) {
    mapped.right_tightends = sportradar_play.right_tightends
  }

  // Fake plays - only set if we have explicit data
  if (sportradar_play.fake_punt === true) {
    mapped.fake_punt = true
  } else if (sportradar_play.fake_punt === false) {
    mapped.fake_punt = false
  }

  if (sportradar_play.fake_field_goal === true) {
    mapped.fake_field_goal = true
  } else if (sportradar_play.fake_field_goal === false) {
    mapped.fake_field_goal = false
  }

  // Pass route
  if (sportradar_play.pass_route) {
    mapped.route = transform_play_route(sportradar_play.pass_route)
  }

  return mapped
}

/**
 * Map drive context data
 */
const map_drive_data = ({ drive_context }) => {
  const mapped = {}

  if (!drive_context) return mapped

  mapped.drive_seq = drive_context.sequence
  mapped.drive_play_count = drive_context.play_count
  mapped.drive_top = normalize_drive_duration(drive_context.duration)
  mapped.drive_yds = drive_context.gain
  mapped.drive_fds = drive_context.first_downs
  mapped.drive_yds_penalized = drive_context.penalty_yards

  // Drive transitions
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

/**
 * Main function to transform Sportradar play data to nfl_plays schema
 * Maps ~150+ fields from Sportradar's nested structure to flat nfl_plays table
 */
const map_sportradar_play_to_nfl_play = async ({
  sportradar_play,
  game_context,
  drive_context,
  team_mappings_cache
}) => {
  const play = sportradar_play

  // Map basic data using helper functions
  const mapped = map_basic_play_data({
    sportradar_play,
    game_context,
    drive_context
  })

  Object.assign(mapped, map_time_data({ sportradar_play, qtr: mapped.qtr }))
  Object.assign(
    mapped,
    map_team_data({ sportradar_play, game_context, team_mappings_cache })
  )
  Object.assign(
    mapped,
    map_field_position({
      sportradar_play,
      pos_team: mapped.pos_team,
      yards_to_go: mapped.yards_to_go
    })
  )
  Object.assign(mapped, map_score_data({ sportradar_play }))
  Object.assign(mapped, map_formation_data({ sportradar_play }))
  Object.assign(mapped, map_drive_data({ drive_context }))

  // Extract and map statistics using helper functions
  const stats = play.statistics || []
  const pass_stats = stats.find((s) => s.stat_type === 'pass')
  const rush_stats = stats.find((s) => s.stat_type === 'rush')
  const receive_stats = stats.find((s) => s.stat_type === 'receive')
  const kick_stats = stats.find((s) => s.stat_type === 'kick')
  const punt_stats = stats.find((s) => s.stat_type === 'punt')
  const field_goal_stats = stats.find((s) => s.stat_type === 'field_goal')
  const return_stats = stats.find((s) => s.stat_type === 'return')
  const penalty_stats = stats.filter((s) => s.stat_type === 'penalty')
  const fumble_stats = stats.filter((s) => s.stat_type === 'fumble')

  // Map all statistics types
  const resolve_player = resolve_player_id
  const get_team_abbrev = (params) =>
    get_team_abbreviation({ ...params, team_mappings_cache })

  Object.assign(
    mapped,
    await map_passing_stats({
      pass_stats,
      resolve_player,
      pos_team: mapped.pos_team
    })
  )
  Object.assign(
    mapped,
    await map_receiving_stats({
      receive_stats,
      resolve_player,
      pos_team: mapped.pos_team
    })
  )
  Object.assign(
    mapped,
    await map_rushing_stats({
      rush_stats,
      resolve_player,
      pos_team: mapped.pos_team,
      is_sack: mapped.sk
    })
  )
  Object.assign(
    mapped,
    await map_field_goal_stats({
      field_goal_stats,
      resolve_player,
      pos_team: mapped.pos_team
    })
  )
  Object.assign(
    mapped,
    await map_punt_stats({
      punt_stats,
      resolve_player,
      pos_team: mapped.pos_team
    })
  )
  Object.assign(
    mapped,
    await map_kickoff_stats({
      kick_stats,
      resolve_player,
      pos_team: mapped.pos_team
    })
  )
  Object.assign(
    mapped,
    await map_return_stats({
      return_stats,
      resolve_player,
      def_team: mapped.def
    })
  )
  Object.assign(
    mapped,
    await map_penalty_stats({ penalty_stats, resolve_player, get_team_abbrev })
  )

  // Combined broken tackles
  const broken_tackles_rush = mapped.broken_tackles_rush || 0
  const broken_tackles_rec = mapped.broken_tackles_rec || 0
  if (broken_tackles_rush > 0 || broken_tackles_rec > 0) {
    mapped.mbt = broken_tackles_rush + broken_tackles_rec
  }

  // Fumble flag
  if (fumble_stats.length > 0) {
    mapped.fuml = fumble_stats.some((f) => f.fumble === 1)
  }

  // Map play details (penalties, fumbles, sacks, etc.)
  const details = play.details || []
  Object.assign(
    mapped,
    await map_play_details({
      details,
      resolve_player,
      get_team_abbrev,
      def_team: mapped.def
    })
  )

  // Handle no_play/nullified separately (needs access to play object)
  if (play.nullified) {
    mapped.deleted = true
  }

  // Set updated timestamp
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

  // Query games with Sportradar game IDs
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

  // Preload caches
  const years = [...new Set(games.map((g) => g.year))]
  const weeks = [...new Set(games.map((g) => g.week))]
  const esbids = games.map((g) => g.esbid)

  log('Preloading play cache...')
  console.time('play-cache-preload')
  await preload_plays({ years, weeks, esbids })
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

      // Navigate Sportradar structure: periods -> pbp -> drives -> events -> plays
      for (const period of pbp_data.periods) {
        const period_number = period.number

        for (const pbp_item of period.pbp || []) {
          if (pbp_item.type !== 'drive') continue

          const drive = pbp_item
          const drive_context = {
            id: drive.id,
            sequence: drive.sequence,
            play_count: drive.play_count,
            duration: drive.duration,
            gain: drive.gain,
            first_downs: drive.first_downs,
            penalty_yards: drive.penalty_yards,
            start_reason: drive.start_reason,
            end_reason: drive.end_reason
          }

          for (const event of drive.events || []) {
            if (event.type !== 'play') continue

            const sportradar_play = event
            total_plays_processed++

            // Map play data
            const game_context = {
              esbid: game.esbid,
              sportradar_game_id: game.sportradar_game_id,
              period_number,
              home_team: game.h,
              away_team: game.v
            }

            const mapped_play = await map_sportradar_play_to_nfl_play({
              sportradar_play,
              game_context,
              drive_context,
              team_mappings_cache
            })

            // Try to match existing play
            // Match criteria: game context + situational fields
            // Special handling for special teams plays: use time-based matching when context is limited
            const match_criteria = {
              esbid: game.esbid,
              qtr: mapped_play.qtr,
              dwn: mapped_play.dwn,
              yards_to_go: mapped_play.yards_to_go,
              off: mapped_play.off,
              def: mapped_play.def,
              play_type: mapped_play.play_type // CRITICAL: must include play_type to avoid mismatches
            }

            // For non-special teams plays, include ydl_100 in matching
            // Kickoffs and conversions excluded because yardline conventions differ between sources
            if (
              mapped_play.play_type !== 'KOFF' &&
              mapped_play.play_type !== 'CONV'
            ) {
              match_criteria.ydl_100 = mapped_play.ydl_100
            }

            // For special teams plays (KOFF, PUNT, FGXP), include time-based matching
            // These plays often have limited contextual data (null down, null yards_to_go)
            // Time matching with 10-second tolerance prevents matching wrong plays
            const special_teams_types = ['KOFF', 'PUNT', 'FGXP']
            if (
              special_teams_types.includes(mapped_play.play_type) &&
              mapped_play.sec_rem_qtr !== null &&
              mapped_play.sec_rem_qtr !== undefined
            ) {
              match_criteria.sec_rem_qtr = mapped_play.sec_rem_qtr
              match_criteria.sec_rem_qtr_tolerance = 10 // 10-second tolerance for time matching
            }

            let db_play
            let multiple_match_error = false

            try {
              db_play = find_play(match_criteria)

              // Fuzzy matching: If exact match fails and yards_to_go is set, try +/-1 yard tolerance
              // This handles minor discrepancies in yard measurements between data sources
              if (
                !db_play &&
                match_criteria.yards_to_go !== null &&
                match_criteria.yards_to_go !== undefined
              ) {
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
                log(
                  `MULTIPLE MATCH ERROR: ${game.esbid} - ${sportradar_play.id}`
                )
                log(`Description: ${sportradar_play.description}`)
                log(`Matched ${error.match_count} plays`)
                log('Match criteria:', match_criteria)
                multiple_match_error = true
              } else {
                throw error
              }
            }

            // Track reasons for non-matches
            if (!db_play && !multiple_match_error) {
              if (!unmatched_reasons[mapped_play.play_type]) {
                unmatched_reasons[mapped_play.play_type] = 0
              }
              unmatched_reasons[mapped_play.play_type]++
            }

            if (db_play) {
              total_plays_matched++

              // Track collisions using deep-diff
              const differences = diff(db_play, mapped_play)

              if (differences) {
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
                        description: sportradar_play.description?.substring(
                          0,
                          80
                        )
                      }
                    })
                  }
                }
              }

              // For --dry mode, collect sample plays by type
              if (dry) {
                const play_type = mapped_play.play_type || 'UNKNOWN'
                if (!sample_plays_by_type[play_type]) {
                  sample_plays_by_type[play_type] = {
                    sportradar_play,
                    mapped_play,
                    db_play
                  }
                }
              }

              if (!dry) {
                const updates_made = await update_play({
                  play_row: db_play,
                  update: mapped_play,
                  ignore_conflicts
                })

                if (updates_made > 0) {
                  total_plays_updated++
                }
              }
            } else if (multiple_match_error) {
              total_plays_multiple_matches++
              multiple_match_plays.push({
                esbid: game.esbid,
                sportradar_play_id: sportradar_play.id,
                description: sportradar_play.description,
                qtr: mapped_play.qtr,
                clock: mapped_play.game_clock_start,
                match_criteria
              })
            } else {
              unmatched_plays.push({
                esbid: game.esbid,
                sportradar_play_id: sportradar_play.id,
                description: sportradar_play.description,
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
