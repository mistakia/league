/**
 * Core Monte Carlo simulation engine for fantasy football matchups.
 * Pure math operations - no database access.
 */

import debug from 'debug'

import { build_correlation_matrix } from './build-correlation-matrix.mjs'
import { SIMULATION_DEFAULTS } from './correlation-constants.mjs'
import {
  find_winners,
  distribute_win_credit,
  calculate_distribution,
  create_constant_distribution
} from './simulation-utils.mjs'
import {
  get_player_distribution_params,
  sample_from_distribution,
  get_rookie_default_cv
} from './fit-player-distribution.mjs'
import { generate_correlated_uniforms } from './generate-correlated-samples.mjs'

const log = debug('simulation:run-simulation')

/**
 * Run Monte Carlo simulation for fantasy matchup.
 *
 * @param {Object} params
 * @param {Object[]} params.players - Array of players with { pid, nfl_team, position, position_rank, team_id }
 *   team_id = fantasy team ID for grouping
 * @param {Map} params.projections - Map of pid -> projected_points (mean projection)
 * @param {Map} params.variance_cache - Map of pid -> { mean_points, std_points, coefficient_of_variation, games_played }
 * @param {Map} params.correlation_cache - Pre-loaded correlations from database
 * @param {Map} params.archetypes - Map of pid -> archetype
 * @param {Object} params.schedule - Pre-loaded NFL schedule
 * @param {Object[]} params.teams - Array of fantasy teams { team_id, name }
 * @param {number} [params.n_simulations] - Number of simulations
 * @param {number} [params.seed] - Optional seed for reproducibility
 * @param {boolean} [params.return_raw_scores=false] - If true, include raw per-simulation scores in results
 * @param {Map} [params.locked_scores=new Map()] - Map of pid -> actual_points for players with completed games
 * @returns {Object} { win_probabilities, score_distributions, player_score_distributions, n_simulations, elapsed_ms, correlation_fallback, locked_player_count, raw_team_scores? }
 */
export function run_simulation({
  players,
  projections,
  variance_cache,
  correlation_cache,
  archetypes,
  schedule,
  teams,
  n_simulations = SIMULATION_DEFAULTS.N_SIMULATIONS,
  seed,
  return_raw_scores = false,
  locked_scores = new Map()
}) {
  const start_time = Date.now()
  log(
    `Starting simulation: ${n_simulations} iterations for ${teams.length} teams`
  )

  // Split players into locked (actual results) and pending (to simulate)
  const locked_players = players.filter((p) => locked_scores.has(p.pid))
  const pending_players = players.filter((p) => !locked_scores.has(p.pid))

  log(
    `Players: ${locked_players.length} locked (actual), ${pending_players.length} pending (simulate)`
  )

  // Filter pending players without projections
  const active_players = pending_players.filter((player) => {
    const projection = projections.get(player.pid)
    if (projection === undefined || projection === null) {
      log(`No projection for player ${player.pid}, excluding from simulation`)
      return false
    }
    return true
  })

  log(
    `Active players to simulate: ${active_players.length} (${pending_players.length - active_players.length} excluded)`
  )

  if (active_players.length === 0 && locked_players.length === 0) {
    log('No active players, returning equal win probabilities')
    return create_empty_results({ teams, n_simulations, return_raw_scores })
  }

  // Calculate locked score totals per team (constant across all simulations)
  const locked_team_totals = new Map()
  teams.forEach((team) => locked_team_totals.set(team.team_id, 0))
  for (const player of locked_players) {
    const current = locked_team_totals.get(player.team_id) || 0
    locked_team_totals.set(
      player.team_id,
      current + locked_scores.get(player.pid)
    )
  }

  // If no players to simulate, just compare locked totals
  if (active_players.length === 0) {
    log('No players to simulate, using locked scores only')
    return create_locked_only_results({
      teams,
      locked_players,
      locked_scores,
      locked_team_totals,
      n_simulations,
      return_raw_scores
    })
  }

  // Build player index map
  const player_index_map = new Map()
  active_players.forEach((player, index) => {
    player_index_map.set(player.pid, index)
  })

  // Build correlation matrix
  const { matrix: correlation_matrix, used_fallback: correlation_fallback } =
    build_correlation_matrix({
      players: active_players,
      schedule,
      correlation_cache,
      archetypes
    })

  log(
    `Correlation matrix size: ${correlation_matrix.length}x${correlation_matrix.length}`
  )

  // Fit distributions for each player
  const distribution_params = active_players.map((player) => {
    const projected_points = projections.get(player.pid) || 0
    const variance_data = variance_cache.get(player.pid)

    // Use historical std_points or position-specific default CV
    let std_points
    if (variance_data && variance_data.std_points) {
      std_points = variance_data.std_points
    } else {
      const default_cv = get_rookie_default_cv({ position: player.position })
      std_points = projected_points * default_cv
    }

    return get_player_distribution_params({
      projected_points,
      std_points,
      position: player.position
    })
  })

  // Generate correlated uniform samples
  const correlated_uniforms = generate_correlated_uniforms({
    correlation_matrix,
    n_simulations,
    seed
  })

  // Build team -> player indices mapping
  const team_player_indices = new Map()
  teams.forEach((team) => {
    team_player_indices.set(team.team_id, [])
  })
  active_players.forEach((player, index) => {
    const indices = team_player_indices.get(player.team_id)
    if (indices) {
      indices.push(index)
    }
  })

  // Run simulations
  const team_wins = new Map()
  const team_scores = new Map()
  const player_scores = new Map()

  teams.forEach((team) => {
    team_wins.set(team.team_id, 0)
    team_scores.set(team.team_id, [])
  })
  active_players.forEach((player) => {
    player_scores.set(player.pid, [])
  })

  for (let sim = 0; sim < n_simulations; sim++) {
    const uniforms = correlated_uniforms[sim]

    // Sample player scores
    const sampled_scores = distribution_params.map((params, index) =>
      sample_from_distribution({
        uniform_sample: uniforms[index],
        distribution_type: params.distribution_type,
        distribution_params: params.distribution_params
      })
    )

    // Track player scores
    sampled_scores.forEach((score, index) => {
      const player = active_players[index]
      player_scores.get(player.pid).push(score)
    })

    // Calculate team totals (simulated + locked)
    const team_totals = new Map()
    teams.forEach((team) => {
      const player_indices = team_player_indices.get(team.team_id)
      const simulated_total = player_indices.reduce(
        (sum, idx) => sum + sampled_scores[idx],
        0
      )
      const locked_total = locked_team_totals.get(team.team_id) || 0
      const total = simulated_total + locked_total
      team_totals.set(team.team_id, total)
      team_scores.get(team.team_id).push(total)
    })

    // Determine winner and distribute credit (handles ties by splitting)
    const { winners, win_credit } = find_winners({ team_scores: team_totals })
    distribute_win_credit({ team_wins, winners, win_credit })
  }

  // Calculate results
  const win_probabilities = new Map()
  const score_distributions = new Map()
  const player_score_distributions = new Map()

  teams.forEach((team) => {
    const wins = team_wins.get(team.team_id)
    win_probabilities.set(team.team_id, wins / n_simulations)

    const scores = team_scores.get(team.team_id)
    score_distributions.set(
      team.team_id,
      calculate_distribution(scores, { include_percentiles: true })
    )
  })

  active_players.forEach((player) => {
    const scores = player_scores.get(player.pid)
    player_score_distributions.set(
      player.pid,
      calculate_distribution(scores, {
        include_percentiles: false,
        is_locked: false
      })
    )
  })

  // Add locked players to distributions (constant values)
  locked_players.forEach((player) => {
    const actual_points = locked_scores.get(player.pid)
    player_score_distributions.set(
      player.pid,
      create_constant_distribution(actual_points)
    )
  })

  const elapsed_ms = Date.now() - start_time
  log(`Simulation completed in ${elapsed_ms}ms`)

  const result = {
    win_probabilities,
    score_distributions,
    player_score_distributions,
    n_simulations,
    elapsed_ms,
    correlation_fallback,
    locked_player_count: locked_players.length
  }

  // Include raw scores if requested (for multi-week aggregation)
  if (return_raw_scores) {
    result.raw_team_scores = team_scores
  }

  return result
}

