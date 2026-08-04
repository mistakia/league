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
  nfl_team_abbreviations,
  nfl_season_types
} from '#constants'
import { get_play_stats } from '#libs-server/play-stats-utils.mjs'
import { merge_columns_on_conflict } from '#libs-server/merge-columns-on-conflict.mjs'
import { resolve_play_stat_player } from '#libs-server/resolve-play-stat-player.mjs'
import { player_could_have_played } from '#libs-server/player-era.mjs'
import handle_season_args_for_script from '#libs-server/handle-season-args-for-script.mjs'

const initialize_cli = () => {
  return (
    yargs(hideBin(process.argv))
      .option('esbid', {
        type: 'string',
        describe: 'Generate gamelogs for a specific game ID only'
      })
      // `seasType` was never declared, and yargs' camel-case expansion maps
      // `--seas-type` but NOT `--seas_type` -- so the underscore spelling, which
      // is what every other flag and every column in this repo uses, silently
      // parsed to a key nothing read and left the run on the REG default. A
      // 298-game preseason-inclusive backfill lost all 47 of its PRE games that
      // way: each threw "no play stats for esbid", the throw was caught by
      // handle_season_args_for_script, and the process still exited 0. Declaring
      // the alias makes both spellings work; `choices` makes a typo loud.
      .option('seasType', {
        alias: 'seas_type',
        type: 'string',
        choices: nfl_season_types,
        describe: 'Season type (PRE, REG, POST)'
      })
      .parse()
  )
}

const log = debug('generate-player-gamelogs')
// Guarded because `debug.enable` REPLACES the enabled namespace set rather than
// adding to it, so an unguarded call at module scope silences every other
// namespace in any process that imports this file -- including the spec run.
if (!process.env.DEBUG) {
  debug.enable('generate-player-gamelogs')
}

// Database field constraints
const DB_CONSTRAINTS = {
  TEAM_TARGET_SHARE_MAX: 9.9999, // numeric(5,4)
  TEAM_AIR_YARD_SHARE_MAX: 9.9999, // numeric(5,4)
  ROUTE_SHARE_MAX: 999.99, // numeric(5,2)
  WEIGHTED_OPPORTUNITY_RATING_MAX: 999.99 // numeric(5,2)
}

// Map of nfl_play_stats stat_id to the role _pid column on nfl_plays that
// identifies the player credited by that stat. Used to recover player identity
// when the play_stat row itself carries empty gsis_player_id / smart_player_id
// (e.g. when the upstream feed never had a gsis ID for the player). stat_ids
// that do not attribute a player (team-level rows, special-teams stats whose
// player already lives in dedicated nfl_plays columns like
// kicker/punter/returner) are intentionally omitted.
const STAT_ID_TO_ROLE_PID_COLUMN = {
  10: 'ball_carrier_pid',
  11: 'ball_carrier_pid',
  14: 'passer_pid',
  15: 'passer_pid',
  16: 'passer_pid',
  19: 'passer_pid',
  20: 'passer_pid',
  21: 'target_pid',
  22: 'target_pid',
  25: 'interceptor_pid',
  26: 'interceptor_pid',
  52: 'player_fuml_pid',
  53: 'player_fuml_pid',
  54: 'player_fuml_pid',
  106: 'player_fuml_pid',
  111: 'passer_pid',
  112: 'passer_pid',
  113: 'target_pid',
  115: 'target_pid'
}

