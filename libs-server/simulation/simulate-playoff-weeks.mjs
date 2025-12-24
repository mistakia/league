/**
 * Playoff week simulation helper.
 * Runs correlated simulation across multiple playoff weeks.
 */

import debug from 'debug'

import { simulation } from '#libs-shared'

import {
  load_simulation_context,
  load_all_league_rosters,
  build_simulation_players,
  categorize_players_by_game_status
} from './simulation-helpers.mjs'
import {
  load_player_projections,
  load_player_projection_stats,
  load_player_variance,
  load_player_info,
  load_actual_player_points,
  load_player_archetypes,
  load_scoring_format
} from './load-simulation-data.mjs'
import { merge_player_projections } from './merge-player-projections.mjs'
import { load_nfl_schedules_for_weeks } from './load-nfl-schedule.mjs'
import { load_correlations_for_players } from './load-correlations.mjs'
import { load_position_ranks } from './calculate-position-ranks.mjs'
import { load_market_projections } from './load-market-projections.mjs'
import { load_game_environment } from './load-game-environment.mjs'
import { load_player_game_outcome_correlations } from './load-player-game-outcome-correlations.mjs'
import { load_position_game_outcome_defaults } from './load-position-game-outcome-defaults.mjs'

const log = debug('simulation:playoff-weeks')

/**
 * Run correlated playoff simulation using the full simulation engine.
 * This function loads all necessary data and runs run_simulation() with correlations.
 *
 * @param {Object} params
 * @param {number} params.league_id - League ID
 * @param {number[]} params.team_ids - Team IDs to simulate
 * @param {number[]} params.weeks - Weeks to simulate (only weeks that need simulation, not locked weeks)
 * @param {number} params.year - NFL year
 * @param {number} params.n_simulations - Number of simulations
 * @param {Map} [params.locked_week_scores] - Map of week -> Map<tid, points> for completed weeks
 * @returns {Promise<Object>} { raw_team_scores: Map<tid, number[]>, week_results: Object[] }
 */
export async function simulate_playoff_weeks_correlated({
  league_id,
  team_ids,
  weeks,
  year,
  n_simulations,
  locked_week_scores = new Map()
}) {
  log(
    `Running correlated playoff simulation for ${team_ids.length} teams, weeks ${weeks.join(',')}`
  )

  const { scoring_format_hash } = await load_simulation_context({
    league_id,
    year
  })

  // Load scoring format settings for market projection calculation
  const league_settings = await load_scoring_format({ scoring_format_hash })

  // Load schedules for all weeks
  const schedules = await load_nfl_schedules_for_weeks({ year, weeks })

  // Load rosters for all teams across all weeks
  const all_rosters_by_week = new Map()
  const all_player_ids_set = new Set()

  for (const week of weeks) {
    const rosters = await load_all_league_rosters({ league_id, week, year })

    // Filter to only the teams we're simulating
    const filtered_rosters = []
    for (const [tid, roster_data] of rosters) {
      if (team_ids.includes(tid)) {
        filtered_rosters.push({
          team_id: tid,
          player_ids: roster_data.player_ids
        })
        roster_data.player_ids.forEach((pid) => all_player_ids_set.add(pid))
      }
    }

    all_rosters_by_week.set(week, filtered_rosters)
  }

  const all_player_ids = [...all_player_ids_set]

  // Load shared data across all weeks (including game outcome correlations)
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

  // Initialize per-simulation totals
  const raw_team_scores = new Map()
  team_ids.forEach((tid) =>
    raw_team_scores.set(tid, new Array(n_simulations).fill(0))
  )

  // Add locked week scores to totals (constant across all simulations)
  for (const [, week_scores] of locked_week_scores) {
    for (const [tid, points] of week_scores) {
      if (raw_team_scores.has(tid)) {
        const totals = raw_team_scores.get(tid)
        for (let sim = 0; sim < n_simulations; sim++) {
          totals[sim] += points
        }
      }
    }
  }

  const week_results = []

  // Simulate each week
  for (const week of weeks) {
    const rosters = all_rosters_by_week.get(week)
    const schedule = schedules.get(week)
    const week_player_ids = [...new Set(rosters.flatMap((r) => r.player_ids))]

    // Categorize players into locked vs pending based on NFL game status
    const { locked_player_ids, pending_player_ids, completed_esbids } =
      categorize_players_by_game_status({
        player_ids: week_player_ids,
        player_info,
        schedule,
        use_actual_results: true
      })

    // Load week-specific data (including market projections)
    const [
      actual_points,
      traditional_projections,
      market_projections,
      traditional_stats,
      game_environment,
      position_ranks
    ] = await Promise.all([
      load_actual_player_points({
        player_ids: locked_player_ids,
        esbids: [...completed_esbids],
        scoring_format_hash
      }),
      load_player_projections({
        player_ids: pending_player_ids,
        week,
        year,
        scoring_format_hash
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
      load_position_ranks({
        player_ids: pending_player_ids,
        year,
        week: Math.max(1, week - 1)
      })
    ])

    // Merge projections: market stats override traditional stats where available
    const { projections } = merge_player_projections({
      player_ids: pending_player_ids,
      traditional_projections,
      traditional_stats,
      market_projections,
      player_info,
      league_settings
    })

    log(
      `Week ${week}: ${locked_player_ids.length} locked, ${pending_player_ids.length} pending`
    )

    // Build players array for simulation (include schedule for esbid)
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

    // Run simulation for this week with extended correlation matrix
    const week_result = simulation.run_simulation({
      players,
      projections,
      variance_cache,
      correlation_cache,
      archetypes,
      schedule,
      teams,
      n_simulations,
      return_raw_scores: true,
      locked_scores: actual_points,
      game_environment,
      game_outcome_correlations,
      position_defaults: position_game_defaults
    })

    // Aggregate per-simulation scores across weeks
    for (const team_id of team_ids) {
      const week_scores = week_result.raw_team_scores.get(team_id)
      const totals = raw_team_scores.get(team_id)
      if (week_scores && totals) {
        for (let sim = 0; sim < n_simulations; sim++) {
          totals[sim] += week_scores[sim]
        }
      }
    }

    week_results.push({
      week,
      locked_player_count: week_result.locked_player_count,
      correlation_fallback: week_result.correlation_fallback,
      market_projections_used: market_projections.size,
      game_environment_loaded: game_environment.size,
      extended_matrix_used: week_result.extended_matrix_used,
      n_games_correlated: week_result.n_games_correlated
    })
  }

  log(`Correlated playoff simulation complete`)

  return { raw_team_scores, week_results }
}
