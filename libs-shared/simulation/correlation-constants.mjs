/**
 * Position-based default correlations and archetype adjustments for fantasy football simulation.
 * Values derived from historical analysis of 816 NFL games (2022-2024 regular season).
 */

// Position rank identifiers
export const POSITION_RANKS = {
  QB: 'QB',
  WR1: 'WR1',
  WR2: 'WR2',
  WR3: 'WR3',
  RB1: 'RB1',
  RB2: 'RB2',
  TE1: 'TE1',
  K: 'K',
  DST: 'DST'
}

/**
 * Same-team correlations matrix.
 * Index by [position_rank_a][position_rank_b] to get correlation.
 * Values are symmetric (corr(A,B) = corr(B,A)).
 */
export const SAME_TEAM_CORRELATIONS = {
  QB: {
    QB: 1.0,
    WR1: 0.42,
    WR2: 0.35,
    WR3: 0.28,
    RB1: 0.15,
    RB2: 0.08,
    TE1: 0.32,
    K: 0.12,
    DST: -0.04
  },
  WR1: {
    QB: 0.42,
    WR1: 1.0,
    WR2: 0.26,
    WR3: 0.18,
    RB1: 0.12,
    RB2: 0.06,
    TE1: 0.15,
    K: 0.05,
    DST: 0.0
  },
  WR2: {
    QB: 0.35,
    WR1: 0.26,
    WR2: 1.0,
    WR3: 0.2,
    RB1: 0.1,
    RB2: 0.05,
    TE1: 0.12,
    K: 0.04,
    DST: 0.0
  },
  WR3: {
    QB: 0.28,
    WR1: 0.18,
    WR2: 0.2,
    WR3: 1.0,
    RB1: 0.08,
    RB2: 0.04,
    TE1: 0.1,
    K: 0.03,
    DST: 0.0
  },
  RB1: {
    QB: 0.15,
    WR1: 0.12,
    WR2: 0.1,
    WR3: 0.08,
    RB1: 1.0,
    RB2: 0.06,
    TE1: 0.08,
    K: 0.0,
    DST: 0.0
  },
  RB2: {
    QB: 0.08,
    WR1: 0.06,
    WR2: 0.05,
    WR3: 0.04,
    RB1: 0.06,
    RB2: 1.0,
    TE1: 0.05,
    K: 0.0,
    DST: 0.0
  },
  TE1: {
    QB: 0.32,
    WR1: 0.15,
    WR2: 0.12,
    WR3: 0.1,
    RB1: 0.08,
    RB2: 0.05,
    TE1: 1.0,
    K: 0.04,
    DST: 0.0
  },
  K: {
    QB: 0.12,
    WR1: 0.05,
    WR2: 0.04,
    WR3: 0.03,
    RB1: 0.0,
    RB2: 0.0,
    TE1: 0.04,
    K: 1.0,
    DST: 0.0
  },
  DST: {
    QB: -0.04,
    WR1: 0.0,
    WR2: 0.0,
    WR3: 0.0,
    RB1: 0.0,
    RB2: 0.0,
    TE1: 0.0,
    K: 0.0,
    DST: 1.0
  }
}

/**
 * Cross-team correlations (same NFL game only - opponents).
 * Key insight: DST vs opposing offense is the most significant cross-team correlation.
 */
