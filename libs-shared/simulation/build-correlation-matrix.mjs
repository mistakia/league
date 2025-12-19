/**
 * Correlation matrix builder for fantasy football simulation.
 * Builds player-specific correlation matrices from pre-loaded data (pure function).
 */

import debug from 'debug'

import {
  get_default_correlation,
  apply_archetype_adjustment,
  CORRELATION_THRESHOLDS,
  SIMULATION_DEFAULTS
} from './correlation-constants.mjs'
import { ensure_positive_definite } from './ensure-positive-definite.mjs'
import {
  get_player_relationship,
  is_correlation_stale_due_to_team_change,
  RELATIONSHIP_TYPES
} from './get-player-relationship.mjs'

const log = debug('simulation:build-correlation-matrix')

/**
 * Get normalized cache key for correlation lookup.
 * Enforces pid_a < pid_b ordering to match database constraint.
 *
 * @param {Object} params
 * @param {string} params.player_id_a - First player ID
 * @param {string} params.player_id_b - Second player ID
 * @returns {string} Normalized cache key
 */
export function get_correlation_cache_key({ player_id_a, player_id_b }) {
  return player_id_a < player_id_b
    ? `${player_id_a}:${player_id_b}`
    : `${player_id_b}:${player_id_a}`
}

/**
 * Get correlation between two players using the correlation lookup hierarchy.
 * Hierarchy: player-specific -> blended -> archetype-adjusted default -> position default -> 0
 *
 * @param {Object} params
 * @param {Object} params.player_a - First player { pid, nfl_team, position, position_rank }
 * @param {Object} params.player_b - Second player { pid, nfl_team, position, position_rank }
 * @param {string} params.relationship - Relationship type from get_player_relationship
 * @param {Map} params.correlation_cache - Pre-loaded correlations from database
 * @param {Map} params.archetypes - Map of pid -> archetype
 * @returns {number} Correlation value
 */
export function get_player_pair_correlation({
  player_a,
  player_b,
  relationship,
  correlation_cache,
  archetypes
}) {
  // Independent relationship = no correlation
  if (relationship === RELATIONSHIP_TYPES.INDEPENDENT) {
    return 0
  }

  // Null relationship = bye week, treat as no correlation
  if (relationship === null) {
    return 0
  }

  // Same player = perfect correlation
  if (player_a.pid === player_b.pid) {
    return 1
  }

  // Get position ranks for default lookup
  const position_rank_a = player_a.position_rank || player_a.position
  const position_rank_b = player_b.position_rank || player_b.position

  // Look up player-specific correlation from cache
  const cache_key = get_correlation_cache_key({
    player_id_a: player_a.pid,
    player_id_b: player_b.pid
  })

  const cached_correlation = correlation_cache?.get(cache_key)

  if (cached_correlation) {
    // Check if correlation is stale due to team change
    const is_stale = is_correlation_stale_due_to_team_change({
      current_team_a: player_a.nfl_team,
      current_team_b: player_b.nfl_team,
      correlation_team_a: cached_correlation.team_a,
      correlation_team_b: cached_correlation.team_b
    })

    if (is_stale) {
      log(
        `Correlation stale for ${player_a.pid}-${player_b.pid} due to team change, using default`
      )
    } else {
      const { games_together, correlation } = cached_correlation

      // Apply correlation hierarchy based on game count
      if (
        games_together >= CORRELATION_THRESHOLDS.MIN_GAMES_FOR_PLAYER_SPECIFIC
      ) {
        // 12+ games: Use player-specific correlation
        return correlation
      }

      if (games_together >= CORRELATION_THRESHOLDS.MIN_GAMES_FOR_BLENDING) {
        // 6-11 games: Blend player correlation with default
        const default_correlation = get_archetype_adjusted_default({
          player_a,
          player_b,
          position_rank_a,
          position_rank_b,
          relationship,
          archetypes
        })

        // Linear interpolation: weight increases from 0 at 6 games to 1 at 12 games
        const blend_weight =
          (games_together - CORRELATION_THRESHOLDS.MIN_GAMES_FOR_BLENDING) /
          (CORRELATION_THRESHOLDS.MIN_GAMES_FOR_PLAYER_SPECIFIC -
            CORRELATION_THRESHOLDS.MIN_GAMES_FOR_BLENDING)

        return (
          blend_weight * correlation + (1 - blend_weight) * default_correlation
        )
      }
    }
  }

  // <6 games or no data: Use archetype-adjusted position default
  return get_archetype_adjusted_default({
    player_a,
    player_b,
    position_rank_a,
    position_rank_b,
    relationship,
    archetypes
  })
}

