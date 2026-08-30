// @ts-check
/**
 * Merge market projections with traditional projections for simulation.
 * Extracts the common projection merging pattern used across simulation orchestrators.
 */

import { merge_market_stats_with_traditional } from './load-projection-data.mjs'

/**
 * Merge market projections with traditional projections for a set of players.
 * Market stats override traditional stats where available, with traditional
 * stats filling in gaps (e.g., yards, receptions when only TD odds exist).
 *
 * `sources` reports how each pid was actually scored. It is the authority for
 * that question: presence in `market_projections` does NOT imply a market
 * override, since DST and K short-circuit to null in
 * merge_market_stats_with_traditional and fall back to the pre-calculated
 * projection. A pid appears in `sources` if and only if it appears in
 * `projections`, so a caller counting one cannot disagree with the other.
 *
 * @param {object} params
 * @param {string[]} params.player_ids - Player IDs to merge projections for
 * @param {Map<string, number>} params.traditional_projections - Pre-calculated traditional projections (pid -> points)
 * @param {Map<string, any>} params.traditional_stats - Traditional projection stats (pid -> stats object)
 * @param {Map<string, any>} params.market_projections - Market-derived projections (pid -> market data)
 * @param {Map<string, { position: string, nfl_team?: string }>} params.player_info - Player info map
 * @param {import('#db/schema-types.js').LeagueScoringFormatsRow} params.league_settings - League
 *   scoring settings for point calculation.
 * @returns {{ projections: Map<string, number>, sources: Map<string, 'merged'|'traditional'> }}
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
  const sources = new Map()

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
      sources.set(pid, merge_result.source)
    } else {
      // Fall back to pre-calculated traditional projection if available
      const trad_points = traditional_projections.get(pid)
      if (trad_points !== undefined) {
        projections.set(pid, trad_points)
        sources.set(pid, 'traditional')
      }
    }
  }

  return {
    projections,
    sources
  }
}