export const CROSS_TEAM_CORRELATIONS = {
  QB: {
    QB: 0.3, // Shootout indicator
    WR1: 0.15,
    WR2: 0.1,
    WR3: 0.08,
    RB1: 0.21, // Game script - trailing teams run less
    RB2: 0.12,
    TE1: 0.12,
    K: 0.08,
    DST: -0.48 // Strong negative - key correlation
  },
  WR1: {
    QB: 0.15,
    WR1: 0.17,
    WR2: 0.1,
    WR3: 0.08,
    RB1: 0.1,
    RB2: 0.06,
    TE1: 0.1,
    K: 0.05,
    DST: -0.35
  },
  WR2: {
    QB: 0.1,
    WR1: 0.1,
    WR2: 0.12,
    WR3: 0.08,
    RB1: 0.08,
    RB2: 0.05,
    TE1: 0.08,
    K: 0.04,
    DST: -0.25
  },
  WR3: {
    QB: 0.08,
    WR1: 0.08,
    WR2: 0.08,
    WR3: 0.1,
    RB1: 0.06,
    RB2: 0.04,
    TE1: 0.06,
    K: 0.03,
    DST: -0.2
  },
  RB1: {
    QB: 0.21,
    WR1: 0.1,
    WR2: 0.08,
    WR3: 0.06,
    RB1: 0.15,
    RB2: 0.08,
    TE1: 0.08,
    K: 0.05,
    DST: -0.3
  },
  RB2: {
    QB: 0.12,
    WR1: 0.06,
    WR2: 0.05,
    WR3: 0.04,
    RB1: 0.08,
    RB2: 0.1,
    TE1: 0.05,
    K: 0.03,
    DST: -0.2
  },
  TE1: {
    QB: 0.12,
    WR1: 0.1,
    WR2: 0.08,
    WR3: 0.06,
    RB1: 0.08,
    RB2: 0.05,
    TE1: 0.1,
    K: 0.04,
    DST: -0.28
  },
  K: {
    QB: 0.08,
    WR1: 0.05,
    WR2: 0.04,
    WR3: 0.03,
    RB1: 0.05,
    RB2: 0.03,
    TE1: 0.04,
    K: 0.06,
    DST: -0.15
  },
  DST: {
    QB: -0.48,
    WR1: -0.35,
    WR2: -0.25,
    WR3: -0.2,
    RB1: -0.3,
    RB2: -0.2,
    TE1: -0.28,
    K: -0.15,
    DST: 0.2 // Both defenses benefit in low-scoring games
  }
}

/**
 * Archetype definitions with thresholds.
 */
export const ARCHETYPE_THRESHOLDS = {
  QB: {
    rushing_qb: { min_rushing_rate: 7.0 }, // >= 7.0 rush att/game
    mobile_qb: { min_rushing_rate: 4.0, max_rushing_rate: 6.99 },
    pocket_passer: { max_rushing_rate: 3.99 }
  },
  WR: {
    target_hog_wr: { min_target_share: 0.28 }, // >= 28% target share
    wr1_level: { min_target_share: 0.22, max_target_share: 0.279 },
    wr2_level: { min_target_share: 0.15, max_target_share: 0.219 },
    wr3_level: { max_target_share: 0.149 }
  },
  RB: {
    pass_catching_rb: { min_target_ratio: 0.35 }, // >= 35% targets/opportunities
    hybrid_rb: { min_target_ratio: 0.2, max_target_ratio: 0.349 },
    traditional_rb: { max_target_ratio: 0.199 }
  }
}

/**
 * Archetype correlation adjustments.
 * Applied when player-specific correlation is unavailable.
 */
export const ARCHETYPE_ADJUSTMENTS = {
  // Rushing QB adjustments
  rushing_qb: {
    own_rb: -0.2, // Rushing QBs cannibalize RB touches
    own_wr1: -0.05 // Slightly fewer pass attempts
  },
  mobile_qb: {
    own_rb: -0.1,
    own_wr1: -0.02
  },
  pocket_passer: {
    own_rb: 0.05 // Game script more favorable to RB
  },

  // WR archetype adjustments
  target_hog_wr: {
    own_qb: 0.1 // High target share = more QB correlation
  },
  wr1_level: {
    own_qb: 0.03
  },

  // RB archetype adjustments
  pass_catching_rb: {
    own_qb: 0.08 // More targets = more QB correlation
  },
  hybrid_rb: {
    own_qb: 0.04
  }
}

/**
 * Coefficient of variation (CV) bounds by position.
 * Used to constrain variance for distribution fitting.
 * Values derived from database analysis (2022-2024 gamelogs, players with 6+ games).
 */
