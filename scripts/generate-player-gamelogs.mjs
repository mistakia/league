/**
 * Generate Player Gamelogs
 *
 * This script creates comprehensive player gamelogs from play-by-play data.
 *
 * Process Overview:
 * 1. Load play stats from nfl_plays table
 * 2. Calculate stats from play-by-play data (targets, receptions, yards, etc.)
 * 3. Generate receiving and rushing advanced metrics
 * 4. Create defense/special teams gamelogs
 * 5. Add snap-based gamelogs for players without counting stats
 *    (ensures all active players have gamelogs even with 0 targets/carries)
 *
 * Data Sources:
 * - nfl_plays: Play-by-play data with player stats
 * - nfl_snaps: Snap participation data
 * - player_receiving_gamelogs: Route data
 *
 * Usage:
 *   node scripts/generate-player-gamelogs.mjs --year 2025 --week 8
 *   node scripts/generate-player-gamelogs.mjs --year 2025 --week 8 --dry
 */

import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { is_main, report_job, batch_insert } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import {
  groupBy,
  fixTeam,
  calculateStatsFromPlayStats,
  calculateDstStatsFromPlays
} from '#libs-shared'
import db from '#db'
import {
  current_season,
  all_fantasy_stats,
  nfl_team_abbreviations
} from '#constants'
import { get_play_stats } from '#libs-server/play-stats-utils.mjs'
import handle_season_args_for_script from '#libs-server/handle-season-args-for-script.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv))
    .option('esbid', {
      type: 'string',
      describe: 'Generate gamelogs for a specific game ID only'
    })
    .parse()
}

const log = debug('generate-player-gamelogs')
debug.enable('generate-player-gamelogs')

// Database field constraints
const DB_CONSTRAINTS = {
  TEAM_TARGET_SHARE_MAX: 9.9999, // numeric(5,4)
  TEAM_AIR_YARD_SHARE_MAX: 9.9999, // numeric(5,4)
  ROUTE_SHARE_MAX: 999.99, // numeric(5,2)
  WEIGHTED_OPPORTUNITY_RATING_MAX: 999.99 // numeric(5,2)
}

/**
 * Calculate opponent team for a given team and game
 */
const calculate_opponent = ({ team, home_team, away_team }) => {
  return fixTeam(team) === fixTeam(home_team)
    ? fixTeam(away_team)
    : fixTeam(home_team)
}

/**
 * Find team gamelog from inserts array
 */
const find_team_gamelog = ({ team_gamelog_inserts, team, esbid }) => {
  return team_gamelog_inserts.find(
    (t) => t.tm === fixTeam(team) && t.esbid === esbid
  )
}

/**
 * Create lookup map from array of objects with key fields
 */
const create_lookup_map = ({ items, key_fields, value_field }) => {
  return items.reduce((acc, row) => {
    const key = key_fields.map((field) => row[field]).join('_')
    acc[key] = row[value_field]
    return acc
  }, {})
}

/**
 * Clamp numeric value to maximum constraint
 */
const clamp_value = ({ value, max, field_name, item_info, dry_run }) => {
  if (value != null && value > max) {
    if (dry_run) {
      log(`Would clamp ${field_name} from ${value} to ${max} for ${item_info}`)
    }
    return max
  }
  return value
}

/**
 * Validate and clamp receiving gamelog values to prevent database overflow
 */
