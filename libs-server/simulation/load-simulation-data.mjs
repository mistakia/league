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
import { external_data_sources } from '#constants'
import calculatePoints from '#libs-shared/calculate-points.mjs'
import get_league_rosters_from_database from '#libs-server/get-league-rosters-from-database.mjs'

const log = debug('simulation:load-simulation-data')

/**
 * Merge market stats with traditional stats at the individual stat level.
 * Market stats override traditional stats where they exist.
 * Converts anytime_td to position-appropriate TD stat.
 *
 * @param {Object} params
 * @param {Object} params.traditional_stats - Traditional projection stats { py, ry, recy, rec, tdr, tdrec, ... }
 * @param {Object} params.market_data - Market projection data { stats: { ... }, projection }
 * @param {string} params.position - Player position (QB, RB, WR, TE, K, DST)
 * @param {Object} params.league_settings - League scoring settings
 * @returns {Object|null} { points, source, merged_stats } or null if no data
 */
export function merge_market_stats_with_traditional({
  traditional_stats,
  market_data,
  position,
  league_settings
}) {
  // DST and K positions don't have stat-level projections in projections_index
  // that we can merge. Use pre-calculated fallback projections instead.
  if (position === 'DST' || position === 'K') {
    return null
  }

  // Skip if no projection data at all
  if (!traditional_stats && !market_data) {
    return null
  }

  // Start with traditional stats (or empty object)
  const merged_stats = traditional_stats ? { ...traditional_stats } : {}

  let has_market_overrides = false

  if (market_data && market_data.stats) {
    // Override individual stats where market data exists
    for (const [stat, value] of Object.entries(market_data.stats)) {
      if (stat === 'anytime_td') {
        // anytime_td represents physical scoring TDs (rushing/receiving)
        // Convert to the appropriate TD stat based on position
        // This replaces the traditional TD projection with market expectation
        if (['WR', 'TE'].includes(position)) {
          merged_stats.tdrec = value
        } else if (position === 'RB') {
          merged_stats.tdr = value
        } else if (position === 'QB') {
          // For QBs, anytime_td represents rushing TDs (passing TDs are separate)
          merged_stats.tdr = value
        }
        // Note: do NOT set anytime_td in merged_stats to avoid double-counting
        has_market_overrides = true
      } else {
        // Direct stat override (recy, rec, py, ry, etc.)
        merged_stats[stat] = value
        has_market_overrides = true
      }
    }
  }

  // Calculate fantasy points from merged stats
  if (Object.keys(merged_stats).length > 0 && league_settings) {
    const points_result = calculatePoints({
      stats: merged_stats,
      position,
      league: league_settings
    })

    const source = has_market_overrides ? 'merged' : 'traditional'

    return {
      points: points_result.total,
      source,
      merged_stats
    }
  }

  return null
}

/**
 * Load player projections for simulation.
 * Uses pre-calculated projections from scoring_format_player_projection_points
 * which includes all positions (QB, RB, WR, TE, K, DST).
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

  // Load pre-calculated projections from scoring_format_player_projection_points
  // This table includes all positions including DST
  const projections = await db('scoring_format_player_projection_points')
    .whereIn('pid', player_ids)
    .where({
      year,
      week: String(week),
      scoring_format_hash
    })
    .select('pid', 'total')

  const projections_map = new Map()

  for (const projection of projections) {
    projections_map.set(projection.pid, parseFloat(projection.total))
  }

  log(`Loaded projections for ${projections_map.size} players`)
  return projections_map
}

/**
 * Load raw projection stats for stat-level merging with market data.
 * Returns weighted average stats across all projection sources.
 *
 * @param {Object} params
 * @param {string[]} params.player_ids - Array of player IDs
 * @param {number} params.week - NFL week
 * @param {number} params.year - NFL year
 * @returns {Promise<Map>} Map of pid -> { py, ry, recy, rec, tdp, tdr, tdrec, ... }
 */
export async function load_player_projection_stats({ player_ids, week, year }) {
  if (!player_ids.length) {
    return new Map()
  }

  log(
    `Loading projection stats for ${player_ids.length} players, week ${week}, year ${year}`
  )

  // Define stat columns to load (matching projections_index columns)
  const stat_columns = [
    'py',
    'pc',
    'pa',
    'ints',
    'tdp',
    'ry',
    'ra',
    'tdr',
    'recy',
    'rec',
    'trg',
    'tdrec',
    'fuml',
    'twoptc',
    'snp',
    'prtd',
    'krtd'
  ]

  // Load projections from all sources (excluding AVERAGE which is pre-calculated)
  const projections = await db('projections_index')
    .whereIn('pid', player_ids)
    .where({ year, week, userid: 0 })
    .whereNot('sourceid', external_data_sources.AVERAGE)
    .select('pid', 'sourceid', ...stat_columns)

  // Group by player and calculate weighted average across sources
  const player_projections = new Map()

  for (const projection of projections) {
    const { pid, sourceid } = projection
    if (!player_projections.has(pid)) {
      player_projections.set(pid, { sources: [] })
    }
    player_projections.get(pid).sources.push({ sourceid, projection })
  }

  const result = new Map()

  for (const [pid, data] of player_projections) {
    const stats = {}

    for (const stat of stat_columns) {
      const values = data.sources
        .map((s) => parseFloat(s.projection[stat]) || 0)
        .filter((v) => v > 0)

      if (values.length > 0) {
        // Simple average across sources (equal weight)
        stats[stat] = values.reduce((sum, v) => sum + v, 0) / values.length
      } else {
        stats[stat] = 0
      }
    }

    result.set(pid, stats)
  }

  log(`Loaded projection stats for ${result.size} players`)
  return result
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

  // Load raw projection stats for stat-level merging
  const traditional_stats = await load_player_projection_stats({
    player_ids: pending_players,
    week,
    year
  })

  // Load player positions for TD stat mapping
  const player_positions = new Map()
  const position_rows = await db('player')
    .select('pid', 'pos')
    .whereIn('pid', pending_players)
  for (const row of position_rows) {
    player_positions.set(row.pid, row.pos)
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
  const fallback_projections = await load_player_projections({
    player_ids: pending_players,
    week,
    year,
    scoring_format_hash
  })

  // Merge projections at stat level: market stats override traditional stats
  const merged_projections = new Map()
  for (const pid of pending_players) {
    const trad_stats = traditional_stats.get(pid)
    const market_data = market_projections.get(pid)
    const position = player_positions.get(pid) || ''

    const merge_result = merge_market_stats_with_traditional({
      traditional_stats: trad_stats,
      market_data,
      position,
      league_settings
    })

    if (merge_result) {
      merged_projections.set(pid, {
        points: merge_result.points,
        source: merge_result.source
      })
    } else {
      // Fall back to pre-calculated traditional projection if available
      const fallback_points = fallback_projections.get(pid)
      if (fallback_points !== undefined) {
        merged_projections.set(pid, {
          points: fallback_points,
          source: 'traditional'
        })
      }
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