export const CV_BOUNDS = {
  QB: { min: 0.45, max: 2.7 },
  RB: { min: 0.55, max: 2.5 },
  WR: { min: 0.6, max: 2.5 },
  TE: { min: 0.65, max: 2.85 },
  K: { min: 0.45, max: 1.7 },
  DST: { min: 0.75, max: 1.55 }
}

/**
 * Truncated normal distribution defaults for rarely-used players.
 * Used when mean_points <= 0 (fumble-prone gunners, blocking TEs).
 */
export const TRUNCATED_NORMAL_DEFAULTS = {
  mean: 0.5, // Small positive mean for rarely-used players
  std: 1.5 // Moderate variance to allow occasional big plays
}

/**
 * Default CV values for rookies/players without history.
 * Rookies are MORE volatile than veterans.
 */
export const ROOKIE_DEFAULT_CV = {
  QB: 1.05,
  RB: 1.0,
  WR: 1.05,
  TE: 0.95,
  K: 0.95,
  DST: 1.1
}

/**
 * Correlation blending thresholds.
 */
export const CORRELATION_THRESHOLDS = {
  MIN_GAMES_FOR_PLAYER_SPECIFIC: 12,
  MIN_GAMES_FOR_BLENDING: 6
}

/**
 * Simulation engine defaults.
 */
export const SIMULATION_DEFAULTS = {
  N_SIMULATIONS: 10000,
  MATRIX_REGULARIZATION_EPSILON: 0.05,
  MIN_EIGENVALUE_THRESHOLD: 1e-6
}

/**
 * Game outcome correlation thresholds.
 */
export const GAME_OUTCOME_THRESHOLDS = {
  MIN_GAMES_FOR_CORRELATION: 8,
  MIN_GAMES_PER_STATE: 3,
  MIN_GAMES_FOR_FULL_CONFIDENCE: 14,
  MIN_GAMES_PER_STATE_FULL_CONFIDENCE: 5,
  MIN_CONFIDENCE_FOR_PLAYER_SPECIFIC: 0.8,
  MIN_CONFIDENCE_FOR_BLENDING: 0.3
}

/**
 * Game environment constants for variance scaling and spread adjustments.
 */
export const GAME_ENVIRONMENT_CONSTANTS = {
  BASELINE_GAME_TOTAL: 46,
  VARIANCE_SCALE_COEFFICIENT: 0.003,
  MIN_VARIANCE_SCALE: 0.85,
  MAX_VARIANCE_SCALE: 1.15
}

/**
 * Position-specific spread adjustment coefficients.
 * Positive = favored team boost, Negative = underdog boost.
 */
export const SPREAD_ADJUSTMENT_COEFFICIENTS = {
  QB: 0.002,
  RB: 0.005,
  WR: -0.003,
  TE: 0.0,
  K: 0.003,
  DST: 0.004
}

/**
 * Market source preference order for loading projections.
 */
export const MARKET_SOURCE_PREFERENCE = ['FANDUEL', 'DRAFTKINGS']

/**
 * Map bare positions to default position ranks for correlation lookup.
 * Used when position_rank is not available (e.g., rookies without gamelogs).
 * Conservative defaults: WR->WR3, RB->RB2 (lower correlation impact).
 */
export const POSITION_TO_DEFAULT_RANK = {
  WR: 'WR3',
  RB: 'RB2',
  TE: 'TE1',
  QB: 'QB',
  K: 'K',
  DST: 'DST'
}

/**
 * Normalize a position or position_rank to a valid correlation matrix key.
 * Handles bare positions (WR, RB, TE) by mapping to default ranks.
 *
 * @param {string} position_rank - Position rank (e.g., 'WR1') or bare position (e.g., 'WR')
 * @returns {string} Valid matrix key
 */
export function normalize_position_rank(position_rank) {
  // Already a valid key in the matrix
  if (SAME_TEAM_CORRELATIONS[position_rank]) {
    return position_rank
  }

  // Map bare position to default rank
  return POSITION_TO_DEFAULT_RANK[position_rank] || position_rank
}

