/**
 * Extended correlation matrix builder that includes game outcome latent variables.
 * Extends the standard correlation matrix to model player-game correlations.
 */

import debug from 'debug'

import { SIMULATION_DEFAULTS } from './correlation-constants.mjs'
import { ensure_positive_definite } from './ensure-positive-definite.mjs'
import { build_correlation_matrix } from './build-correlation-matrix.mjs'

const log = debug('simulation:build-extended-correlation-matrix')

// Thresholds for game outcome correlation blending
const GAME_OUTCOME_THRESHOLDS = {
  MIN_CONFIDENCE_FOR_PLAYER_SPECIFIC: 0.8,
  MIN_CONFIDENCE_FOR_BLENDING: 0.3
}

/**
 * Get effective game outcome correlation for a player with blending.
 *
 * @param {Object} params
 * @param {string} params.pid - Player ID
 * @param {string} params.pos - Player position
 * @param {string} [params.archetype] - Player archetype
 * @param {Map} params.player_correlations - Map of pid -> { correlation, confidence }
 * @param {Map} params.position_defaults - Map of 'pos' or 'pos:archetype' -> { default_correlation }
 * @returns {number} Effective correlation with game outcome
 */
export function get_effective_game_outcome_correlation({
  pid,
  pos,
  archetype,
  player_correlations,
  position_defaults
}) {
  const player_data = player_correlations?.get(pid)

  // No data at all - use position default
  if (!player_data) {
    return get_position_default(pos, archetype, position_defaults)
  }

  const { correlation, confidence } = player_data

  // High confidence - use player correlation directly
  if (
    confidence >= GAME_OUTCOME_THRESHOLDS.MIN_CONFIDENCE_FOR_PLAYER_SPECIFIC
  ) {
    return correlation
  }

  // Medium confidence - blend with position default
  if (confidence >= GAME_OUTCOME_THRESHOLDS.MIN_CONFIDENCE_FOR_BLENDING) {
    const default_corr = get_position_default(pos, archetype, position_defaults)

    // Linear blend based on confidence
    const blend_weight =
      (confidence - GAME_OUTCOME_THRESHOLDS.MIN_CONFIDENCE_FOR_BLENDING) /
      (GAME_OUTCOME_THRESHOLDS.MIN_CONFIDENCE_FOR_PLAYER_SPECIFIC -
        GAME_OUTCOME_THRESHOLDS.MIN_CONFIDENCE_FOR_BLENDING)

    return blend_weight * correlation + (1 - blend_weight) * default_corr
  }

  // Low confidence - use position default
  return get_position_default(pos, archetype, position_defaults)
}

/**
 * Get position/archetype default correlation.
 */
function get_position_default(pos, archetype, position_defaults) {
  if (!position_defaults) {
    return 0
  }

  // Try archetype-specific first
  if (archetype) {
    const archetype_key = `${pos}:${archetype}`
    const archetype_default = position_defaults.get(archetype_key)
    if (archetype_default) {
      return archetype_default.default_correlation
    }
  }

  // Fall back to position-only
  const position_default = position_defaults.get(pos)
  if (position_default) {
    return position_default.default_correlation
  }

  return 0
}

/**
 * Build an extended correlation matrix that includes game outcome latent variables.
 * The matrix is (N_players + N_games) x (N_players + N_games).
 *
 * @param {Object} params
 * @param {Object[]} params.players - Array of players with { pid, nfl_team, position, position_rank, esbid }
 * @param {Object} params.schedule - Pre-loaded NFL schedule
 * @param {Map} params.correlation_cache - Pre-loaded player-player correlations
 * @param {Map} params.archetypes - Map of pid -> archetype
 * @param {Map} params.game_outcome_correlations - Map of pid -> { correlation, confidence }
 * @param {Map} params.position_defaults - Map of 'pos' or 'pos:archetype' -> { default_correlation }
 * @param {number} [params.epsilon] - Regularization strength
 * @returns {Object} { matrix, player_indices, game_indices, n_players, n_games, used_fallback }
 */
export function build_extended_correlation_matrix({
  players,
  schedule,
  correlation_cache,
  archetypes,
  game_outcome_correlations,
  position_defaults,
  epsilon = SIMULATION_DEFAULTS.MATRIX_REGULARIZATION_EPSILON
}) {
  // First build the standard player-player correlation matrix
  const {
    matrix: player_matrix,
    player_indices,
    used_fallback: player_used_fallback
  } = build_correlation_matrix({
    players,
    schedule,
    correlation_cache,
    archetypes,
    epsilon: 0 // Don't regularize yet, we'll do it at the end
  })

  const n_players = players.length

  // Identify unique games from player schedules
  const game_set = new Set()
  for (const player of players) {
    if (player.esbid) {
      game_set.add(player.esbid)
    }
  }
  const unique_games = [...game_set]
  const n_games = unique_games.length

  log(`Building extended matrix: ${n_players} players + ${n_games} games`)

  // Build game indices map
  const game_indices = new Map()
  unique_games.forEach((esbid, index) => {
    game_indices.set(esbid, n_players + index)
  })

  // Build extended matrix
  const n_total = n_players + n_games
  const extended_matrix = []

  // Initialize with zeros
  for (let i = 0; i < n_total; i++) {
    extended_matrix.push(new Array(n_total).fill(0))
  }

  // Copy player-player correlations
  for (let i = 0; i < n_players; i++) {
    for (let j = 0; j < n_players; j++) {
      extended_matrix[i][j] = player_matrix[i][j]
    }
  }

  // Set game outcome diagonal to 1
  for (let g = 0; g < n_games; g++) {
    const game_idx = n_players + g
    extended_matrix[game_idx][game_idx] = 1
  }

  // Fill player-game correlations
  for (let i = 0; i < n_players; i++) {
    const player = players[i]

    if (!player.esbid) {
      continue
    }

    const game_idx = game_indices.get(player.esbid)
    if (game_idx === undefined) {
      continue
    }

    // Get player's correlation with game outcome
    const game_corr = get_effective_game_outcome_correlation({
      pid: player.pid,
      pos: player.position,
      archetype: archetypes?.get(player.pid),
      player_correlations: game_outcome_correlations,
      position_defaults
    })

    // Set symmetric correlation
    extended_matrix[i][game_idx] = game_corr
    extended_matrix[game_idx][i] = game_corr
  }

  // Game-game correlations are 0 (games are independent)
  // This is already the case from initialization

  log(`Extended matrix built: ${n_total}x${n_total}`)

  // Ensure positive definiteness
  const { matrix: regularized_matrix, used_fallback } =
    ensure_positive_definite({
      matrix: extended_matrix,
      epsilon
    })

  return {
    matrix: regularized_matrix,
    player_indices,
    game_indices,
    n_players,
    n_games,
    used_fallback: used_fallback || player_used_fallback
  }
}

/**
 * Extract game outcome samples from the extended sample array.
 *
 * @param {Object} params
 * @param {number[]} params.samples - Full sample array from extended matrix
 * @param {Map} params.game_indices - Map of esbid -> matrix index
 * @param {number} params.n_players - Number of players in matrix
 * @returns {Map} Map of esbid -> game_outcome_value
 */
export function extract_game_outcome_samples({
  samples,
  game_indices,
  n_players
}) {
  const result = new Map()

  for (const [esbid, matrix_idx] of game_indices) {
    if (matrix_idx < samples.length) {
      result.set(esbid, samples[matrix_idx])
    }
  }

  return result
}

export default build_extended_correlation_matrix
