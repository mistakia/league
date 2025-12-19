/**
 * Load simulation data from database.
 * Database queries and data loading for simulation.
 */

import debug from 'debug'

import db from '#db'
import { external_data_sources } from '#constants'
import { calculatePoints } from '#libs-shared'
import {
  roster_slot_types,
  starting_lineup_slots
} from '#libs-shared/constants/roster-constants.mjs'
import get_league_rosters_from_database from '#libs-server/get-league-rosters-from-database.mjs'

const log = debug('simulation:load-simulation-data')

/**
 * Load player projections for simulation.
 *
 * @param {Object} params
 * @param {string[]} params.player_ids - Array of player IDs
 * @param {number} params.week - NFL week
 * @param {number} params.year - NFL year
 * @param {string} params.scoring_format_hash - Scoring format hash for point calculation
 * @returns {Promise<Map>} Map of pid -> projected_points
 */
export async function load_player_projections({
  player_ids,
  week,
  year,
  scoring_format_hash
}) {
  if (!player_ids.length) {
    return new Map()
  }

  log(
    `Loading projections for ${player_ids.length} players, week ${week}, year ${year}`
  )

  // Load scoring format
  const scoring_format = await db('league_scoring_formats')
    .where({ scoring_format_hash })
    .first()

  if (!scoring_format) {
    throw new Error(`Scoring format not found: ${scoring_format_hash}`)
  }

  // Load projections (sourceid 18 = AVERAGE)
  const projections = await db('projections_index')
    .whereIn('pid', player_ids)
    .where({
      year,
      week: String(week),
      userid: 0,
      seas_type: 'REG',
      sourceid: external_data_sources.AVERAGE
    })

  // Also load player positions for accurate scoring
  const players = await db('player')
    .select('pid', 'pos')
    .whereIn('pid', player_ids)

  const player_positions = new Map()
  players.forEach((p) => player_positions.set(p.pid, p.pos))

  // Calculate fantasy points for each projection
  const projections_map = new Map()

  for (const projection of projections) {
    const position = player_positions.get(projection.pid) || ''
    const points_result = calculatePoints({
      stats: projection,
      position,
      league: scoring_format,
      use_projected_stats: true
    })

    projections_map.set(projection.pid, points_result.total)
  }

  log(`Loaded projections for ${projections_map.size} players`)
  return projections_map
}

/**
 * Load player variance data for distribution fitting.
 *
 * @param {Object} params
 * @param {string[]} params.player_ids - Array of player IDs
 * @param {number} params.year - Year for variance data (typically prior year)
 * @param {string} params.scoring_format_hash - Scoring format hash
 * @returns {Promise<Map>} Map of pid -> { mean_points, std_points, coefficient_of_variation, games_played }
 */
export async function load_player_variance({
  player_ids,
  year,
  scoring_format_hash
}) {
  if (!player_ids.length) {
    return new Map()
  }

  log(`Loading variance for ${player_ids.length} players, year ${year}`)

  // First try player_variance table
  const cached_variance = await db('player_variance')
    .whereIn('pid', player_ids)
    .where({ year, scoring_format_hash })

  const variance_map = new Map()
  const found_pids = new Set()

  for (const row of cached_variance) {
    const std_points = parseFloat(row.standard_deviation)
    variance_map.set(row.pid, {
      mean_points: parseFloat(row.mean_points),
      std_points,
      coefficient_of_variation: parseFloat(row.coefficient_of_variation),
      games_played: row.games_played
    })
    found_pids.add(row.pid)
  }

  // For missing players, calculate from scoring_format_player_gamelogs
  const missing_pids = player_ids.filter((pid) => !found_pids.has(pid))

  if (missing_pids.length > 0) {
    log(`Calculating variance for ${missing_pids.length} players from gamelogs`)

    const gamelogs = await db('scoring_format_player_gamelogs')
      .join(
        'nfl_games',
        'scoring_format_player_gamelogs.esbid',
        'nfl_games.esbid'
      )
      .whereIn('scoring_format_player_gamelogs.pid', missing_pids)
      .where('nfl_games.year', year)
      .where(
        'scoring_format_player_gamelogs.scoring_format_hash',
        scoring_format_hash
      )
      .select(
        'scoring_format_player_gamelogs.pid',
        'scoring_format_player_gamelogs.points'
      )

    // Group by player and calculate stats
    const player_gamelogs = new Map()
    for (const gl of gamelogs) {
      if (!player_gamelogs.has(gl.pid)) {
        player_gamelogs.set(gl.pid, [])
      }
      player_gamelogs.get(gl.pid).push(parseFloat(gl.points))
    }

    for (const [pid, points_array] of player_gamelogs) {
      if (points_array.length === 0) continue

      const games_played = points_array.length
      const mean_points =
        points_array.reduce((sum, p) => sum + p, 0) / games_played

      let standard_deviation = 0
      if (games_played > 1) {
        const variance =
          points_array.reduce((sum, p) => sum + (p - mean_points) ** 2, 0) /
          games_played
        standard_deviation = Math.sqrt(variance)
      }

      const coefficient_of_variation =
        mean_points > 0 ? standard_deviation / mean_points : 0

      variance_map.set(pid, {
        mean_points,
        std_points: standard_deviation,
        coefficient_of_variation,
        games_played
      })
    }
  }

  log(`Loaded variance for ${variance_map.size} players`)
  return variance_map
}

