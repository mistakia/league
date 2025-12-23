/**
 * libs-server/simulation index
 * Export all server-side simulation functions.
 */

// Simulation orchestrators
export { simulate_matchup, simulate_championship } from './simulate-matchup.mjs'
export {
  simulate_league_week,
  save_matchup_probabilities
} from './simulate-league-week.mjs'
export {
  simulate_nfl_game,
  simulate_nfl_game_with_raw_scores
} from './simulate-nfl-game.mjs'

// Season forecasting
export {
  simulate_season_forecast,
  simulate_wildcard_forecast,
  simulate_championship_forecast
} from './simulate-season-forecast.mjs'

// Lineup analysis
export {
  analyze_lineup_decisions,
  get_correlation_insights,
  get_correlation_opportunities,
  get_same_team_correlations
} from './analyze-lineup-decisions.mjs'

// Optimal lineup calculation
export {
  calculate_optimal_lineup,
  calculate_optimal_lineups_for_teams,
  load_full_team_roster
} from './calculate-optimal-lineup.mjs'

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

// Shared simulation helpers
export {
  load_simulation_context,
  categorize_players_by_game_status,
  build_simulation_players,
  map_players_to_nfl_games,
  build_game_schedule,
  load_all_league_rosters,
  load_league_matchups,
  calculate_matchup_outcomes,
  calculate_score_stats
} from './simulation-helpers.mjs'

// Market and game environment loaders
export { load_market_projections } from './load-market-projections.mjs'
export { load_game_environment } from './load-game-environment.mjs'

// Game outcome correlation loaders
export { load_player_game_outcome_correlations } from './load-player-game-outcome-correlations.mjs'
export {
  load_position_game_outcome_defaults,
  get_position_default_correlation
} from './load-position-game-outcome-defaults.mjs'
