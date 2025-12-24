/**
 * Load player projection data from database.
 * Projection loading and stat-level merging with market data.
 */

import debug from 'debug'

import db from '#db'
import { external_data_sources } from '#constants'
import calculatePoints from '#libs-shared/calculate-points.mjs'

const log = debug('simulation:load-projection-data')

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