const clamp_receiving_gamelog_values = ({ item, dry_run }) => {
  const item_info = `pid=${item.pid}, esbid=${item.esbid}`
  let modified = false

  const original_team_target_share = item.team_target_share
  item.team_target_share = clamp_value({
    value: item.team_target_share,
    max: DB_CONSTRAINTS.TEAM_TARGET_SHARE_MAX,
    field_name: 'team_target_share',
    item_info,
    dry_run
  })
  if (item.team_target_share !== original_team_target_share) modified = true

  const original_team_air_yard_share = item.team_air_yard_share
  item.team_air_yard_share = clamp_value({
    value: item.team_air_yard_share,
    max: DB_CONSTRAINTS.TEAM_AIR_YARD_SHARE_MAX,
    field_name: 'team_air_yard_share',
    item_info,
    dry_run
  })
  if (item.team_air_yard_share !== original_team_air_yard_share) modified = true

  const original_route_share = item.route_share
  item.route_share = clamp_value({
    value: item.route_share,
    max: DB_CONSTRAINTS.ROUTE_SHARE_MAX,
    field_name: 'route_share',
    item_info,
    dry_run
  })
  if (item.route_share !== original_route_share) modified = true

  const original_weighted_opportunity_rating = item.weighted_opportunity_rating
  item.weighted_opportunity_rating = clamp_value({
    value: item.weighted_opportunity_rating,
    max: DB_CONSTRAINTS.WEIGHTED_OPPORTUNITY_RATING_MAX,
    field_name: 'weighted_opportunity_rating',
    item_info,
    dry_run
  })
  if (item.weighted_opportunity_rating !== original_weighted_opportunity_rating)
    modified = true

  return modified
}

const format_base_gamelog = ({ esbid, stats, opp, tm, year }) => {
  const cleaned_stats = Object.keys(stats)
    .filter((key) => all_fantasy_stats.includes(key))
    .reduce((obj, key) => {
      obj[key] = stats[key]
      return obj
    }, {})

  return {
    esbid,
    tm,
    opp,
    year,
    ...cleaned_stats
  }
}

const format_player_gamelog = ({ esbid, pid, stats, opp, pos, tm, year }) => {
  return {
    ...format_base_gamelog({ esbid, stats, opp, tm, year }),
    pid,
    pos,
    active: true
  }
}

const format_receiving_gamelog = ({
  esbid,
  pid,
  stats,
  year,
  team_stats,
  player_routes,
  team_dropbacks,
  validate = false
}) => {
  const team_target_share = team_stats.trg ? stats.trg / team_stats.trg : 0
  const team_air_yard_share = team_stats.passing_air_yards
    ? stats.targeted_air_yards / team_stats.passing_air_yards
    : 0

  // Calculate route_share, but handle cases where team_dropbacks data is missing/incomplete
  // If team_dropbacks is too low (less than player_routes), the data is likely incorrect
  // In such cases, set route_share to null to avoid overflow
  let route_share = null
  if (player_routes && team_dropbacks) {
    // Validate: if team_dropbacks < player_routes, the dropback data is likely incorrect
    // This can happen when qb_dropback field is not properly populated in nfl_plays
    if (team_dropbacks >= player_routes) {
      route_share = (player_routes / team_dropbacks) * 100
      // Clamp to max 999.99 to prevent database overflow (numeric(5,2) constraint)
      if (route_share > DB_CONSTRAINTS.ROUTE_SHARE_MAX) {
        route_share = DB_CONSTRAINTS.ROUTE_SHARE_MAX
      }
    } else {
      // Dropback data appears incorrect - log warning and set to null
      if (validate) {
        log(
          `WARNING: team_dropbacks (${team_dropbacks}) < player_routes (${player_routes}) for pid=${pid}, esbid=${esbid}, year=${year} - setting route_share to null`
        )
      }
      route_share = null
    }
  }

  const receiving_gamelog = {
    esbid,
    pid,
    year,
    longest_reception: stats.longest_reception,
    recv_yards_15_plus_count: stats.recv_yards_15_plus_count,
    team_target_share,
    team_air_yard_share,
    route_share,
    redzone_targets: stats.redzone_targets,
    weighted_opportunity_rating:
      1.5 * team_target_share + 0.7 * team_air_yard_share
  }

  if (validate) {
    // Validate numeric field constraints (for dry-run logging)
    if (
      receiving_gamelog.team_target_share != null &&
      receiving_gamelog.team_target_share > DB_CONSTRAINTS.TEAM_TARGET_SHARE_MAX
    ) {
      log(
        `OVERFLOW: team_target_share = ${receiving_gamelog.team_target_share} (max ${DB_CONSTRAINTS.TEAM_TARGET_SHARE_MAX}) for pid=${pid}, esbid=${esbid}, year=${year}`
      )
      log(`  stats.trg=${stats.trg}, team_stats.trg=${team_stats.trg}`)
    }
    if (
      receiving_gamelog.team_air_yard_share != null &&
      receiving_gamelog.team_air_yard_share >
        DB_CONSTRAINTS.TEAM_AIR_YARD_SHARE_MAX
    ) {
      log(
        `OVERFLOW: team_air_yard_share = ${receiving_gamelog.team_air_yard_share} (max ${DB_CONSTRAINTS.TEAM_AIR_YARD_SHARE_MAX}) for pid=${pid}, esbid=${esbid}, year=${year}`
      )
      log(
        `  stats.targeted_air_yards=${stats.targeted_air_yards}, team_stats.passing_air_yards=${team_stats.passing_air_yards}`
      )
    }
    if (
      receiving_gamelog.route_share != null &&
      receiving_gamelog.route_share > DB_CONSTRAINTS.ROUTE_SHARE_MAX
    ) {
      log(
        `OVERFLOW: route_share = ${receiving_gamelog.route_share} (max ${DB_CONSTRAINTS.ROUTE_SHARE_MAX}) for pid=${pid}, esbid=${esbid}, year=${year}`
      )
      log(`  player_routes=${player_routes}, team_dropbacks=${team_dropbacks}`)
    }
    if (
      receiving_gamelog.weighted_opportunity_rating != null &&
      receiving_gamelog.weighted_opportunity_rating >
        DB_CONSTRAINTS.WEIGHTED_OPPORTUNITY_RATING_MAX
    ) {
      log(
        `OVERFLOW: weighted_opportunity_rating = ${receiving_gamelog.weighted_opportunity_rating} (max ${DB_CONSTRAINTS.WEIGHTED_OPPORTUNITY_RATING_MAX}) for pid=${pid}, esbid=${esbid}, year=${year}`
      )
      log(
        `  team_target_share=${team_target_share}, team_air_yard_share=${team_air_yard_share}`
      )
    }
  }

  return receiving_gamelog
}