const patch_play_stats_from_role_pid = async (playStats) => {
  const needs_fallback = playStats.filter(
    (ps) =>
      !ps.smart_player_id &&
      !ps.gsis_player_id &&
      STAT_ID_TO_ROLE_PID_COLUMN[ps.stat_id]
  )
  if (!needs_fallback.length) return

  const pids_set = new Set()
  for (const ps of needs_fallback) {
    const pid = ps[STAT_ID_TO_ROLE_PID_COLUMN[ps.stat_id]]
    if (pid) pids_set.add(pid)
  }
  if (!pids_set.size) return

  const players = await db('player')
    .select('pid', 'gsis_player_id', 'smart_player_id')
    .whereIn('pid', [...pids_set])
  const player_by_pid = new Map(players.map((p) => [p.pid, p]))

  let patched = 0
  for (const ps of needs_fallback) {
    const pid = ps[STAT_ID_TO_ROLE_PID_COLUMN[ps.stat_id]]
    if (!pid) continue
    const player = player_by_pid.get(pid)
    if (!player) continue
    if (player.gsis_player_id) ps.gsis_player_id = player.gsis_player_id
    if (player.smart_player_id) ps.smart_player_id = player.smart_player_id
    if (ps.gsis_player_id || ps.smart_player_id) patched++
  }
  log(
    `id fallback from nfl_plays._pid: patched ${patched}/${needs_fallback.length} play_stats`
  )
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
    (t) => t.nfl_team === fixTeam(team) && t.esbid === esbid
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

const format_base_gamelog = ({
  esbid,
  stats,
  opponent_nfl_team,
  nfl_team,
  season_year
}) => {
  const cleaned_stats = Object.keys(stats)
    .filter((key) => all_fantasy_stats.includes(key))
    .reduce((obj, key) => {
      obj[key] = stats[key]
      return obj
    }, {})

  return {
    esbid,
    nfl_team,
    opponent_nfl_team,
    season_year,
    ...cleaned_stats
  }
}

// Stat provenance for a gamelog this script derived from play stats, and the
// ownership key the prune below is scoped by. `import-nflverse-weekly-rosters`
// established the convention: `player_gamelogs.source` names the writer of
// record, and that writer deletes-then-inserts its own rows by (year, source)
// so a rerun is idempotent and a row it no longer supports goes away.
//
// This script had no such key until 2026-08-04, which is why it could only ever
// add. When an identity repair upstream stopped a row being produced, the row
// simply stayed: clearing 36 stolen `smart_player_id` encodings in league
// a966d7fbd corrected the cause and moved the misattributed-gamelog count by
// zero, because 1,559 rows across 37 players were already written and nothing
// retracts. Stamping the source is what lets a regeneration be a correction
// rather than an accumulation.
export const PLAY_STATS_GAMELOG_SOURCE = 'play-stats'

const format_player_gamelog = ({
  esbid,
  pid,
  stats,
  opponent_nfl_team,
  pos,
  nfl_team,
  season_year
}) => {
  return {
    ...format_base_gamelog({
      esbid,
      stats,
      opponent_nfl_team,
      nfl_team,
      season_year
    }),
    pid,
    pos,
    active: true,
    source: PLAY_STATS_GAMELOG_SOURCE
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
  const team_target_share = team_stats.targets
    ? stats.targets / team_stats.targets
    : 0
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
    season_year: year,
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
      log(
        `  stats.targets=${stats.targets}, team_stats.targets=${team_stats.targets}`
      )
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
  const rush_share = team_stats.rushing_attempts
    ? stats.rushing_attempts / team_stats.rushing_attempts
    : null
  const weighted_opportunity =
    1.3 * stats.rush_attempts_redzone +
    2.25 * stats.redzone_targets +
    0.48 * (stats.rushing_attempts - stats.rush_attempts_redzone) +
    1.43 * (stats.targets - stats.redzone_targets)
  const rush_yards_per_attempt = stats.rushing_yards / stats.rushing_attempts

  return {
    esbid,
    pid,
    season_year: year,
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
    player_gamelog.receptions > 0 ||
    player_gamelog.receiving_yards > 0 ||
    player_gamelog.targets > 0 ||
    player_routes > 0
  ) {
    const team_gamelog = find_team_gamelog({
      team_gamelog_inserts,
      team: player_gamelog.nfl_team,
      esbid: player_gamelog.esbid
    })
    const team_dropbacks =
      team_dropbacks_by_game[
        `${fixTeam(player_gamelog.nfl_team)}_${player_gamelog.esbid}`
      ] || null
    const receiving_gamelog = format_receiving_gamelog({
      pid: player_gamelog.pid,
      esbid: player_gamelog.esbid,
      year: player_gamelog.season_year,
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
  if (player_gamelog.rushing_attempts > 0) {
    const team_gamelog = find_team_gamelog({
      team_gamelog_inserts,
      team: player_gamelog.nfl_team,
      esbid: player_gamelog.esbid
    })
    const rushing_gamelog = format_rushing_gamelog({
      pid: player_gamelog.pid,
      esbid: player_gamelog.esbid,
      year: player_gamelog.season_year,
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

  const snap_candidates = await db('nfl_snaps')
    .select(
      'player.pid',
      'player.primary_position',
      'player.current_nfl_team',
      'player.smart_player_id',
      'player.nfl_draft_year',
      'player.draft_round',
      'player.date_of_birth',
      'nfl_snaps.esbid'
    )
    .join('player', 'player.gsis_it_player_id', 'nfl_snaps.gsis_it_id')
    .whereIn('nfl_snaps.esbid', unique_esbids)
    .where('nfl_snaps.season_year', year)
    .groupBy(
      'player.pid',
      'player.primary_position',
      'player.current_nfl_team',
      'player.smart_player_id',
      'player.nfl_draft_year',
      'player.draft_round',
      'player.date_of_birth',
      'nfl_snaps.esbid'
    )
    .havingRaw('COUNT(*) > 0')

  // This join is a third identifier column that can name the wrong player, and
  // it needs the same falsifier as the two on `nfl_play_stats`. `player`
  // carries a `gsis_it_player_id` that belongs to an earlier player of the same
  // name in at least this many cases: the 2022 devin taylor holds 40080, whose
  // snaps are all 2016-2017 and belong to the 2013 devin taylor. Without this
  // filter the snap path writes that gamelog no matter what the play-stat
  // resolver decided, since it never consults it.
  const players_with_snaps = snap_candidates.filter((candidate) =>
    player_could_have_played({ player: candidate, season_year: year })
  )

  const era_rejected = snap_candidates.length - players_with_snaps.length
  log(
    `Found ${players_with_snaps.length} players with snap data` +
      (era_rejected
        ? `, ${era_rejected} rejected as not yet in the league`
        : '')
  )

  // Query existing gamelogs to get correct historical team data
  const existing_gamelogs = await db('player_gamelogs')
    .select('pid', 'esbid', 'nfl_team')
    .whereIn('esbid', unique_esbids)
    .whereNotNull('nfl_team')
    .whereNot('nfl_team', '')

  const existing_gamelog_team_map = existing_gamelogs.reduce((acc, gl) => {
    acc[`${gl.pid}_${gl.esbid}`] = gl.nfl_team
    return acc
  }, {})

  log(
    `Found ${existing_gamelogs.length} existing gamelogs with team data for historical lookup`
  )

  // Query nfl_play_stats for historical team data as fallback
  const play_stats_teams = await db('nfl_play_stats')
    .select('smart_player_id', 'esbid')
    .max('nfl_team as team')
    .whereIn('esbid', unique_esbids)
    .whereNotNull('nfl_team')
    .whereNot('nfl_team', '')
    .groupBy('smart_player_id', 'esbid')

  const play_stats_team_map = play_stats_teams.reduce((acc, ps) => {
    acc[`${ps.smart_player_id}_${ps.esbid}`] = ps.team
    return acc
  }, {})

  log(
    `Found ${play_stats_teams.length} play_stats records with team data for historical lookup`
  )

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

      // Priority: 1) existing gamelog tm, 2) play_stats nfl_team, 3) current_nfl_team (fallback)
      const gamelog_lookup_key = `${snap_player.pid}_${snap_player.esbid}`
      const play_stats_lookup_key = `${snap_player.smart_player_id}_${snap_player.esbid}`
      const existing_team = existing_gamelog_team_map[gamelog_lookup_key]
      const play_stats_team = play_stats_team_map[play_stats_lookup_key]

      const team = fixTeam(
        existing_team || play_stats_team || snap_player.current_nfl_team
      )
      const opponent = calculate_opponent({
        team,
        home_team: game.home_nfl_team,
        away_team: game.away_nfl_team
      })

      player_gamelog_inserts.push({
        esbid: snap_player.esbid,
        pid: snap_player.pid,
        pos: snap_player.primary_position,
        nfl_team: team,
        opponent_nfl_team: opponent,
        season_year: year,
        active: true,
        source: PLAY_STATS_GAMELOG_SOURCE
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
    .where({ season_year: year })
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
    .select('possession_nfl_team as tm', 'esbid')
    .count('* as dropbacks')
    .whereIn('esbid', unique_esbids)
    .where({ qb_dropback: true })
    .whereNot({ play_type: 'NOPL' })
    .groupBy('possession_nfl_team', 'esbid')

  log(`loaded dropback counts for ${team_dropbacks_query.length} team-games`)

  return team_dropbacks_query.reduce((acc, row) => {
    acc[`${fixTeam(row.tm)}_${row.esbid}`] = parseInt(row.dropbacks, 10)
    return acc
  }, {})
}

/**
 * Group play stats by the player each row resolves to.
 *
 * Replaces the two-pass structure this script carried until 2026-08-04, which
 * grouped by `smart_player_id`, then by `gsis_player_id`, and SKIPPED any group
 * in the second pass whose player had already been seen in the first. The skip
 * existed to avoid emitting a duplicate gamelog, but it discarded the group's
 * stats rather than merging them, so a row carrying only a `gsis_player_id`,
 * for a player who had any other row in the same game, was never counted:
 * 31,945 rows overall, 499 of them on stats the calculator acts on.
 *
 * Resolving identity BEFORE grouping removes both the second pass and its
 * exclusion list, because one player is now one group by construction.
 */
export const group_play_stats_by_pid = ({
  playStats,
  players_by_smart_player_id,
  players_by_gsis_player_id
}) => {
  const play_stats_by_pid = new Map()
  const unresolved_by_tier = { unidentified: 0, conflicting: 0 }

  for (const play_stat of playStats) {
    const resolution = resolve_play_stat_player({
      play_stat,
      players_by_smart_player_id,
      players_by_gsis_player_id,
      season_year: play_stat.year
    })

    if (!resolution) {
      // A row naming no player at all is ordinary (team-level stats); a row
      // naming two the tiers cannot separate is not, and is worth counting
      // separately so a regression in identity data is visible here.
      const names_a_player =
        Boolean(play_stat.smart_player_id) || Boolean(play_stat.gsis_player_id)
      if (names_a_player) unresolved_by_tier.conflicting++
      else unresolved_by_tier.unidentified++
      continue
    }

    const group = play_stats_by_pid.get(resolution.pid)
    if (group) group.push(play_stat)
    else play_stats_by_pid.set(resolution.pid, [play_stat])
  }

  log(
    `resolved play stats to ${play_stats_by_pid.size} players; ` +
      `${unresolved_by_tier.unidentified} rows name no player, ` +
      `${unresolved_by_tier.conflicting} name two that could not be separated`
  )

  return play_stats_by_pid
}

/**
 * Process player gamelogs from play stats grouped by resolved pid
 */
const process_player_gamelogs = ({
  play_stats_by_pid,
  players_by_pid,
  team_gamelog_inserts,
  player_gamelog_inserts,
  player_receiving_gamelog_inserts,
  player_rushing_gamelog_inserts,
  player_routes_by_game,
  team_dropbacks_by_game,
  dry_run
}) => {
  for (const [pid, group] of play_stats_by_pid) {
    const player_row = players_by_pid.get(pid)
    if (!player_row) {
      log(`missing player for pid: ${pid}`)
      continue
    }

    const play_stat = group.find((p) => p.nfl_team)
    if (!play_stat) continue

    const opp = calculate_opponent({
      team: play_stat.nfl_team,
      home_team: play_stat.home_nfl_team,
      away_team: play_stat.away_nfl_team
    })

    const stats = calculateStatsFromPlayStats(group)

    const player_gamelog = format_player_gamelog({
      pid: player_row.pid,
      pos: player_row.primary_position,
      nfl_team: fixTeam(play_stat.nfl_team),
      opponent_nfl_team: opp,
      esbid: play_stat.esbid,
      season_year: play_stat.year,
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
  const play_stats_by_team = groupBy(playStats, 'nfl_team')

  for (const team of Object.keys(play_stats_by_team)) {
    const team_play_stats = play_stats_by_team[team]
    const team_stats = calculateStatsFromPlayStats(team_play_stats)
    const play_stat = team_play_stats[0]
    const opp = calculate_opponent({
      team,
      home_team: play_stat.home_nfl_team,
      away_team: play_stat.away_nfl_team
    })

    // TODO format to match table schema
    const team_gamelog = {
      ...team_stats,
      esbid: play_stat.esbid,
      nfl_team: fixTeam(team),
      opponent_nfl_team: opp,
      season_year: play_stat.year
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
      if (
        fixTeam(p.home_nfl_team) !== team &&
        fixTeam(p.away_nfl_team) !== team
      ) {
        return false
      }

      return (
        (Boolean(p.possession_nfl_team) &&
          fixTeam(p.possession_nfl_team) !== team) ||
        p.play_type_nfl === 'PUNT' ||
        p.play_type_nfl === 'KICK_OFF' ||
        p.play_type_nfl === 'XP_KICK'
      )
    })
    if (!opponentPlays.length) continue

    const play = opponentPlays[0]
    const opp =
      fixTeam(play.home_nfl_team) === team
        ? play.away_nfl_team
        : play.home_nfl_team
    const groupedPlays = groupBy(opponentPlays, 'play_id')
    const formattedPlays = []
    for (const playId in groupedPlays) {
      const playStats = groupedPlays[playId]
      const p = playStats[0]
      formattedPlays.push({
        possession_nfl_team: p.possession_nfl_team,
        drive_play_count: p.drive_play_count,
        play_type_nfl: p.play_type_nfl,
        playStats
      })
    }
    const stats = calculateDstStatsFromPlays(formattedPlays, team)
    const player_gamelog = format_player_gamelog({
      pid: team,
      pos: 'DST',
      nfl_team: team,
      esbid: play.esbid,
      season_year: play.year,
      opponent_nfl_team: fixTeam(opp),
      stats
    })
    player_gamelog_inserts.push(player_gamelog)
  }
}

/**
 * Save gamelogs to database
 */
// `active` is owned by import-nflverse-weekly-rosters.mjs; see
// libs-server/merge-columns-on-conflict.mjs for why it is held out of the
// UPDATE half. `pos` was held out too while the position vocabulary was
// uncontrolled -- a regenerate would have rewritten it from one unnormalized
// snapshot to another. The vocabulary is canonical and CHECK-constrained now,
// so a regenerate can only write the same value.
export const GAMELOG_COLUMNS_NOT_MERGED = ['active']

/**
 * Delete the gamelogs this run owns but no longer produces.
 *
 * Without this the script can only ever add, so a row whose attribution has
 * since been falsified survives every regeneration -- see
 * PLAY_STATS_GAMELOG_SOURCE above for the incident that made the cost concrete.
 *
 * Three things bound the delete, and all three matter:
 *
 *   - OWNERSHIP. A row is this script's to retract if it carries this script's
 *     `source`, or if it carries counting stats. The second half is what makes
 *     the prune work at all: `source` is only ever stamped on a row this script
 *     PRODUCES, so a row it has stopped producing -- exactly the row needing
 *     pruning -- would never carry the stamp, and a `source`-only rule could
 *     not reclaim a single one of the 885,617 rows written before the stamp
 *     existed. Counting stats are the durable ownership signal: the roster
 *     importers write roster status and never a stat, so a stat-bearing row can
 *     only have come from a play-stat build.
 *   - `esbid` scopes it to games this run actually loaded play stats for, so a
 *     single-week or single-game run cannot touch anything outside its window.
 *   - a game the run produced NO rows for is skipped entirely. That is the
 *     signature of a run that failed to resolve rather than of a game whose
 *     rows are all stale, and deleting on it would turn a resolution
 *     regression into data loss.
 *
 * A row carrying neither this script's `source` nor a participation column is
 * never touched under any of the three. That is deliberately conservative and
 * it is NOT the same as "it belongs to a roster importer": until the default
 * was dropped, `player_gamelogs.source` defaulted to 'nfl-pro-gameday-roster',
 * so a row that named no writer was silently tagged with that importer's name
 * whatever wrote it. Reading such a row's `source` as provenance is what led a
 * 2026-08-04 audit to call 262 stat-free rows a fourth ingestion mechanism when
 * 11 of the 19 players involved have a null `gsis_it_player_id` and so cannot
 * be resolved by that importer at all. Leaving the row alone stays right; the
 * inference about who wrote it does not.
 */

// Columns whose presence proves a row records PARTICIPATION -- that the player
// was on the field -- rather than roster membership. The roster importers write
// gameday status and never one of these, so a row carrying any of them was
// built from play stats or from snaps, which are this script's two inputs.
//
// The snap columns are not optional. A defensive lineman's gamelog routinely
// carries zero in every counting column while carrying 48 defensive snaps, and
// that is precisely the row the snap path above creates -- a counting-stats-only
// rule would have left every one of them unreclaimable.
const OWNED_PARTICIPATION_COLUMNS = [
  'passing_attempts',
  'rushing_attempts',
  'targets',
  'receptions',
  'defensive_sacks',
  'defensive_interceptions',
  'field_goals_made',
  'extra_points_made',
  'snaps_off',
  'snaps_def',
  'snaps_st'
]
const prune_unreferenced_gamelogs = async ({
  unique_esbids,
  player_gamelog_inserts,
  dry_run
}) => {
  const produced_by_esbid = new Map()
  for (const gamelog of player_gamelog_inserts) {
    let pids = produced_by_esbid.get(gamelog.esbid)
    if (!pids) {
      pids = new Set()
      produced_by_esbid.set(gamelog.esbid, pids)
    }
    pids.add(gamelog.pid)
  }

  const prunable_esbids = unique_esbids.filter((esbid) =>
    produced_by_esbid.has(esbid)
  )
  const skipped = unique_esbids.length - prunable_esbids.length
  if (skipped) {
    log(`prune: skipping ${skipped} games this run produced no gamelogs for`)
  }
  if (!prunable_esbids.length) return 0

  const existing = await db('player_gamelogs')
    .select('esbid', 'pid')
    .whereIn('esbid', prunable_esbids)
    .where((builder) => {
      builder.where({ source: PLAY_STATS_GAMELOG_SOURCE })
      for (const column of OWNED_PARTICIPATION_COLUMNS) {
        builder.orWhere(column, '>', 0)
      }
    })

  const stale = existing.filter(
    (row) => !produced_by_esbid.get(row.esbid)?.has(row.pid)
  )

  if (!stale.length) {
    log('prune: no stale gamelogs')
    return 0
  }

  if (dry_run) {
    log(`[DRY RUN] prune would delete ${stale.length} stale gamelogs`)
    return 0
  }

  let deleted = 0
  for (let index = 0; index < stale.length; index += 500) {
    const chunk = stale.slice(index, index + 500)
    // Keyed only on the pairs already vetted by the ownership predicate above;
    // re-applying it here would drop the counting-stat half of the rule.
    deleted += await db('player_gamelogs')
      .whereIn(
        ['esbid', 'pid'],
        chunk.map((row) => [row.esbid, row.pid])
      )
      .del()
  }

  log(`prune: deleted ${deleted} stale gamelogs`)
  return deleted
}

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
          .onConflict(['esbid', 'pid', 'season_year'])
          .merge(
            merge_columns_on_conflict({
              batch,
              exclude: GAMELOG_COLUMNS_NOT_MERGED
            })
          )
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
          .onConflict(['esbid', 'pid', 'season_year'])
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
          .onConflict(['esbid', 'pid', 'season_year'])
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
  dry_run = false,
  collector = null
}) => {
  log(
    `loading plays for ${year} week ${week}${esbid ? ` (esbid: ${esbid})` : ''}`
  )

  const all_play_stats = await get_play_stats({ year, week, seas_type })

  // `--esbid` has to narrow playStats itself, not just unique_esbids: every
  // collection below (player, team, defense gamelogs) is derived from
  // playStats, while unique_esbids only feeds the routes / dropbacks / snap
  // loads. Filtering the latter alone left the flag writing the ENTIRE week
  // while reporting one game, which is the opposite of what a single-game
  // backfill wants. Compared as strings because the CLI option is a string and
  // the column comes back as a number.
  const playStats = esbid
    ? all_play_stats.filter((p) => String(p.esbid) === String(esbid))
    : all_play_stats

  if (esbid && !playStats.length) {
    throw new Error(
      `no play stats for esbid ${esbid} in ${year} week ${week} ${seas_type} -- check the year/week match the game`
    )
  }

  const unique_esbids = [...new Set(playStats.map((p) => p.esbid))]

  log(`loaded play stats for ${unique_esbids.length} games`)
  log(unique_esbids.join(', '))

  // Patch play_stats rows whose upstream-feed identifiers (smart_player_id,
  // gsis_player_id) are empty but whose sibling nfl_plays row has the role _pid resolved (via the
  // sportradar supplemental pass on sportradar_id, or any other enrichment
  // path). Without this, the per-player groupings below skip these rows and
  // counters (ra, py, recv_yds, etc.) under-report for affected players. See
  // user:text/league/data-quality-and-validation.md
  // [plays_excess_residual_after_gsisid_backfill].
  await patch_play_stats_from_role_pid(playStats)

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

  // Load every player either identifier column could name, in one query. The
  // two lookups are Maps rather than the array scan this used to do, which was
  // O(rows x players).
  const smart_player_ids = [
    ...new Set(playStats.map((p) => p.smart_player_id).filter(Boolean))
  ]
  const gsis_player_ids = [
    ...new Set(playStats.map((p) => p.gsis_player_id).filter(Boolean))
  ]
  const player_rows = await db('player')
    .whereIn('smart_player_id', smart_player_ids)
    .orWhereIn('gsis_player_id', gsis_player_ids)

  const players_by_pid = new Map()
  const players_by_smart_player_id = new Map()
  const players_by_gsis_player_id = new Map()
  for (const player_row of player_rows) {
    players_by_pid.set(player_row.pid, player_row)
    if (player_row.smart_player_id)
      players_by_smart_player_id.set(player_row.smart_player_id, player_row)
    if (player_row.gsis_player_id)
      players_by_gsis_player_id.set(player_row.gsis_player_id, player_row)
  }
  log(`loaded ${player_rows.length} players for play stat resolution`)

  const play_stats_by_pid = group_play_stats_by_pid({
    playStats,
    players_by_smart_player_id,
    players_by_gsis_player_id
  })

  process_player_gamelogs({
    play_stats_by_pid,
    players_by_pid,
    team_gamelog_inserts,
    player_gamelog_inserts,
    player_receiving_gamelog_inserts,
    player_rushing_gamelog_inserts,
    player_routes_by_game,
    team_dropbacks_by_game,
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

  // Hand the caller the generated rows before any write, so a before/after
  // comparison of a generator change can diff them column by column without
  // touching the database. The parameter existed but was never read.
  if (collector) {
    collector({
      player_gamelog_inserts,
      player_receiving_gamelog_inserts,
      player_rushing_gamelog_inserts,
      team_gamelog_inserts
    })
  }

  if (dry_run) {
    log(player_gamelog_inserts[0])
    log(player_receiving_gamelog_inserts[0])
    log(player_rushing_gamelog_inserts[0])
    log(team_gamelog_inserts[0])
    log(
      `Generated ${player_gamelog_inserts.length} player gamelogs, ${player_receiving_gamelog_inserts.length} receiving gamelogs, ${player_rushing_gamelog_inserts.length} rushing gamelogs, and ${team_gamelog_inserts.length} team gamelogs for ${year} week ${week}`
    )
    await prune_unreferenced_gamelogs({
      unique_esbids,
      player_gamelog_inserts,
      dry_run
    })
    return
  }

  await save_gamelogs({
    player_gamelog_inserts,
    player_receiving_gamelog_inserts,
    player_rushing_gamelog_inserts,
    dry_run
  })

  // After the write, not before: the upsert re-stamps `source` on every row
  // this run produced, so by the time the prune reads them the only
  // `play-stats` rows it can see for these games that the run did not produce
  // are genuinely unsupported.
  await prune_unreferenced_gamelogs({
    unique_esbids,
    player_gamelog_inserts,
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
          .select('season_year as year')
          .where({ season_type: seas_type })
          .groupBy('season_year')
          .orderBy('season_year', 'asc'),
      week_query: ({ year, seas_type = 'REG' }) =>
        db('nfl_games')
          .select('week')
          .where({ season_year: year, season_type: seas_type })
          .groupBy('week')
          .orderBy('week', 'asc'),
      script_args: {
        dry_run: argv.dry,
        esbid: argv.esbid
      },
      seas_type: argv.seasType
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
