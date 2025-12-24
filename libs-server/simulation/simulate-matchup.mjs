/**
 * Simulation orchestrator module.
 * Orchestrates simulation by loading data and calling pure functions from libs-shared.
 */

import debug from 'debug'

import { simulation } from '#libs-shared'

import {
  load_player_variance,
  load_player_archetypes,
  load_player_info,
  load_actual_player_points,
  load_scoring_format,
  load_player_projection_stats
} from './load-simulation-data.mjs'
import { merge_player_projections } from './merge-player-projections.mjs'
import { load_correlations_for_players } from './load-correlations.mjs'
import { load_nfl_schedule } from './load-nfl-schedule.mjs'
import { load_position_ranks } from './calculate-position-ranks.mjs'
import {
  load_rosters_with_fallback,
  load_projections_with_fallback
} from './load-data-with-fallback.mjs'
import {
  load_simulation_context,
  categorize_players_by_game_status,
  build_simulation_players
} from './simulation-helpers.mjs'
import { load_market_projections } from './load-market-projections.mjs'
import { load_game_environment } from './load-game-environment.mjs'
import { load_player_game_outcome_correlations } from './load-player-game-outcome-correlations.mjs'
import { load_position_game_outcome_defaults } from './load-position-game-outcome-defaults.mjs'

const log = debug('simulation:simulate-matchup')

// Re-export from split file for backwards compatibility
export { simulate_championship } from './simulate-championship.mjs'

/**
 * Simulate a fantasy matchup between teams.
 *
 * @param {Object} params
 * @param {number} params.league_id - League ID
 * @param {number[]} params.team_ids - Array of fantasy team IDs (2 or more)
 * @param {number} params.week - NFL week to simulate
 * @param {number} params.year - NFL year
 * @param {number} [params.n_simulations=10000] - Number of simulations
 * @param {number} [params.seed] - Optional seed for reproducibility
 * @param {Map} [params.roster_overrides] - Optional Map of team_id -> player_ids[] to override loaded rosters
 * @param {boolean} [params.use_actual_results=true] - Use actual points for completed games
 * @param {number} [params.fallback_week] - Week to use for roster/projections if current week has no data
 * @returns {Promise<Object>} Simulation results
 */