const format_rushing_gamelog = ({ esbid, pid, stats, year, team_stats }) => {
  const rush_share = team_stats.ra ? stats.ra / team_stats.ra : null
  const weighted_opportunity =
    1.3 * stats.rush_attempts_redzone +
    2.25 * stats.redzone_targets +
    0.48 * (stats.ra - stats.rush_attempts_redzone) +
    1.43 * (stats.trg - stats.redzone_targets)
  const rush_yards_per_attempt = stats.ry / stats.ra

  return {
    esbid,
    pid,
    year,
    longest_rush: stats.longest_rush,
    rush_share,
    weighted_opportunity,
    rush_yards_per_attempt,
    rush_attempts_redzone: stats.rush_attempts_redzone,
    rush_attempts_goaline: stats.rush_attempts_goaline
  }
}

const generate_receiving_gamelog = ({
  player_gamelog,
  stats,
  team_gamelog_inserts,
  player_receiving_gamelog_inserts,
  player_routes_by_game,
  team_dropbacks_by_game,
  dry_run = false
}) => {
  const player_routes =
    player_routes_by_game[`${player_gamelog.pid}_${player_gamelog.esbid}`] ||
    null

  if (
    player_gamelog.rec > 0 ||
    player_gamelog.recy > 0 ||
    player_gamelog.trg > 0 ||
    player_routes > 0
  ) {
    const team_gamelog = find_team_gamelog({
      team_gamelog_inserts,
      team: player_gamelog.tm,
      esbid: player_gamelog.esbid
    })
    const team_dropbacks =
      team_dropbacks_by_game[
        `${fixTeam(player_gamelog.tm)}_${player_gamelog.esbid}`
      ] || null
    const receiving_gamelog = format_receiving_gamelog({
      pid: player_gamelog.pid,
      esbid: player_gamelog.esbid,
      year: player_gamelog.year,
      stats,
      team_stats: team_gamelog,
      player_routes,
      team_dropbacks,
      validate: dry_run
    })
    player_receiving_gamelog_inserts.push(receiving_gamelog)
  }
}

