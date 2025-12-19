/**
 * libs-shared/simulation index
 * Export all pure simulation functions for fantasy football matchup simulation.
 */

// Core simulation engine
export { run_simulation } from './run-simulation.mjs'

// Correlation matrix building
export {
  build_correlation_matrix,
  get_correlation_cache_key,
  get_player_pair_correlation
} from './build-correlation-matrix.mjs'

// Player relationship detection
export {
  get_player_relationship,
  get_teams_on_bye,
  is_team_on_bye,
  get_unique_nfl_games,
  group_players_by_nfl_game,
  is_correlation_stale_due_to_team_change,
  RELATIONSHIP_TYPES
} from './get-player-relationship.mjs'

// Distribution fitting
export {
  fit_gamma_params,
  fit_log_normal_params,
  sample_from_distribution,
  get_player_distribution_params,
  select_distribution,
  constrain_variance,
  get_rookie_default_cv,
  DISTRIBUTION_TYPES
} from './fit-player-distribution.mjs'

// Correlated sampling
export {
  generate_correlated_uniforms,
  generate_single_correlated_sample,
  cholesky_decomposition,
  generate_standard_normals,
  normal_cdf
} from './generate-correlated-samples.mjs'

// Matrix regularization
export {
  ensure_positive_definite,
  is_positive_definite,
  identity_matrix,
  normalize_correlation_matrix
} from './ensure-positive-definite.mjs'

// Correlation constants
export {
  SAME_TEAM_CORRELATIONS,
  CROSS_TEAM_CORRELATIONS,
  ARCHETYPE_ADJUSTMENTS,
  ARCHETYPE_THRESHOLDS,
  CV_BOUNDS,
  ROOKIE_DEFAULT_CV,
  TRUNCATED_NORMAL_DEFAULTS,
  CORRELATION_THRESHOLDS,
  SIMULATION_DEFAULTS,
  POSITION_RANKS,
  POSITION_TO_DEFAULT_RANK,
  get_default_correlation,
  apply_archetype_adjustment,
  normalize_position_rank
} from './correlation-constants.mjs'

// Simulation utilities
export {
  find_winners,
  distribute_win_credit,
  // New unified functions
  calculate_distribution,
  create_constant_distribution,
  // Backward-compatible wrappers (deprecated)
  calculate_score_distribution,
  calculate_player_distribution,
  create_locked_distribution,
  create_locked_team_distribution
} from './simulation-utils.mjs'
