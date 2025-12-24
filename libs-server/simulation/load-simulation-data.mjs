/**
 * Load simulation data from database.
 * Database queries and data loading for simulation.
 */

import debug from 'debug'

import db from '#db'
import {
  roster_slot_types,
  starting_lineup_slots
} from '#libs-shared/constants/roster-constants.mjs'
import get_league_rosters_from_database from '#libs-server/get-league-rosters-from-database.mjs'

const log = debug('simulation:load-simulation-data')

// Re-export from split files for backwards compatibility
export {
  load_player_variance,
  load_player_archetypes
} from './load-player-variance.mjs'

export {
  merge_market_stats_with_traditional,
  load_player_projections,
  load_player_projection_stats
} from './load-projection-data.mjs'

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

/**
 * Load player points with game status (actual or projected).
 * Returns actual points for completed games, projections for pending games.
 * Merges market projections with traditional projections (market takes precedence)
 * to match what the simulation uses.
 *
 * @param {Object} params
 * @param {string[]} params.player_ids - Array of player IDs
 * @param {number} params.week - NFL week
 * @param {number} params.year - NFL year
 * @param {string} params.scoring_format_hash - Scoring format hash
 * @returns {Promise<Map>} Map of pid -> { points, is_actual, source }
 */
export async function load_player_points_with_game_status({
  player_ids,
  week,
  year,
  scoring_format_hash
}) {
  // Import market projections loader dynamically to avoid circular dependency
  const { load_market_projections } = await import(
    './load-market-projections.mjs'
  )

  // Import projection loaders from split file
  const { load_player_projections, load_player_projection_stats } =
    await import('./load-projection-data.mjs')

  if (!player_ids.length) {
    return new Map()
  }

  // Load player NFL teams
  const players = await db('player')
    .select('pid', 'current_nfl_team')
    .whereIn('pid', player_ids)

  const player_team_map = new Map()
  for (const p of players) {
    player_team_map.set(p.pid, p.current_nfl_team)
  }

  // Load NFL schedule to check game status
  const games = await db('nfl_games')
    .where({ year, week })
    .select('h', 'v', 'esbid', 'status')

  const team_game_map = new Map()
  for (const game of games) {
    const is_final = game.status?.toUpperCase()?.startsWith('FINAL') ?? false
    team_game_map.set(game.h, { esbid: game.esbid, is_final })
    team_game_map.set(game.v, { esbid: game.esbid, is_final })
  }

  // Categorize players by game status
  const completed_players = []
  const pending_players = []
  const completed_esbids = new Set()

  for (const pid of player_ids) {
    const team = player_team_map.get(pid)
    const game_info = team_game_map.get(team)
    if (game_info?.is_final) {
      completed_players.push(pid)
      completed_esbids.add(game_info.esbid)
    } else {
      pending_players.push(pid)
    }
  }

  // Load actual points for completed games
  const actual_points_map = new Map()
  if (completed_players.length > 0 && completed_esbids.size > 0) {
    const actual_rows = await db('scoring_format_player_gamelogs')
      .whereIn('pid', completed_players)
      .whereIn('esbid', [...completed_esbids])
      .where('scoring_format_hash', scoring_format_hash)
      .select('pid', 'points')

    for (const row of actual_rows) {
      actual_points_map.set(row.pid, parseFloat(row.points))
    }
  }

  // Load scoring format for market projection calculation
  const league_settings = await db('league_scoring_formats')
    .where({ scoring_format_hash })
    .first()

  // Import merge helper dynamically to avoid circular dependency
  const { merge_player_projections } = await import(
    './merge-player-projections.mjs'
  )

  // Load raw projection stats for stat-level merging
  const traditional_stats = await load_player_projection_stats({
    player_ids: pending_players,
    week,
    year
  })

  // Load player positions for TD stat mapping (as player_info format)
  const player_info = new Map()
  const position_rows = await db('player')
    .select('pid', 'pos')
    .whereIn('pid', pending_players)
  for (const row of position_rows) {
    player_info.set(row.pid, { position: row.pos })
  }

  // Load market projections for pending players
  let market_projections = new Map()
  if (league_settings && pending_players.length > 0) {
    market_projections = await load_market_projections({
      player_ids: pending_players,
      week,
      year,
      league: league_settings
    })
  }

  // Load pre-calculated projections as fallback (same as simulation uses)
  const traditional_projections = await load_player_projections({
    player_ids: pending_players,
    week,
    year,
    scoring_format_hash
  })

  // Merge projections: market stats override traditional stats where available
  const { projections: merged_points } = merge_player_projections({
    player_ids: pending_players,
    traditional_projections,
    traditional_stats,
    market_projections,
    player_info,
    league_settings
  })

  // Convert to format with source tracking
  const merged_projections = new Map()
  for (const pid of pending_players) {
    if (merged_points.has(pid)) {
      const market_had_data = market_projections.has(pid)
      merged_projections.set(pid, {
        points: merged_points.get(pid),
        source: market_had_data ? 'merged' : 'traditional'
      })
    }
  }

  // Combine into result map with is_actual flag and source
  const result = new Map()
  for (const pid of player_ids) {
    if (actual_points_map.has(pid)) {
      result.set(pid, {
        points: actual_points_map.get(pid),
        is_actual: true,
        source: 'actual'
      })
    } else if (merged_projections.has(pid)) {
      const proj = merged_projections.get(pid)
      result.set(pid, {
        points: proj.points,
        is_actual: false,
        source: proj.source
      })
    }
  }

  log(
    `Loaded points for ${result.size} players (${actual_points_map.size} actual, ${merged_projections.size} projected [${market_projections.size} with market data])`
  )
  return result
}

/**
 * Load actual playoff points from the playoffs table.
 * Returns a map of week -> Map<tid, points> for weeks that have actual results.
 *
 * @param {Object} params
 * @param {number} params.league_id - League ID
 * @param {number[]} params.team_ids - Team IDs to load
 * @param {number[]} params.weeks - Weeks to check
 * @param {number} params.year - NFL year
 * @returns {Promise<Object>} { actual_points: Map<week, Map<tid, points>>, weeks_with_results: number[] }
 */
export async function load_actual_playoff_points({
  league_id,
  team_ids,
  weeks,
  year
}) {
  const playoff_entries = await db('playoffs')
    .where({ lid: league_id, year })
    .whereIn('week', weeks)
    .whereIn('tid', team_ids)
    .whereNotNull('points')

  const actual_points = new Map()
  const weeks_with_results = new Set()

  for (const entry of playoff_entries) {
    const points = parseFloat(entry.points)
    // Only count as having results if points > 0 (game actually played)
    if (points > 0) {
      if (!actual_points.has(entry.week)) {
        actual_points.set(entry.week, new Map())
      }
      actual_points.get(entry.week).set(entry.tid, points)
      weeks_with_results.add(entry.week)
    }
  }

  return {
    actual_points,
    weeks_with_results: [...weeks_with_results].sort((a, b) => a - b)
  }
}
