/**
 * Simulation orchestrator module.
 * Orchestrates simulation by loading data and calling pure functions from libs-shared.
 */

import debug from 'debug'

import { simulation } from '#libs-shared'
import {
  find_winners,
  distribute_win_credit
} from '#libs-shared/simulation/simulation-utils.mjs'

import {
  load_player_variance,
  load_player_archetypes,
  load_player_info,
  load_actual_player_points,
  load_scoring_format
} from './load-simulation-data.mjs'
import { load_correlations_for_players } from './load-correlations.mjs'
import {
  load_nfl_schedule,
  load_nfl_schedules_for_weeks
} from './load-nfl-schedule.mjs'
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

  // Merge projections: market projections take precedence over traditional
  const projections = new Map(traditional_projections)
  let market_projection_count = 0
  let market_replaced_count = 0
  let market_only_count = 0

  for (const [pid, market_data] of market_projections) {
    const had_traditional = traditional_projections.has(pid)
    const traditional_value = had_traditional
      ? traditional_projections.get(pid)
      : null

    projections.set(pid, market_data.projection)
    market_projection_count++

    if (had_traditional) {
      market_replaced_count++
      log(
        `Market override: ${pid} traditional=${traditional_value?.toFixed(2)} -> market=${market_data.projection?.toFixed(2)} (stats: ${JSON.stringify(market_data.stats)}, source: ${market_data.source})`
      )
    } else {
      market_only_count++
      log(
        `Market only: ${pid} market=${market_data.projection?.toFixed(2)} (no traditional projection)`
      )
    }
  }

  log(
    `Projections merged: ${traditional_projections.size} traditional, ${market_projections.size} market total, ${market_replaced_count} replaced traditional, ${market_only_count} market-only`
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
    market_projections_used: market_projection_count,
    market_replaced_traditional: market_replaced_count,
    market_only: market_only_count,
    traditional_projections_used:
      traditional_projections.size - market_replaced_count,
    game_environment_loaded: game_environment.size,
    game_outcome_correlations_loaded: game_outcome_correlations.size,
    position_defaults_loaded: position_game_defaults.size,
    // Extended matrix stats
    extended_matrix_used: results.extended_matrix_used,
    n_games_correlated: results.n_games_correlated
  }
}

/**
 * Simulate a multi-week championship round.
 *
 * @param {Object} params
 * @param {number} params.league_id - League ID
 * @param {number[]} params.team_ids - Array of fantasy team IDs (typically 4)
 * @param {number[]} params.weeks - Array of NFL weeks in ascending order (e.g., [16, 17])
 * @param {number} params.year - NFL year
 * @param {number} [params.n_simulations=10000] - Number of simulations
 * @param {number} [params.seed] - Optional seed for reproducibility
 * @param {boolean} [params.use_actual_results=true] - Use actual points for completed games
 * @returns {Promise<Object>} Championship simulation results
 */