/**
 * Load archetypes for players.
 *
 * @param {Object} params
 * @param {string[]} params.player_ids - Array of player IDs
 * @param {number} params.year - Year of archetype data
 * @returns {Promise<Map>} Map of pid -> archetype string
 */
export async function load_player_archetypes({ player_ids, year }) {
  if (!player_ids.length) {
    return new Map()
  }

  log(`Loading archetypes for ${player_ids.length} players, year ${year}`)

  const archetypes = await db('player_archetypes')
    .whereIn('pid', player_ids)
    .where('year', year)

  const archetype_map = new Map()
  for (const row of archetypes) {
    archetype_map.set(row.pid, row.archetype)
  }

  log(`Loaded ${archetype_map.size} archetypes`)
  return archetype_map
}

/**
 * Load rosters for simulation with starter player IDs.
 *
 * @param {Object} params
 * @param {number} params.league_id - League ID
 * @param {number[]} params.team_ids - Array of fantasy team IDs
 * @param {number} params.week - NFL week
 * @param {number} params.year - NFL year
 * @returns {Promise<Object[]>} Array of { team_id, player_ids, baseline_total }
 */
export async function load_simulation_rosters({
  league_id,
  team_ids,
  week,
  year
}) {
  log(`Loading rosters for league ${league_id}, teams ${team_ids.join(',')}`)

  // First try the existing roster loader for lineup data
  const rosters = await get_league_rosters_from_database({
    lid: league_id,
    year
  })

  const result = []

  for (const team_id of team_ids) {
    const roster = rosters[team_id]

    // Check if we have lineup data
    const lineup = roster?.lineups?.[week]
    if (lineup && lineup.starter_pids?.length > 0) {
      result.push({
        team_id,
        player_ids: lineup.starter_pids,
        baseline_total: lineup.baseline_total || 0
      })
      continue
    }

    // Fallback: load active roster players from database
    // Get players on active roster (not on practice squad or IR)
    const inactive_slots = [
      roster_slot_types.PS,
      roster_slot_types.PSP,
      roster_slot_types.PSD,
      roster_slot_types.PSDP,
      roster_slot_types.RESERVE_SHORT_TERM,
      roster_slot_types.RESERVE_LONG_TERM,
      roster_slot_types.COV
    ]
    const roster_players = await db('rosters_players')
      .where({
        lid: league_id,
        tid: team_id,
        week,
        year
      })
      .whereNotIn('slot', inactive_slots)
      .select('pid', 'slot')

    if (roster_players.length > 0) {
      // Prioritize starters (non-bench slots)
      const starters = roster_players.filter((p) =>
        starting_lineup_slots.includes(p.slot)
      )
      const player_ids =
        starters.length > 0
          ? starters.map((p) => p.pid)
          : roster_players.map((p) => p.pid)

      result.push({
        team_id,
        player_ids,
        baseline_total: 0
      })
    } else {
      log(`No roster players found for team ${team_id}, week ${week}`)
    }
  }

  log(`Loaded ${result.length} team rosters`)
  return result
}

/**
 * Load player info (position, current team) for a set of player IDs.
 *
 * @param {Object} params
 * @param {string[]} params.player_ids - Array of player IDs
 * @returns {Promise<Map>} Map of pid -> { position, nfl_team }
 */
export async function load_player_info({ player_ids }) {
  if (!player_ids.length) {
    return new Map()
  }

  const players = await db('player')
    .select('pid', 'pos', 'current_nfl_team')
    .whereIn('pid', player_ids)

  const player_map = new Map()
  for (const p of players) {
    player_map.set(p.pid, {
      position: p.pos,
      nfl_team: p.current_nfl_team
    })
  }

  return player_map
}

/**
 * Load scoring format by hash.
 *
 * @param {Object} params
 * @param {string} params.scoring_format_hash - Scoring format hash
 * @returns {Promise<Object>} Scoring format configuration
 */
export async function load_scoring_format({ scoring_format_hash }) {
  const scoring_format = await db('league_scoring_formats')
    .where({ scoring_format_hash })
    .first()

  if (!scoring_format) {
    throw new Error(`Scoring format not found: ${scoring_format_hash}`)
  }

  return scoring_format
}

/**
 * Load actual fantasy points for players from completed games.
 * Uses pre-calculated points from scoring_format_player_gamelogs.
 *
 * @param {Object} params
 * @param {string[]} params.player_ids - Array of player IDs
 * @param {number[]} params.esbids - Array of completed game esbids
 * @param {string} params.scoring_format_hash - Scoring format hash
 * @returns {Promise<Map>} Map of pid -> actual_points
 */
export async function load_actual_player_points({
  player_ids,
  esbids,
  scoring_format_hash
}) {
  if (!player_ids.length || !esbids.length) {
    return new Map()
  }

  log(
    `Loading actual points for ${player_ids.length} players from ${esbids.length} completed games`
  )

  const rows = await db('scoring_format_player_gamelogs')
    .whereIn('pid', player_ids)
    .whereIn('esbid', esbids)
    .where('scoring_format_hash', scoring_format_hash)
    .select('pid', 'points')

  const points_map = new Map()
  for (const row of rows) {
    points_map.set(row.pid, parseFloat(row.points))
  }

  log(`Loaded actual points for ${points_map.size} players`)
  return points_map
}
