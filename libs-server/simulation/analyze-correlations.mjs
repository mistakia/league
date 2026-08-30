/**
 * Correlation analysis functions for lineup decisions.
 * Identify correlation opportunities and insights between players.
 */

import { load_player_info } from './load-player-info.mjs'
import {
  load_correlations_between_sets,
  load_correlations_within_set
} from './load-correlations.mjs'

/**
 * Get correlation-based swap opportunities.
 * Identifies bench players that correlate with opponent starters.
 *
 * @param {object} params
 * @param {string[]} params.bench_pids - Bench player IDs
 * @param {string[]} params.opponent_player_ids - Opponent starter player IDs
 * @param {number} params.year - Year for correlation lookup
 * @returns {Promise<object[]>} Correlation opportunities
 */
export async function get_correlation_opportunities({
  bench_pids,
  opponent_player_ids,
  year
}) {
  if (bench_pids.length === 0 || opponent_player_ids.length === 0) {
    return []
  }

  // Load player info
  const all_ids = [...bench_pids, ...opponent_player_ids]
  const player_info = await load_player_info({ player_ids: all_ids })

  // Load correlations between bench and opponent players using shared loader
  const correlations = await load_correlations_between_sets({
    player_set_a: bench_pids,
    player_set_b: opponent_player_ids,
    year
  })

  const opportunities = []

  for (const row of correlations) {
    const is_bench_a = bench_pids.includes(row.pid_first)
    const is_bench_b = bench_pids.includes(row.pid_second)
    const is_opp_a = opponent_player_ids.includes(row.pid_first)
    const is_opp_b = opponent_player_ids.includes(row.pid_second)

    if ((is_bench_a && is_opp_b) || (is_bench_b && is_opp_a)) {
      const bench_pid = is_bench_a ? row.pid_first : row.pid_second
      const opp_pid = is_opp_a ? row.pid_first : row.pid_second

      opportunities.push({
        bench_player: bench_pid,
        bench_position: player_info.get(bench_pid)?.position,
        opponent_player: opp_pid,
        opponent_position: player_info.get(opp_pid)?.position,
        correlation: row.correlation,
        games_together: row.games_together,
        relationship_type: row.relationship_type
      })
    }
  }

  // Sort by absolute correlation (strongest first)
  opportunities.sort(
    (a, b) => Math.abs(b.correlation) - Math.abs(a.correlation)
  )

  return opportunities
}

/**
 * Get same-team correlations within a lineup.
 * Identifies significant correlations between teammates (stacks).
 *
 * @param {object} params
 * @param {string[]} params.player_ids - Starter player IDs
 * @param {number} params.year - Year for correlation lookup
 * @returns {Promise<object[]>} Array of same-team correlation pairs
 */
export async function get_same_team_correlations({ player_ids, year }) {
  if (player_ids.length < 2) {
    return []
  }

  // Load player info for all players
  const player_info = await load_player_info({ player_ids })

  // Load correlations between players on the same roster using shared loader
  const correlations = await load_correlations_within_set({
    player_ids,
    year,
    relationship_type: 'same_team',
    min_correlation: 0.15 // Only significant correlations
  })

  const same_team_correlations = correlations.map((row) => ({
    player_a: row.pid_first,
    player_a_position: player_info.get(row.pid_first)?.position,
    player_b: row.pid_second,
    player_b_position: player_info.get(row.pid_second)?.position,
    correlation: row.correlation,
    games_together: row.games_together,
    data_year: row.data_year
  }))

  // Sort by correlation (highest first for stacks)
  same_team_correlations.sort((a, b) => b.correlation - a.correlation)

  return same_team_correlations
}

/**
 * Get correlation insights for a lineup.
 * Identifies significant positive and negative correlations with opponents.
 *
 * @param {object} params
 * @param {string[]} params.player_ids - Starter player IDs
 * @param {string[]} params.opponent_player_ids - Opponent starter player IDs
 * @param {number} params.year - Year for correlation lookup
 * @returns {Promise<object>} Correlation insights
 */
export async function get_correlation_insights({
  player_ids,
  opponent_player_ids,
  year
}) {
  // Load player info for all players
  const all_ids = [...player_ids, ...opponent_player_ids]
  const player_info = await load_player_info({ player_ids: all_ids })

  // Load correlations using shared loader
  const correlations = await load_correlations_between_sets({
    player_set_a: player_ids,
    player_set_b: opponent_player_ids,
    year,
    min_correlation: 0.15 // Only significant correlations
  })

  const insights = {
    positive_correlations: [],
    negative_correlations: []
  }

  for (const row of correlations) {
    const is_my_player_a = player_ids.includes(row.pid_first)
    const is_my_player_b = player_ids.includes(row.pid_second)
    const is_opp_player_a = opponent_player_ids.includes(row.pid_first)
    const is_opp_player_b = opponent_player_ids.includes(row.pid_second)

    // Only interested in my player vs opponent player
    if (
      (is_my_player_a && is_opp_player_b) ||
      (is_my_player_b && is_opp_player_a)
    ) {
      const my_pid = is_my_player_a ? row.pid_first : row.pid_second
      const opp_pid = is_opp_player_a ? row.pid_first : row.pid_second

      const insight = {
        my_player: my_pid,
        my_position: player_info.get(my_pid)?.position,
        opponent_player: opp_pid,
        opponent_position: player_info.get(opp_pid)?.position,
        correlation: row.correlation,
        games_together: row.games_together
      }

      if (row.correlation > 0.15) {
        insights.positive_correlations.push(insight)
      } else if (row.correlation < -0.15) {
        insights.negative_correlations.push(insight)
      }
    }
  }

  // Sort by absolute correlation
  insights.positive_correlations.sort((a, b) => b.correlation - a.correlation)
  insights.negative_correlations.sort((a, b) => a.correlation - b.correlation)

  return insights
}