/**
 * Get archetype-adjusted default correlation.
 *
 * @param {Object} params
 * @returns {number} Adjusted default correlation
 */
function get_archetype_adjusted_default({
  player_a,
  player_b,
  position_rank_a,
  position_rank_b,
  relationship,
  archetypes
}) {
  const base_correlation = get_default_correlation({
    position_rank_a,
    position_rank_b,
    relationship_type: relationship
  })

  const archetype_a = archetypes?.get(player_a.pid)
  const archetype_b = archetypes?.get(player_b.pid)

  return apply_archetype_adjustment({
    base_correlation,
    archetype_a,
    archetype_b,
    position_a: player_a.position,
    position_b: player_b.position,
    position_rank_a,
    position_rank_b,
    relationship_type: relationship
  })
}

/**
 * Build a correlation matrix for a set of players.
 *
 * @param {Object} params
 * @param {Object[]} params.players - Array of players with { pid, nfl_team, position, position_rank }
 * @param {Object} params.schedule - Pre-loaded NFL schedule from libs-server
 * @param {Map} params.correlation_cache - Pre-loaded correlations from database
 * @param {Map} params.archetypes - Map of pid -> archetype
 * @param {number} [params.epsilon] - Regularization strength for positive definiteness
 * @returns {Object} { matrix, player_indices, used_fallback }
 */
export function build_correlation_matrix({
  players,
  schedule,
  correlation_cache,
  archetypes,
  epsilon = SIMULATION_DEFAULTS.MATRIX_REGULARIZATION_EPSILON
}) {
  const n = players.length

  if (n === 0) {
    return { matrix: [], player_indices: new Map() }
  }

  // Build player index map for fast lookup
  const player_indices = new Map()
  players.forEach((player, index) => {
    player_indices.set(player.pid, index)
  })

  // Initialize matrix with 1s on diagonal
  const matrix = []
  for (let i = 0; i < n; i++) {
    const row = new Array(n).fill(0)
    row[i] = 1
    matrix.push(row)
  }

  // Fill in correlations (matrix is symmetric)
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const player_a = players[i]
      const player_b = players[j]

      // Determine relationship
      const relationship = get_player_relationship({
        player_a,
        player_b,
        schedule
      })

      // Get correlation
      const correlation = get_player_pair_correlation({
        player_a,
        player_b,
        relationship,
        correlation_cache,
        archetypes
      })

      // Set both [i][j] and [j][i] (symmetric)
      matrix[i][j] = correlation
      matrix[j][i] = correlation
    }
  }

  log(`Built ${n}x${n} correlation matrix`)

  // Ensure positive definiteness
  const { matrix: regularized_matrix, used_fallback } =
    ensure_positive_definite({
      matrix,
      epsilon
    })

  return {
    matrix: regularized_matrix,
    player_indices,
    used_fallback
  }
}

/**
 * Get correlation for a specific pair from a built matrix.
 *
 * @param {Object} params
 * @param {number[][]} params.matrix - Correlation matrix
 * @param {Map} params.player_indices - Map of pid -> index
 * @param {string} params.pid_a - First player ID
 * @param {string} params.pid_b - Second player ID
 * @returns {number|null} Correlation value or null if player not in matrix
 */
export function get_correlation_from_matrix({
  matrix,
  player_indices,
  pid_a,
  pid_b
}) {
  const index_a = player_indices.get(pid_a)
  const index_b = player_indices.get(pid_b)

  if (index_a === undefined || index_b === undefined) {
    return null
  }

  return matrix[index_a][index_b]
}