export async function simulate_championship({
  league_id,
  team_ids,
  weeks,
  year,
  n_simulations = 10000,
  seed,
  use_actual_results = true
}) {
  // Validate team_ids
  if (!Array.isArray(team_ids) || team_ids.length < 2) {
    throw new Error(
      `simulate_championship requires at least 2 teams, got ${team_ids?.length || 0}`
    )
  }

  // Validate weeks
  if (!Array.isArray(weeks) || weeks.length < 1) {
    throw new Error(
      `simulate_championship requires at least 1 week, got ${weeks?.length || 0}`
    )
  }

  // Ensure weeks are in ascending order
  const sorted_weeks = [...weeks].sort((a, b) => a - b)
  if (weeks.some((w, i) => w !== sorted_weeks[i])) {
    log(
      `Warning: weeks not in ascending order, reordering ${weeks} to ${sorted_weeks}`
    )
  }

  log(`Starting championship simulation: ${sorted_weeks.length} weeks`)

  // Load league and scoring format
  const { scoring_format_hash } = await load_simulation_context({
    league_id,
    year
  })

  // Load scoring format for market projection calculation
  const league_settings = await load_scoring_format({ scoring_format_hash })

  // Load schedules for all weeks
  const schedules = await load_nfl_schedules_for_weeks({
    year,
    weeks: sorted_weeks
  })

  // Use the first week as base for fallback
  const base_week = sorted_weeks[0]

  // Collect all players across all weeks using consolidated fallback loading
  const all_rosters_by_week = new Map()
  const all_player_ids_set = new Set()

  for (const week of sorted_weeks) {
    const { rosters } = await load_rosters_with_fallback({
      league_id,
      team_ids,
      week,
      year,
      fallback_week: week !== base_week ? base_week : undefined
    })

    all_rosters_by_week.set(week, rosters)
    rosters.forEach((r) =>
      r.player_ids.forEach((pid) => all_player_ids_set.add(pid))
    )
  }

  const all_player_ids = [...all_player_ids_set]

  // Load shared data (including game outcome correlations)
  const [
    player_info,
    correlation_cache,
    archetypes,
    variance_cache,
    game_outcome_correlations,
    position_game_defaults
  ] = await Promise.all([
    load_player_info({ player_ids: all_player_ids }),
    load_correlations_for_players({
      player_ids: all_player_ids,
      year: year - 1
    }),
    load_player_archetypes({
      player_ids: all_player_ids,
      year: year - 1
    }),
    load_player_variance({
      player_ids: all_player_ids,
      year: year - 1,
      scoring_format_hash
    }),
    // NOTE: Game outcome correlation loaders use current year (not year - 1) because
    // they have built-in fallback logic that queries both current and prior year,
    // preferring current year data when available. This differs from other historical
    // loaders (variance, correlations, archetypes) which only query the exact year passed.
    load_player_game_outcome_correlations({
      player_ids: all_player_ids,
      year // Loader queries both year and year-1, prefers current year when available
    }),
    load_position_game_outcome_defaults({
      year // Loader queries both year and year-1, prefers current year when available
    })
  ])

  // Initialize per-simulation championship totals
  const championship_totals = new Map()
  team_ids.forEach((tid) =>
    championship_totals.set(tid, new Array(n_simulations).fill(0))
  )

  const week_results = []

  for (const week of sorted_weeks) {
    const rosters = all_rosters_by_week.get(week)
    const schedule = schedules.get(week)
    const week_player_ids = [...new Set(rosters.flatMap((r) => r.player_ids))]

    // Categorize players for this week
    const { locked_player_ids, pending_player_ids, completed_esbids } =
      categorize_players_by_game_status({
        player_ids: week_player_ids,
        player_info,
        schedule,
        use_actual_results
      })

    // Load week-specific data using consolidated fallback (including market projections)
    const [
      actual_points,
      projections_result,
      market_projections,
      game_environment,
      position_ranks
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
        fallback_week: week !== base_week ? base_week : undefined
      }),
      load_market_projections({
        player_ids: pending_player_ids,
        week,
        year,
        league: league_settings
      }),
      load_game_environment({
        week,
        year
      }),
      load_position_ranks({
        player_ids: pending_player_ids,
        year,
        week: Math.max(1, week - 1)
      })
    ])

    const { projections: traditional_projections } = projections_result

    // Merge projections: market projections take precedence
    const projections = new Map(traditional_projections)
    for (const [pid, market_data] of market_projections) {
      projections.set(pid, market_data.projection)
    }

    // Build players for this week (include schedule for esbid)
    const players = build_simulation_players({
      rosters,
      player_info,
      position_ranks,
      schedule
    })

    const teams = team_ids.map((team_id) => ({
      team_id,
      name: `Team ${team_id}`
    }))

    // Run week simulation with raw scores for aggregation and extended matrix
    const week_result = simulation.run_simulation({
      players,
      projections,
      variance_cache,
      correlation_cache,
      archetypes,
      schedule,
      teams,
      n_simulations,
      seed: seed ? seed + week : undefined,
      return_raw_scores: true,
      locked_scores: actual_points,
      game_environment,
      game_outcome_correlations,
      position_defaults: position_game_defaults
    })

    // Aggregate per-simulation scores across weeks
    for (const team_id of team_ids) {
      const week_scores = week_result.raw_team_scores.get(team_id)
      const totals = championship_totals.get(team_id)
      for (let sim = 0; sim < n_simulations; sim++) {
        totals[sim] += week_scores[sim]
      }
    }

    week_results.push({
      week,
      win_probabilities: Object.fromEntries(week_result.win_probabilities),
      score_distributions: Object.fromEntries(week_result.score_distributions),
      locked_player_count: week_result.locked_player_count,
      market_projections_used: market_projections.size,
      game_environment_loaded: game_environment.size,
      extended_matrix_used: week_result.extended_matrix_used,
      n_games_correlated: week_result.n_games_correlated
    })
  }

  // Calculate championship odds by counting wins across simulations
  const championship_wins = new Map()
  team_ids.forEach((tid) => championship_wins.set(tid, 0))

  for (let sim = 0; sim < n_simulations; sim++) {
    // Build team scores map for this simulation
    const sim_team_scores = new Map()
    for (const team_id of team_ids) {
      sim_team_scores.set(team_id, championship_totals.get(team_id)[sim])
    }

    // Find winners and distribute credit
    const { winners, win_credit } = find_winners({
      team_scores: sim_team_scores
    })
    distribute_win_credit({ team_wins: championship_wins, winners, win_credit })
  }

  // Calculate expected totals and win probabilities
  const total_expected_points = new Map()
  const championship_odds = new Map()
  team_ids.forEach((tid) => {
    const totals = championship_totals.get(tid)
    total_expected_points.set(
      tid,
      totals.reduce((sum, s) => sum + s, 0) / n_simulations
    )
    championship_odds.set(tid, championship_wins.get(tid) / n_simulations)
  })

  return {
    league_id,
    weeks: sorted_weeks,
    year,
    week_results,
    teams: team_ids.map((team_id) => ({
      team_id,
      total_expected_points: total_expected_points.get(team_id),
      championship_odds: championship_odds.get(team_id)
    })),
    n_simulations,
    // Market data stats (shared across weeks)
    game_outcome_correlations_loaded: game_outcome_correlations.size,
    position_defaults_loaded: position_game_defaults.size
  }
}