const generate_rushing_gamelog = ({
  player_gamelog,
  stats,
  team_gamelog_inserts,
  player_rushing_gamelog_inserts
}) => {
  if (player_gamelog.ra > 0) {
    const team_gamelog = find_team_gamelog({
      team_gamelog_inserts,
      team: player_gamelog.tm,
      esbid: player_gamelog.esbid
    })
    const rushing_gamelog = format_rushing_gamelog({
      pid: player_gamelog.pid,
      esbid: player_gamelog.esbid,
      year: player_gamelog.year,
      stats,
      team_stats: team_gamelog
    })
    player_rushing_gamelog_inserts.push(rushing_gamelog)
  }
}

/**
 * Generate gamelogs for players who played snaps but didn't record any counting stats
 * This ensures all active players have gamelogs, even if they had 0 targets, 0 carries, etc.
 */
const generate_snap_based_gamelogs = async ({
  unique_esbids,
  year,
  player_gamelog_inserts
}) => {
  log('Checking for players with snaps but no stats...')

  const players_with_snaps = await db('nfl_snaps')
    .select(
      'player.pid',
      'player.pos',
      'player.current_nfl_team',
      'nfl_snaps.esbid'
    )
    .join('player', 'player.gsis_it_id', 'nfl_snaps.gsis_it_id')
    .whereIn('nfl_snaps.esbid', unique_esbids)
    .where('nfl_snaps.year', year)
    .groupBy(
      'player.pid',
      'player.pos',
      'player.current_nfl_team',
      'nfl_snaps.esbid'
    )
    .havingRaw('COUNT(*) > 0')

  log(`Found ${players_with_snaps.length} players with snap data`)

  const games_by_esbid = await db('nfl_games')
    .whereIn('esbid', unique_esbids)
    .then((games) =>
      games.reduce((acc, game) => {
        acc[game.esbid] = game
        return acc
      }, {})
    )

  let added_count = 0
  for (const snap_player of players_with_snaps) {
    const already_has_gamelog = player_gamelog_inserts.some(
      (gamelog) =>
        gamelog.pid === snap_player.pid && gamelog.esbid === snap_player.esbid
    )

    if (!already_has_gamelog) {
      const game = games_by_esbid[snap_player.esbid]
      if (!game) {
        log(`Warning: Could not find game for esbid ${snap_player.esbid}`)
        continue
      }

      const team = fixTeam(snap_player.current_nfl_team)
      const opponent = calculate_opponent({
        team,
        home_team: game.h,
        away_team: game.v
      })

      player_gamelog_inserts.push({
        esbid: snap_player.esbid,
        pid: snap_player.pid,
        pos: snap_player.pos,
        tm: team,
        opp: opponent,
        year,
        active: true
        // All counting stats default to NULL/0
      })
      added_count++
    }
  }

  log(
    `Added ${added_count} snap-based gamelogs for players without counting stats`
  )

  return added_count
}

/**
 * Load player routes data for given games
 */
const load_player_routes = async ({ unique_esbids, year }) => {
  const player_routes_query = await db('player_receiving_gamelogs')
    .select('pid', 'esbid', 'routes')
    .whereIn('esbid', unique_esbids)
    .where({ year })
    .whereNotNull('routes')

  log(`loaded routes data for ${player_routes_query.length} players`)

  return create_lookup_map({
    items: player_routes_query,
    key_fields: ['pid', 'esbid'],
    value_field: 'routes'
  })
}

/**
 * Load team dropbacks data for given games
 * Note: qb_dropback field is populated by scripts/import-plays-nflfastr.mjs
 * If qb_dropback data is missing/incomplete for some games, route_share will be
 * set to null when team_dropbacks < player_routes (see format_receiving_gamelog)
 */
const load_team_dropbacks = async ({ unique_esbids }) => {
  const team_dropbacks_query = await db('nfl_plays')
    .select('pos_team as tm', 'esbid')
    .count('* as dropbacks')
    .whereIn('esbid', unique_esbids)
    .where({ qb_dropback: true })
    .whereNot({ play_type: 'NOPL' })
    .groupBy('pos_team', 'esbid')

  log(`loaded dropback counts for ${team_dropbacks_query.length} team-games`)

  return team_dropbacks_query.reduce((acc, row) => {
    acc[`${fixTeam(row.tm)}_${row.esbid}`] = parseInt(row.dropbacks, 10)
    return acc
  }, {})
}