export async function simulate_matchup({
  league_id,
  team_ids,
  week,
  year,
  n_simulations = 10000,
  seed,
  roster_overrides,
  use_actual_results = true,
  fallback_week
}) {
  // Validate team_ids
  if (!Array.isArray(team_ids) || team_ids.length < 2) {
    throw new Error(
      `simulate_matchup requires at least 2 teams, got ${team_ids?.length || 0}`
    )
  }

  log(
    `Starting matchup simulation: league ${league_id}, teams ${team_ids.join(',')}, week ${week}`
  )

  // Load league and scoring format
  const { scoring_format_hash } = await load_simulation_context({
    league_id,
    year
  })

  // Load rosters with fallback support
  const { rosters: loaded_rosters } = await load_rosters_with_fallback({
    league_id,
    team_ids,
    week,
    year,
    fallback_week
  })

  if (loaded_rosters.length === 0) {
    throw new Error('No rosters found for simulation')
  }

  let rosters = loaded_rosters

  // Apply roster overrides if provided
  if (roster_overrides) {
    rosters = rosters.map((roster) => {
      const override_pids = roster_overrides.get(roster.team_id)
      if (override_pids) {
        return { ...roster, player_ids: override_pids }
      }
      return roster
    })
  }

  // Collect all player IDs
  const all_player_ids = [...new Set(rosters.flatMap((r) => r.player_ids))]
  log(`Total players in simulation: ${all_player_ids.length}`)

  // Load player info and schedule first to categorize players
  const [player_info, schedule] = await Promise.all([
    load_player_info({ player_ids: all_player_ids }),
    load_nfl_schedule({ year, week })
  ])

  // Categorize players into locked (completed games) vs pending
  const { locked_player_ids, pending_player_ids, completed_esbids } =
    categorize_players_by_game_status({
      player_ids: all_player_ids,
      player_info,
      schedule,
      use_actual_results
    })

  log(
    `Players: ${locked_player_ids.length} locked (actual), ${pending_player_ids.length} pending (simulate)`
  )

  // Load scoring format for market projection calculation
  const league_settings = await load_scoring_format({ scoring_format_hash })

  // Load remaining data in parallel (including market data)
  const [
    actual_points,
    projections_result,
    market_projections,
    traditional_stats,
    game_environment,
    variance_cache,
    position_ranks,
    correlation_cache,
    archetypes,
    game_outcome_correlations,
    position_game_defaults
  ] = await Promise.all([
    load_actual_player_points({
      player_ids: locked_player_ids,
      esbids: [...completed_esbids],
      scoring_format_hash
    }),
    load_projections_with_fallback({
      player_ids: pending_player_ids,
      week,
      year,
      scoring_format_hash,
      fallback_week
    }),
    load_market_projections({
      player_ids: pending_player_ids,
      week,
      year,
      league: league_settings
    }),
    load_player_projection_stats({
      player_ids: pending_player_ids,
      week,
      year
    }),
    load_game_environment({
      week,
      year
    }),
    load_player_variance({
      player_ids: pending_player_ids,
      year: year - 1, // Use prior year variance
      scoring_format_hash
    }),
    load_position_ranks({
      player_ids: pending_player_ids,
      year,
      week: Math.max(1, week - 1) // Use through prior week
    }),
    load_correlations_for_players({
      player_ids: pending_player_ids,
      year: year - 1 // Use prior year correlations
    }),
    load_player_archetypes({
      player_ids: pending_player_ids,
      year: year - 1
    }),
    // NOTE: Game outcome correlation loaders use current year (not year - 1) because
    // they have built-in fallback logic that queries both current and prior year,
    // preferring current year data when available. This differs from other historical
    // loaders (variance, correlations, archetypes) which only query the exact year passed.
    load_player_game_outcome_correlations({
      player_ids: pending_player_ids,
      year // Loader queries both year and year-1, prefers current year when available
    }),
    load_position_game_outcome_defaults({
      year // Loader queries both year and year-1, prefers current year when available
    })
  ])

  const { projections: traditional_projections } = projections_result

  // Merge projections: market stats override traditional stats where available
  const { projections, market_merged_count, traditional_only_count } =
    merge_player_projections({
      player_ids: pending_player_ids,
      traditional_projections,
      traditional_stats,
      market_projections,
      player_info,
      league_settings
    })

  log(
    `Projections merged: ${market_merged_count} market-merged, ${traditional_only_count} traditional-only`
  )

  // Build player objects for simulation (include schedule for esbid)
  const players = build_simulation_players({
    rosters,
    player_info,
    position_ranks,
    schedule
  })

  // Build teams array
  const teams = team_ids.map((team_id) => ({
    team_id,
    name: `Team ${team_id}`
  }))

  // Run simulation using pure function with extended correlation matrix
  const results = simulation.run_simulation({
    players,
    projections,
    variance_cache,
    correlation_cache,
    archetypes,
    schedule,
    teams,
    n_simulations,
    seed,
    locked_scores: actual_points,
    game_environment,
    game_outcome_correlations,
    position_defaults: position_game_defaults
  })

  log(
    `Simulation complete: ${results.n_simulations} iterations in ${results.elapsed_ms}ms, locked=${results.locked_player_count}, correlation_fallback=${results.correlation_fallback}, extended_matrix=${results.extended_matrix_used}`
  )

  // Format results
  return {
    league_id,
    week,
    year,
    teams: team_ids.map((team_id) => ({
      team_id,
      win_probability: results.win_probabilities.get(team_id),
      score_distribution: results.score_distributions.get(team_id)
    })),
    player_distributions: Object.fromEntries(
      results.player_score_distributions
    ),
    n_simulations: results.n_simulations,
    elapsed_ms: results.elapsed_ms,
    correlation_fallback: results.correlation_fallback,
    correlations_loaded: correlation_cache.size,
    locked_player_count: results.locked_player_count,
    // Market data stats
    market_merged_count,
    traditional_only_count,
    game_environment_loaded: game_environment.size,
    game_outcome_correlations_loaded: game_outcome_correlations.size,
    position_defaults_loaded: position_game_defaults.size,
    // Extended matrix stats
    extended_matrix_used: results.extended_matrix_used,
    n_games_correlated: results.n_games_correlated
  }
}
