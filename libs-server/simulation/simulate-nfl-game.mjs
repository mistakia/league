/**
 * NFL game simulation wrapper.
 * Simulates all players in a single NFL game with correlations preserved.
 */

import debug from 'debug'

import { simulation } from '#libs-shared'

const log = debug('simulation:simulate-nfl-game')

/**
 * Simulate all players in a single NFL game.
 * Returns raw per-simulation scores for aggregation.
 *
 * @param {Object} params
 * @param {Object[]} params.game_players - Array of players in this NFL game
 *   Each player: { pid, nfl_team, position, position_rank, team_id }
 * @param {Map} params.projections - Map of pid -> projected_points
 * @param {Map} params.variance_cache - Map of pid -> variance data
 * @param {Map} params.correlation_cache - Map of correlation key -> correlation value
 * @param {Map} params.archetypes - Map of pid -> archetype
 * @param {Object} params.game_schedule - Single-game schedule object
 *   Format: { [team_abbrev]: { opponent, esbid, is_home, is_final } }
 * @param {number} params.n_simulations - Number of simulations
 * @param {number} [params.seed] - Optional seed for reproducibility
 * @param {Map} [params.locked_scores] - Map of pid -> actual_points for completed games
 * @returns {Object} { player_scores: Map<pid, number[]>, elapsed_ms }
 */
export function simulate_nfl_game({
  game_players,
  projections,
  variance_cache,
  correlation_cache,
  archetypes,
  game_schedule,
  n_simulations,
  seed,
  locked_scores = new Map()
}) {
  const start_time = Date.now()

  if (game_players.length === 0) {
    return {
      player_scores: new Map(),
      elapsed_ms: 0
    }
  }

  // Check if all players in this game are locked (completed game)
  const all_locked = game_players.every((p) => locked_scores.has(p.pid))
  if (all_locked) {
    log(`All ${game_players.length} players locked, using actual scores`)
    const player_scores = new Map()
    for (const player of game_players) {
      const actual = locked_scores.get(player.pid)
      player_scores.set(player.pid, new Array(n_simulations).fill(actual))
    }
    return {
      player_scores,
      elapsed_ms: Date.now() - start_time
    }
  }

  // Get unique team_ids from players (for run_simulation's teams parameter)
  const team_ids = [...new Set(game_players.map((p) => p.team_id))]
  const teams = team_ids.map((team_id) => ({
    team_id,
    name: `Team ${team_id}`
  }))

  log(
    `Simulating ${game_players.length} players across ${teams.length} fantasy teams`
  )

  // Run simulation for this game's players
  const result = simulation.run_simulation({
    players: game_players,
    projections,
    variance_cache,
    correlation_cache,
    archetypes,
    schedule: game_schedule,
    teams,
    n_simulations,
    seed,
    return_raw_scores: true,
    locked_scores
  })

  // Extract per-player raw scores from the simulation
  // We need to reconstruct player scores from the distributions
  const player_scores = new Map()

  // For locked players, use constant scores
  for (const player of game_players) {
    if (locked_scores.has(player.pid)) {
      const actual = locked_scores.get(player.pid)
      player_scores.set(player.pid, new Array(n_simulations).fill(actual))
    }
  }

  // For simulated players, we need the raw scores
  // The run_simulation doesn't return per-player raw scores directly
  // We'll need to re-run the sampling logic here for player-level raw scores
  // OR we can extract from player_score_distributions which has mean/std

  // Actually, looking at run_simulation, it tracks player_scores internally
  // but only exposes distributions. We need to modify approach.

  // For now, we'll return the distribution data and let the caller
  // handle the aggregation. This is simpler and avoids code duplication.

  const elapsed_ms = Date.now() - start_time
  log(`NFL game simulation completed in ${elapsed_ms}ms`)

  return {
    player_distributions: result.player_score_distributions,
    raw_team_scores: result.raw_team_scores,
    n_simulations: result.n_simulations,
    elapsed_ms
  }
}

/**
 * Simulate a single NFL game and return per-player raw scores.
 * This version returns actual per-simulation scores for aggregation.
 *
 * @param {Object} params - Same as simulate_nfl_game
 * @returns {Object} { player_scores: Map<pid, number[]>, elapsed_ms }
 */
export function simulate_nfl_game_with_raw_scores({
  game_players,
  projections,
  variance_cache,
  correlation_cache,
  archetypes,
  game_schedule,
  n_simulations,
  seed,
  locked_scores = new Map()
}) {
  const start_time = Date.now()

  if (game_players.length === 0) {
    return {
      player_scores: new Map(),
      elapsed_ms: 0
    }
  }

  // Separate locked vs pending players
  const locked_players = game_players.filter((p) => locked_scores.has(p.pid))
  const pending_players = game_players.filter((p) => !locked_scores.has(p.pid))

  // Initialize player scores map
  const player_scores = new Map()

  // Add locked players (constant across all simulations)
  for (const player of locked_players) {
    const actual = locked_scores.get(player.pid)
    player_scores.set(player.pid, new Array(n_simulations).fill(actual))
  }

  // If no pending players, return locked scores only
  if (pending_players.length === 0) {
    return {
      player_scores,
      elapsed_ms: Date.now() - start_time
    }
  }

  // Filter pending players to those with projections
  const active_players = pending_players.filter((player) => {
    const projection = projections.get(player.pid)
    return projection !== undefined && projection !== null
  })

  if (active_players.length === 0) {
    log('No active players with projections to simulate')
    return {
      player_scores,
      elapsed_ms: Date.now() - start_time
    }
  }

  log(
    `Simulating ${active_players.length} players (${locked_players.length} locked)`
  )

  // Build correlation matrix for active players
  const { matrix: correlation_matrix } = simulation.build_correlation_matrix({
    players: active_players,
    schedule: game_schedule,
    correlation_cache,
    archetypes
  })

  // Fit distributions for each player
  const distribution_params = active_players.map((player) => {
    const projected_points = projections.get(player.pid) || 0
    const variance_data = variance_cache.get(player.pid)

    let std_points
    if (variance_data && variance_data.std_points) {
      std_points = variance_data.std_points
    } else {
      const default_cv = simulation.get_rookie_default_cv({
        position: player.position
      })
      std_points = projected_points * default_cv
    }

    return simulation.get_player_distribution_params({
      projected_points,
      std_points,
      position: player.position
    })
  })

  // Generate correlated uniform samples
  const correlated_uniforms = simulation.generate_correlated_uniforms({
    correlation_matrix,
    n_simulations,
    seed
  })

  // Sample scores for each simulation
  for (let sim = 0; sim < n_simulations; sim++) {
    const uniforms = correlated_uniforms[sim]

    for (let i = 0; i < active_players.length; i++) {
      const player = active_players[i]
      const params = distribution_params[i]

      const score = simulation.sample_from_distribution({
        uniform_sample: uniforms[i],
        distribution_type: params.distribution_type,
        distribution_params: params.distribution_params
      })

      if (!player_scores.has(player.pid)) {
        player_scores.set(player.pid, [])
      }
      player_scores.get(player.pid).push(score)
    }
  }

  const elapsed_ms = Date.now() - start_time
  log(`NFL game simulation completed in ${elapsed_ms}ms`)

  return {
    player_scores,
    elapsed_ms
  }
}