/**
 * Process player gamelogs from play stats grouped by player identifier
 */
const process_player_gamelogs = ({
  play_stats_by_player,
  player_rows,
  player_identifier_field,
  team_gamelog_inserts,
  player_gamelog_inserts,
  player_receiving_gamelog_inserts,
  player_rushing_gamelog_inserts,
  player_routes_by_game,
  team_dropbacks_by_game,
  processed_player_ids,
  dry_run
}) => {
  for (const player_id of Object.keys(play_stats_by_player)) {
    if (player_id === 'null') continue

    const player_row = player_rows.find(
      (p) => p[player_identifier_field] === player_id
    )
    if (!player_row) {
      log(`missing player for ${player_identifier_field}: ${player_id}`)
      continue
    }

    // Skip if already processed via gsispid
    if (
      player_identifier_field === 'gsisid' &&
      player_row.gsispid &&
      processed_player_ids.includes(player_row.gsispid)
    ) {
      continue
    }

    const play_stat = play_stats_by_player[player_id].find((p) => p.clubCode)
    if (!play_stat) continue

    const opp = calculate_opponent({
      team: play_stat.clubCode,
      home_team: play_stat.h,
      away_team: play_stat.v
    })

    const stats = calculateStatsFromPlayStats(play_stats_by_player[player_id])

    if (player_identifier_field === 'gsispid') {
      processed_player_ids.push(player_id)
    }

    const player_gamelog = format_player_gamelog({
      pid: player_row.pid,
      pos: player_row.pos,
      tm: fixTeam(play_stat.clubCode),
      opp,
      esbid: play_stat.esbid,
      year: play_stat.year,
      stats
    })
    player_gamelog_inserts.push(player_gamelog)

    generate_receiving_gamelog({
      player_gamelog,
      stats,
      team_gamelog_inserts,
      player_receiving_gamelog_inserts,
      player_routes_by_game,
      team_dropbacks_by_game,
      dry_run
    })

    generate_rushing_gamelog({
      player_gamelog,
      stats,
      team_gamelog_inserts,
      player_rushing_gamelog_inserts
    })
  }
}

/**
 * Generate team gamelogs from play stats
 */
const generate_team_gamelogs = ({ playStats, team_gamelog_inserts }) => {
  const play_stats_by_team = groupBy(playStats, 'clubCode')

  for (const team of Object.keys(play_stats_by_team)) {
    const team_play_stats = play_stats_by_team[team]
    const team_stats = calculateStatsFromPlayStats(team_play_stats)
    const play_stat = team_play_stats[0]
    const opp = calculate_opponent({
      team,
      home_team: play_stat.h,
      away_team: play_stat.v
    })

    // TODO format to match table schema
    const team_gamelog = {
      ...team_stats,
      esbid: play_stat.esbid,
      tm: fixTeam(team),
      opp,
      year: play_stat.year
    }
    team_gamelog_inserts.push(team_gamelog)
  }
}

/**
 * Generate defense/special teams gamelogs
 */
const generate_defense_gamelogs = ({ playStats, player_gamelog_inserts }) => {
  for (const team of nfl_team_abbreviations) {
    const opponentPlays = playStats.filter((p) => {
      if (fixTeam(p.h) !== team && fixTeam(p.v) !== team) {
        return false
      }

      return (
        (Boolean(p.pos_team) && fixTeam(p.pos_team) !== team) ||
        p.play_type_nfl === 'PUNT' ||
        p.play_type_nfl === 'KICK_OFF' ||
        p.play_type_nfl === 'XP_KICK'
      )
    })
    if (!opponentPlays.length) continue

    const play = opponentPlays[0]
    const opp = fixTeam(play.h) === team ? play.v : play.h
    const groupedPlays = groupBy(opponentPlays, 'playId')
    const formattedPlays = []
    for (const playId in groupedPlays) {
      const playStats = groupedPlays[playId]
      const p = playStats[0]
      formattedPlays.push({
        pos_team: p.pos_team,
        drive_play_count: p.drive_play_count,
        play_type_nfl: p.play_type_nfl,
        playStats
      })
    }
    const stats = calculateDstStatsFromPlays(formattedPlays, team)
    const player_gamelog = format_player_gamelog({
      pid: team,
      pos: 'DST',
      tm: team,
      esbid: play.esbid,
      year: play.year,
      opp: fixTeam(opp),
      stats
    })
    player_gamelog_inserts.push(player_gamelog)
  }
}