/**
 * Build a simulation result object.
 * Shared helper to reduce duplication between result-building functions.
 */
function build_simulation_result({
  teams,
  win_probabilities,
  score_distributions,
  player_score_distributions = new Map(),
  n_simulations,
  elapsed_ms = 0,
  correlation_fallback,
  locked_player_count = 0,
  return_raw_scores = false,
  raw_scores_generator // Function: (team) => scores array
}) {
  const result = {
    win_probabilities,
    score_distributions,
    player_score_distributions,
    n_simulations,
    elapsed_ms,
    locked_player_count
  }

  if (correlation_fallback !== undefined) {
    result.correlation_fallback = correlation_fallback
  }

  if (return_raw_scores && raw_scores_generator) {
    const raw_team_scores = new Map()
    teams.forEach((team) => {
      raw_team_scores.set(team.team_id, raw_scores_generator(team))
    })
    result.raw_team_scores = raw_team_scores
  }

  return result
}

/**
 * Create empty results when no active players.
 */
function create_empty_results({ teams, n_simulations, return_raw_scores }) {
  const equal_probability = 1 / teams.length
  const win_probabilities = new Map()
  const score_distributions = new Map()
  const zero_distribution = create_constant_distribution(0, {
    include_percentiles: true
  })

  teams.forEach((team) => {
    win_probabilities.set(team.team_id, equal_probability)
    score_distributions.set(team.team_id, zero_distribution)
  })

  return build_simulation_result({
    teams,
    win_probabilities,
    score_distributions,
    n_simulations,
    return_raw_scores,
    raw_scores_generator: () => new Array(n_simulations).fill(0)
  })
}

/**
 * Create results when all players are locked (no simulation needed).
 */
function create_locked_only_results({
  teams,
  locked_players,
  locked_scores,
  locked_team_totals,
  n_simulations,
  return_raw_scores
}) {
  const { winners } = find_winners({ team_scores: locked_team_totals })
  const win_credit = 1 / winners.length

  const win_probabilities = new Map()
  const score_distributions = new Map()
  const player_score_distributions = new Map()

  teams.forEach((team) => {
    const is_winner = winners.includes(team.team_id)
    win_probabilities.set(team.team_id, is_winner ? win_credit : 0)

    const total = locked_team_totals.get(team.team_id)
    score_distributions.set(
      team.team_id,
      create_constant_distribution(total, { include_percentiles: true })
    )
  })

  locked_players.forEach((player) => {
    const actual_points = locked_scores.get(player.pid)
    player_score_distributions.set(
      player.pid,
      create_constant_distribution(actual_points)
    )
  })

  return build_simulation_result({
    teams,
    win_probabilities,
    score_distributions,
    player_score_distributions,
    n_simulations,
    correlation_fallback: false,
    locked_player_count: locked_players.length,
    return_raw_scores,
    raw_scores_generator: (team) => {
      const total = locked_team_totals.get(team.team_id)
      return new Array(n_simulations).fill(total)
    }
  })
}
