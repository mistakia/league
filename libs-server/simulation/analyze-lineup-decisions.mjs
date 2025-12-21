/**
 * Lineup decision analyzer for start/sit recommendations.
 * Analyzes the impact of lineup changes on win probability.
 */

import debug from 'debug'

import db from '#db'
import { getLeague } from '#libs-server'
import {
  starting_lineup_slots,
  roster_slot_display_names,
  is_position_eligible_for_slot
} from '#constants'

import { simulate_matchup } from './simulate-matchup.mjs'
import { load_player_info } from './load-simulation-data.mjs'
import {
  load_correlations_between_sets,
  load_correlations_within_set
} from './load-correlations.mjs'
import { load_nfl_schedule } from './load-nfl-schedule.mjs'
import {
  load_rosters_with_fallback,
  load_bench_players_with_fallback
} from './load-data-with-fallback.mjs'

const log = debug('simulation:analyze-lineup-decisions')

/**
 * Analyze lineup decisions for start/sit recommendations.
 *
 * @param {Object} params
 * @param {number} params.league_id - League ID
 * @param {number} params.team_id - Fantasy team ID to analyze
 * @param {number[]} params.opponent_team_ids - Array of opponent team IDs
 * @param {number} params.week - NFL week
 * @param {number} params.year - NFL year
 * @param {Object[]} [params.alternatives] - Optional specific swaps to evaluate
 *   Each: { starter_pid, bench_pid, slot }
 * @param {number} [params.n_simulations=5000] - Simulations per lineup evaluation
 * @param {number} [params.fallback_week] - Week to use for roster if current week has no data
 * @returns {Promise<Object>} Lineup analysis results
 */