/**
 * Get default correlation between two positions.
 * Normalizes bare positions (WR, RB, TE) to ranked positions (WR3, RB2, TE1) internally.
 *
 * @param {Object} params
 * @param {string} params.position_rank_a - Position rank of first player (e.g., 'QB', 'WR1') or bare position (e.g., 'WR')
 * @param {string} params.position_rank_b - Position rank of second player
 * @param {string} params.relationship_type - 'same_team' or 'cross_team_same_game'
 * @returns {number} Default correlation value
 */
export function get_default_correlation({
  position_rank_a,
  position_rank_b,
  relationship_type
}) {
  // Normalize bare positions to valid matrix keys
  const normalized_a = normalize_position_rank(position_rank_a)
  const normalized_b = normalize_position_rank(position_rank_b)

  const correlation_matrix =
    relationship_type === 'same_team'
      ? SAME_TEAM_CORRELATIONS
      : CROSS_TEAM_CORRELATIONS

  // Get the correlation from matrix
  const correlation = correlation_matrix[normalized_a]?.[normalized_b]

  if (correlation !== undefined) {
    return correlation
  }

  // Fallback for undefined pairs (K-K cross-team, etc.)
  // Same position, different teams = independent
  if (normalized_a === normalized_b) {
    return 0
  }

  // Ultimate fallback
  return 0
}

/**
 * Apply archetype adjustments to a default correlation.
 *
 * @param {Object} params
 * @param {number} params.base_correlation - The default position-based correlation
 * @param {string} params.archetype_a - Archetype of first player (or null)
 * @param {string} params.archetype_b - Archetype of second player (or null)
 * @param {string} params.position_a - Position of first player
 * @param {string} params.position_b - Position of second player
 * @param {string} params.position_rank_a - Position rank of first player (e.g., 'WR1', 'RB2')
 * @param {string} params.position_rank_b - Position rank of second player
 * @param {string} params.relationship_type - 'same_team' or 'cross_team_same_game'
 * @returns {number} Adjusted correlation
 */
export function apply_archetype_adjustment({
  base_correlation,
  archetype_a,
  archetype_b,
  position_a,
  position_b,
  position_rank_a,
  position_rank_b,
  relationship_type
}) {
  if (relationship_type !== 'same_team') {
    // Archetype adjustments only apply to same-team correlations
    return base_correlation
  }

  let adjustment = 0

  // Check if player A's archetype affects correlation with player B
  if (archetype_a && ARCHETYPE_ADJUSTMENTS[archetype_a]) {
    const adjustments = ARCHETYPE_ADJUSTMENTS[archetype_a]
    // own_rb applies to all RBs (RB1, RB2)
    if (position_b === 'RB' && adjustments.own_rb) {
      adjustment += adjustments.own_rb
    }
    // own_wr1 applies only to WR1 (per task plan line 443)
    if (position_rank_b === 'WR1' && adjustments.own_wr1) {
      adjustment += adjustments.own_wr1
    }
    if (position_b === 'QB' && adjustments.own_qb) {
      adjustment += adjustments.own_qb
    }
  }

  // Check if player B's archetype affects correlation with player A
  if (archetype_b && ARCHETYPE_ADJUSTMENTS[archetype_b]) {
    const adjustments = ARCHETYPE_ADJUSTMENTS[archetype_b]
    // own_rb applies to all RBs (RB1, RB2)
    if (position_a === 'RB' && adjustments.own_rb) {
      adjustment += adjustments.own_rb
    }
    // own_wr1 applies only to WR1 (per task plan line 443)
    if (position_rank_a === 'WR1' && adjustments.own_wr1) {
      adjustment += adjustments.own_wr1
    }
    if (position_a === 'QB' && adjustments.own_qb) {
      adjustment += adjustments.own_qb
    }
  }

  // Clamp the adjusted correlation to [-1, 1]
  return Math.max(-1, Math.min(1, base_correlation + adjustment))
}