/**
 * Save gamelogs to database
 */
const save_gamelogs = async ({
  player_gamelog_inserts,
  player_receiving_gamelog_inserts,
  player_rushing_gamelog_inserts,
  dry_run
}) => {
  if (player_gamelog_inserts.length) {
    await batch_insert({
      items: player_gamelog_inserts,
      save: async (batch) => {
        await db('player_gamelogs')
          .insert(batch)
          .onConflict(['esbid', 'pid', 'year'])
          .merge()
      },
      batch_size: 500
    })
    log(`Updated ${player_gamelog_inserts.length} gamelogs`)
  }

  if (player_receiving_gamelog_inserts.length) {
    // Clamp values to prevent database overflow
    let clamped_count = 0
    for (const item of player_receiving_gamelog_inserts) {
      if (clamp_receiving_gamelog_values({ item, dry_run })) {
        clamped_count++
      }
    }

    if (clamped_count > 0 && !dry_run) {
      log(
        `Clamped ${clamped_count} receiving gamelog items to prevent database overflow`
      )
    }

    await batch_insert({
      items: player_receiving_gamelog_inserts,
      save: async (batch) => {
        await db('player_receiving_gamelogs')
          .insert(batch)
          .onConflict(['esbid', 'pid', 'year'])
          .merge()
      },
      batch_size: 500
    })
    log(`Updated ${player_receiving_gamelog_inserts.length} receiving gamelogs`)
  }

  if (player_rushing_gamelog_inserts.length) {
    await batch_insert({
      items: player_rushing_gamelog_inserts,
      save: async (batch) => {
        await db('player_rushing_gamelogs')
          .insert(batch)
          .onConflict(['esbid', 'pid', 'year'])
          .merge()
      },
      batch_size: 500
    })
    log(`Updated ${player_rushing_gamelog_inserts.length} rushing gamelogs`)
  }

  // Insert team gamelogs
  // TODO
  // if (team_gamelog_inserts.length) {
  //   await batch_insert({
  //     items: team_gamelog_inserts,
  //     save: async (batch) => {
  //       await db('team_gamelogs')
  //         .insert(batch)
  //         .onConflict(['esbid', 'tm', 'year'])
  //         .merge()
  //     },
  //     batch_size: 500
  //   })
  //   log(`Updated ${team_gamelog_inserts.length} team gamelogs`)
  // }
}

/**
 * Generate player gamelogs from play-by-play data
 *
 * This script processes NFL play data to create comprehensive player gamelogs including:
 * - Basic player stats (passing, rushing, receiving)
 * - Advanced receiving metrics (routes, target share, etc.)
 * - Advanced rushing metrics (rush share, opportunity, etc.)
 * - Team aggregates
 * - Defense/special teams stats
 * - Snap-based gamelogs for players without counting stats
 *
 * @param {number} week - Week number to process
 * @param {number} year - Season year
 * @param {string} seas_type - Season type (REG, PRE, POST)
 * @param {boolean} dry_run - If true, shows what would be generated without saving
 */