export async function analyze_lineup_decisions({
  league_id,
  team_id,
  opponent_team_ids,
  week,
  year,
  alternatives = [],
  n_simulations = 5000,
  fallback_week
}) {
  log(`Analyzing lineup decisions for team ${team_id}, week ${week}`)

  // Load league
  const league = await getLeague({ lid: league_id })
  if (!league) {
    throw new Error(`League not found: ${league_id}`)
  }

  // Load rosters with fallback support
  const all_team_ids = [team_id, ...opponent_team_ids]
  const { rosters, used_fallback } = await load_rosters_with_fallback({
    league_id,
    team_ids: all_team_ids,
    week,
    year,
    fallback_week
  })

  const my_roster = rosters.find((r) => r.team_id === team_id)
  if (!my_roster) {
    throw new Error(`Roster not found for team ${team_id}`)
  }

  // Track which week was used for roster data
  const roster_week_used = used_fallback ? fallback_week : week

  // Load schedule to identify locked players (games already completed)
  const schedule = await load_nfl_schedule({ year, week })

  // Get base win probability with current lineup
  const base_result = await simulate_matchup({
    league_id,
    team_ids: all_team_ids,
    week,
    year,
    n_simulations,
    fallback_week
  })

  const base_win_probability = base_result.teams.find(
    (t) => t.team_id === team_id
  )?.win_probability

  log(`Base win probability: ${(base_win_probability * 100).toFixed(1)}%`)

  // Get scoring format hash for projection lookup
  const season = await db('seasons').where({ lid: league_id, year }).first()
  const scoring_format_hash = season?.scoring_format_hash

  // Load bench players for potential swaps (only those with valid projections)
  const bench_players = await load_bench_players_with_fallback({
    league_id,
    team_id,
    week,
    year,
    starter_pids: my_roster.player_ids,
    scoring_format_hash,
    fallback_week
  })

  // Load player info for all players
  const all_player_ids = [
    ...my_roster.player_ids,
    ...bench_players.map((p) => p.pid)
  ]
  const player_info = await load_player_info({ player_ids: all_player_ids })

  // Identify locked players (games already started or completed)
  // For lineup decisions, lock players as soon as their game has started
  const locked_pids = new Set()
  for (const pid of all_player_ids) {
    const info = player_info.get(pid)
    const game = schedule[info?.nfl_team]
    // Lock if game is final OR if game has started (time-based)
    if (game?.is_final || game?.has_started) {
      locked_pids.add(pid)
    }
  }

  log(`Locked players (game started or completed): ${locked_pids.size}`)

  // Filter bench players to exclude locked ones
  const available_bench_players = bench_players.filter(
    (p) => !locked_pids.has(p.pid)
  )

  log(
    `Bench players available for swaps: ${available_bench_players.length} (${bench_players.length - available_bench_players.length} locked)`
  )

  // Load starter slot info from rosters_players to know which slot each starter is in
  // Use roster_week_used since we may be using fallback roster data
  const starter_slots = await db('rosters_players')
    .where({
      lid: league_id,
      tid: team_id,
      week: roster_week_used,
      year
    })
    .whereIn('pid', my_roster.player_ids)
    .whereIn('slot', starting_lineup_slots)
    .select('pid', 'slot')

  const starter_slot_map = new Map()
  for (const row of starter_slots) {
    starter_slot_map.set(row.pid, row.slot)
  }

  // Filter starters to exclude locked ones (can't swap out players who already played)
  const available_starters = my_roster.player_ids.filter(
    (pid) => !locked_pids.has(pid)
  )

  log(
    `Starters available for swaps: ${available_starters.length} (${my_roster.player_ids.length - available_starters.length} locked)`
  )

  // If no specific alternatives provided, generate slot-aware swaps
  const swaps_to_evaluate =
    alternatives.length > 0
      ? alternatives.filter(
          (alt) =>
            !locked_pids.has(alt.starter_pid) && !locked_pids.has(alt.bench_pid)
        )
      : generate_potential_swaps({
          starters: available_starters,
          starter_slot_map,
          bench_players: available_bench_players,
          player_info
        })

  log(`Evaluating ${swaps_to_evaluate.length} potential swaps`)

  // Evaluate each swap by running simulation with modified roster
  const swap_results = []

  for (const swap of swaps_to_evaluate) {
    const { starter_pid, bench_pid } = swap

    // Create modified player list
    const modified_player_ids = my_roster.player_ids.map((pid) =>
      pid === starter_pid ? bench_pid : pid
    )

    // Run simulation with modified roster
    const roster_overrides = new Map([[team_id, modified_player_ids]])
    const swap_result = await simulate_matchup({
      league_id,
      team_ids: all_team_ids,
      week,
      year,
      n_simulations,
      roster_overrides,
      fallback_week
    })

    const swap_win_probability = swap_result.teams.find(
      (t) => t.team_id === team_id
    )?.win_probability

    const win_probability_delta = swap_win_probability - base_win_probability

    const starter_info = player_info.get(starter_pid)
    const bench_info = player_info.get(bench_pid)
    const starter_slot = starter_slot_map.get(starter_pid)
    const slot_name = roster_slot_display_names[starter_slot] || 'Unknown'

    swap_results.push({
      starter_pid,
      starter_position: starter_info?.position,
      starter_slot,
      slot_name,
      bench_pid,
      bench_position: bench_info?.position,
      estimated_win_probability_delta: win_probability_delta,
      swap_win_probability,
      notes: `Swap ${starter_pid} (${starter_info?.position} in ${slot_name}) for ${bench_pid} (${bench_info?.position})`
    })

    log(
      `Swap ${starter_pid} -> ${bench_pid}: ${(win_probability_delta * 100).toFixed(2)}% delta`
    )
  }

  // Sort by estimated impact (highest first, so positive impacts appear first)
  // This prioritizes beneficial swaps over harmful ones
  swap_results.sort(
    (a, b) =>
      b.estimated_win_probability_delta - a.estimated_win_probability_delta
  )

  return {
    team_id,
    week,
    year,
    base_win_probability,
    current_starters: my_roster.player_ids,
    recommendations: swap_results.slice(0, 10), // Top 10 recommendations
    bench_players: bench_players.map((p) => p.pid)
  }
}

