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
  is_position_eligible_for_slot,
  current_season
} from '#constants'

import { simulate_matchup } from './simulate-matchup.mjs'
import { load_player_info } from './load-simulation-data.mjs'
import { load_nfl_schedule } from './load-nfl-schedule.mjs'
import { load_teams_starters } from './load-team-rosters.mjs'
import { load_bench_players_with_fallback } from './load-data-with-fallback.mjs'

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
 * @param {boolean} [params.include_practice_squad=false] - Include practice squad players as swap candidates
 * @param {boolean} [params.include_reserve=false] - Include short-term reserve (IR) players as swap candidates
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
  include_practice_squad = false,
  include_reserve = false
}) {
  log(`Analyzing lineup decisions for team ${team_id}, week ${week}`)

  // Load league
  const league = await getLeague({ lid: league_id })
  if (!league) {
    throw new Error(`League not found: ${league_id}`)
  }

  // Load rosters using unified loader
  // For current/past weeks: uses actual roster slots
  // For future weeks: computes optimal lineup from current roster pool
  const all_team_ids = [team_id, ...opponent_team_ids]
  const current_week = current_season.week
  const rosters = await load_teams_starters({
    league_id,
    team_ids: all_team_ids,
    week,
    year,
    current_week
  })

  // Determine which week the roster data actually comes from
  // For future weeks, rosters are computed from current week's roster pool
  const roster_week = Math.min(week, current_week)

  const my_roster = rosters.find((r) => r.team_id === team_id)
  if (!my_roster) {
    throw new Error(`Roster not found for team ${team_id}`)
  }

  // Load schedule to identify locked players (games already completed)
  const schedule = await load_nfl_schedule({ year, week })

  // Get base win probability with current lineup
  const base_result = await simulate_matchup({
    league_id,
    team_ids: all_team_ids,
    week,
    year,
    n_simulations
  })

  const base_win_probability = base_result.teams.find(
    (t) => t.team_id === team_id
  )?.win_probability

  log(`Base win probability: ${(base_win_probability * 100).toFixed(1)}%`)

  // Get scoring format hash for projection lookup
  const season = await db('seasons').where({ lid: league_id, year }).first()
  const scoring_format_hash = season?.scoring_format_hash

  // Load bench players for potential swaps (only those with valid projections)
  // Use roster_week as fallback to match how starters are loaded for future weeks
  const bench_players = await load_bench_players_with_fallback({
    league_id,
    team_id,
    week,
    year,
    starter_pids: my_roster.player_ids,
    scoring_format_hash,
    fallback_week: roster_week,
    include_practice_squad,
    include_reserve
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
  // Use roster_week since for future weeks, rosters are computed from current week's data
  const starter_slots = await db('rosters_players')
    .where({
      lid: league_id,
      tid: team_id,
      week: roster_week,
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
      roster_overrides
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

// Re-export from split file for backwards compatibility
export {
  get_correlation_opportunities,
  get_same_team_correlations,
  get_correlation_insights
} from './analyze-correlations.mjs'