const generate_player_gamelogs = async ({
  week = current_season.last_week_with_stats,
  year = current_season.year,
  seas_type = current_season.nfl_seas_type,
  esbid = null,
  dry_run = false
}) => {
  log(
    `loading plays for ${year} week ${week}${esbid ? ` (esbid: ${esbid})` : ''}`
  )

  const playStats = await get_play_stats({ year, week, seas_type })
  let unique_esbids = [...new Set(playStats.map((p) => p.esbid))]

  // Filter to specific game if esbid provided
  if (esbid) {
    unique_esbids = unique_esbids.filter((id) => id === esbid)
  }

  log(`loaded play stats for ${unique_esbids.length} games`)
  log(unique_esbids.join(', '))

  // Load supporting data
  const player_routes_by_game = await load_player_routes({
    unique_esbids,
    year
  })
  const team_dropbacks_by_game = await load_team_dropbacks({ unique_esbids })

  // Initialize collections
  const player_gamelog_inserts = []
  const player_receiving_gamelog_inserts = []
  const player_rushing_gamelog_inserts = []
  const team_gamelog_inserts = []

  // Generate team gamelogs
  generate_team_gamelogs({ playStats, team_gamelog_inserts })

  // Load player data
  const play_stats_by_gsispid = groupBy(playStats, 'gsispid')
  const gsispids = Object.keys(play_stats_by_gsispid)
  const player_gsispid_rows = await db('player').whereIn('gsispid', gsispids)
  log(
    `loaded play stats for ${Object.keys(play_stats_by_gsispid).length} gsispid players`
  )

  const play_stats_by_gsisid = groupBy(playStats, 'gsisId')
  const gsisids = Object.keys(play_stats_by_gsisid)
  const player_gsisid_rows = await db('player').whereIn('gsisid', gsisids)
  log(
    `loaded play stats for ${Object.keys(play_stats_by_gsisid).length} gsisid players`
  )

  // Process player gamelogs (gsispid first, then gsisid for players not found via gsispid)
  const processed_gsispids = []
  process_player_gamelogs({
    play_stats_by_player: play_stats_by_gsispid,
    player_rows: player_gsispid_rows,
    player_identifier_field: 'gsispid',
    team_gamelog_inserts,
    player_gamelog_inserts,
    player_receiving_gamelog_inserts,
    player_rushing_gamelog_inserts,
    player_routes_by_game,
    team_dropbacks_by_game,
    processed_player_ids: processed_gsispids,
    dry_run
  })

  process_player_gamelogs({
    play_stats_by_player: play_stats_by_gsisid,
    player_rows: player_gsisid_rows,
    player_identifier_field: 'gsisid',
    team_gamelog_inserts,
    player_gamelog_inserts,
    player_receiving_gamelog_inserts,
    player_rushing_gamelog_inserts,
    player_routes_by_game,
    team_dropbacks_by_game,
    processed_player_ids: processed_gsispids,
    dry_run
  })

  // Generate defense/special teams gamelogs
  generate_defense_gamelogs({ playStats, player_gamelog_inserts })

  // Generate gamelogs for players who played snaps but didn't record any counting stats
  await generate_snap_based_gamelogs({
    unique_esbids,
    year,
    player_gamelog_inserts
  })

  if (dry_run) {
    log(player_gamelog_inserts[0])
    log(player_receiving_gamelog_inserts[0])
    log(player_rushing_gamelog_inserts[0])
    log(team_gamelog_inserts[0])
    log(
      `Generated ${player_gamelog_inserts.length} player gamelogs, ${player_receiving_gamelog_inserts.length} receiving gamelogs, ${player_rushing_gamelog_inserts.length} rushing gamelogs, and ${team_gamelog_inserts.length} team gamelogs for ${year} week ${week}`
    )
    return
  }

  await save_gamelogs({
    player_gamelog_inserts,
    player_receiving_gamelog_inserts,
    player_rushing_gamelog_inserts,
    dry_run
  })
}

const main = async () => {
  const argv = initialize_cli()
  let error
  try {
    await handle_season_args_for_script({
      argv,
      script_name: 'generate-player-gamelogs',
      script_function: generate_player_gamelogs,
      year_query: ({ seas_type = 'REG' }) =>
        db('nfl_games')
          .select('year')
          .where({ seas_type })
          .groupBy('year')
          .orderBy('year', 'asc'),
      week_query: ({ year, seas_type = 'REG' }) =>
        db('nfl_games')
          .select('week')
          .where({ year, seas_type })
          .groupBy('week')
          .orderBy('week', 'asc'),
      script_args: {
        dry_run: argv.dry,
        esbid: argv.esbid
      },
      seas_type: argv.seas_type
    })
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.GENERATE_PLAYER_GAMELOGS,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default generate_player_gamelogs