/**
 * Generate potential swaps for lineup positions using slot-based eligibility.
 * Only generates swaps where the bench player's position is eligible for the starter's slot.
 *
 * @param {Object} params
 * @param {string[]} params.starters - Array of starter player IDs
 * @param {Map} params.starter_slot_map - Map of starter pid -> slot number
 * @param {Object[]} params.bench_players - Array of bench players with pid, slot, projection
 * @param {Map} params.player_info - Map of pid -> { position, nfl_team }
 * @returns {Object[]} Array of valid swap objects
 */
function generate_potential_swaps({
  starters,
  starter_slot_map,
  bench_players,
  player_info
}) {
  const swaps = []

  // For each starter, find bench players that can fill their slot
  for (const starter_pid of starters) {
    const starter_slot = starter_slot_map.get(starter_pid)
    if (!starter_slot) {
      // No slot info - skip this starter
      continue
    }

    const starter_info = player_info.get(starter_pid)
    if (!starter_info) {
      continue
    }

    // Find all bench players whose position is eligible for this starter's slot
    for (const bench_player of bench_players) {
      const bench_info = player_info.get(bench_player.pid)
      if (!bench_info) {
        continue
      }

      // Check if the bench player's position can fill the starter's slot
      if (is_position_eligible_for_slot(bench_info.position, starter_slot)) {
        swaps.push({
          starter_pid,
          bench_pid: bench_player.pid,
          bench_projection: bench_player.projection,
          starter_slot,
          bench_position: bench_info.position
        })
      }
    }
  }

  // Sort swaps by bench projection (highest first) to prioritize high-upside swaps
  swaps.sort((a, b) => (b.bench_projection || 0) - (a.bench_projection || 0))

  return swaps
}

/**
 * Get correlation-based swap opportunities.
 * Identifies bench players that correlate with opponent starters.
 *
 * @param {Object} params
 * @param {string[]} params.bench_pids - Bench player IDs
 * @param {string[]} params.opponent_player_ids - Opponent starter player IDs
 * @param {number} params.year - Year for correlation lookup
 * @returns {Promise<Object[]>} Correlation opportunities
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
    const is_bench_a = bench_pids.includes(row.pid_a)
    const is_bench_b = bench_pids.includes(row.pid_b)
    const is_opp_a = opponent_player_ids.includes(row.pid_a)
    const is_opp_b = opponent_player_ids.includes(row.pid_b)

    if ((is_bench_a && is_opp_b) || (is_bench_b && is_opp_a)) {
      const bench_pid = is_bench_a ? row.pid_a : row.pid_b
      const opp_pid = is_opp_a ? row.pid_a : row.pid_b

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
 * @param {Object} params
 * @param {string[]} params.player_ids - Starter player IDs
 * @param {number} params.year - Year for correlation lookup
 * @returns {Promise<Object[]>} Array of same-team correlation pairs
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
    player_a: row.pid_a,
    player_a_position: player_info.get(row.pid_a)?.position,
    player_b: row.pid_b,
    player_b_position: player_info.get(row.pid_b)?.position,
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
 * @param {Object} params
 * @param {string[]} params.player_ids - Starter player IDs
 * @param {string[]} params.opponent_player_ids - Opponent starter player IDs
 * @param {number} params.year - Year for correlation lookup
 * @returns {Promise<Object>} Correlation insights
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
    const is_my_player_a = player_ids.includes(row.pid_a)
    const is_my_player_b = player_ids.includes(row.pid_b)
    const is_opp_player_a = opponent_player_ids.includes(row.pid_a)
    const is_opp_player_b = opponent_player_ids.includes(row.pid_b)

    // Only interested in my player vs opponent player
    if (
      (is_my_player_a && is_opp_player_b) ||
      (is_my_player_b && is_opp_player_a)
    ) {
      const my_pid = is_my_player_a ? row.pid_a : row.pid_b
      const opp_pid = is_opp_player_a ? row.pid_a : row.pid_b

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
