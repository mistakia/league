/**
 * libs-server/simulation index
 * Export all server-side simulation functions.
 */

// Simulation orchestrators
export { simulate_matchup, simulate_championship } from './simulate-matchup.mjs'

// Lineup analysis
export {
  analyze_lineup_decisions,
  get_correlation_insights,
  get_correlation_opportunities,
  get_same_team_correlations
} from './analyze-lineup-decisions.mjs'

// Data loaders
export {
  load_player_projections,
  load_player_variance,
  load_player_archetypes,
  load_simulation_rosters,
  load_player_info,
  load_scoring_format,
  load_actual_player_points
} from './load-simulation-data.mjs'

// Correlation loaders (consolidated)
export {
  load_correlations,
  load_correlations_for_players,
  load_correlations_between_sets,
  load_correlations_within_set,
  load_correlations_smart
} from './load-correlations.mjs'

// NFL schedule
export {
  load_nfl_schedule,
  load_nfl_schedules_for_weeks,
  get_team_opponent,
  NFL_TEAMS
} from './load-nfl-schedule.mjs'

// Position ranks
export {
  load_position_ranks,
  get_position_rank
} from './calculate-position-ranks.mjs'

// Data loaders with fallback support
export {
  load_rosters_with_fallback,
  load_projections_with_fallback,
  load_bench_players_with_fallback
} from './load-data-with-fallback.mjs'
