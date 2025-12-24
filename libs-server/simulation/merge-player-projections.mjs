/**
 * Merge market projections with traditional projections for simulation.
 * Extracts the common projection merging pattern used across simulation orchestrators.
 */

import { merge_market_stats_with_traditional } from './load-simulation-data.mjs'

/**
 * Merge market projections with traditional projections for a set of players.
 * Market stats override traditional stats where available, with traditional
 * stats filling in gaps (e.g., yards, receptions when only TD odds exist).
 *
 * @param {Object} params
 * @param {string[]} params.player_ids - Player IDs to merge projections for
 * @param {Map} params.traditional_projections - Pre-calculated traditional projections (pid -> points)
 * @param {Map} params.traditional_stats - Traditional projection stats (pid -> stats object)
 * @param {Map} params.market_projections - Market-derived projections (pid -> market data)
 * @param {Map} params.player_info - Player info map (pid -> { position, nfl_team })
 * @param {Object} params.league_settings - League scoring settings for point calculation
 * @returns {Object} { projections: Map<pid, points>, market_merged_count, traditional_only_count }
 */
export function merge_player_projections({
  player_ids,
  traditional_projections,
  traditional_stats,
  market_projections,
  player_info,
  league_settings
}) {
  const projections = new Map()
  let market_merged_count = 0
  let traditional_only_count = 0

  for (const pid of player_ids) {
    const trad_stats = traditional_stats.get(pid)
    const market_data = market_projections.get(pid)
    const info = player_info.get(pid)
    const position = info?.position || ''

    const merge_result = merge_market_stats_with_traditional({
      traditional_stats: trad_stats,
      market_data,
      position,
      league_settings
    })

    if (merge_result) {
      projections.set(pid, merge_result.points)
      if (merge_result.source === 'merged') {
        market_merged_count++
      } else {
        traditional_only_count++
      }
    } else {
      // Fall back to pre-calculated traditional projection if available
      const trad_points = traditional_projections.get(pid)
      if (trad_points !== undefined) {
        projections.set(pid, trad_points)
        traditional_only_count++
      }
    }
  }

  return {
    projections,
    market_merged_count,
    traditional_only_count
  }
}
