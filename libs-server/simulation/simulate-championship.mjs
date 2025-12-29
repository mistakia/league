/**
 * Multi-week championship simulation orchestrator.
 * Aggregates scores across weeks to determine championship odds.
 */

import debug from 'debug'

import { simulation } from '#libs-shared'
import { current_season } from '#constants'
import {
  find_winners,
  distribute_win_credit
} from '#libs-shared/simulation/simulation-utils.mjs'

import {
  load_player_variance,
  load_player_archetypes,
  load_player_info,
  load_actual_player_points,
  load_actual_playoff_points,
  load_scoring_format,
  load_player_projection_stats
} from './load-simulation-data.mjs'
import { merge_player_projections } from './merge-player-projections.mjs'
import { load_correlations_for_players } from './load-correlations.mjs'
import { load_nfl_schedules_for_weeks } from './load-nfl-schedule.mjs'
import { load_position_ranks } from './calculate-position-ranks.mjs'
import { load_projections_with_fallback } from './load-data-with-fallback.mjs'
import { load_teams_starters_by_week } from './load-team-rosters.mjs'
import {
  load_simulation_context,
  categorize_players_by_game_status,
  build_simulation_players
} from './simulation-helpers.mjs'
import { load_market_projections } from './load-market-projections.mjs'
import { load_game_environment } from './load-game-environment.mjs'
import { load_player_game_outcome_correlations } from './load-player-game-outcome-correlations.mjs'
import { load_position_game_outcome_defaults } from './load-position-game-outcome-defaults.mjs'

const log = debug('simulation:simulate-championship')

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
 * @param {Map} [params.roster_overrides_by_week] - Optional Map of week -> Map of team_id -> player_ids[] to override rosters per week
 * @returns {Promise<Object>} Championship simulation results
 */
export async function simulate_championship({
  league_id,
  team_ids,
  weeks,
  year,
  n_simulations = 10000,
  seed,
  use_actual_results = true,
  roster_overrides_by_week
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

  // Load actual playoff points from playoffs table (authoritative source for completed weeks)
  const { actual_points: playoff_actual_points, weeks_with_results } =
    use_actual_results
      ? await load_actual_playoff_points({
          league_id,
          team_ids,
          weeks: sorted_weeks,
          year
        })
      : { actual_points: new Map(), weeks_with_results: [] }

  if (weeks_with_results.length > 0) {
    log(
      `Using actual playoff points for weeks: ${weeks_with_results.join(', ')}`
    )
  }

  // Load rosters for all weeks using unified loader
  // For current/past weeks: uses actual roster slots
  // For future weeks: computes optimal lineup from current roster pool
  const all_rosters_by_week = await load_teams_starters_by_week({
    league_id,
    team_ids,
    weeks: sorted_weeks,
    year,
    current_week: current_season.week
  })

  // Collect all player IDs across all weeks
  const all_player_ids_set = new Set()
  for (const rosters of all_rosters_by_week.values()) {
    rosters.forEach((r) =>
      r.player_ids.forEach((pid) => all_player_ids_set.add(pid))
    )
  }

  // Also collect player IDs from roster overrides if provided
  if (roster_overrides_by_week) {
    for (const week_overrides of roster_overrides_by_week.values()) {
      for (const player_ids of week_overrides.values()) {
        player_ids.forEach((pid) => all_player_ids_set.add(pid))
      }
    }
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
    let rosters = all_rosters_by_week.get(week)
    const schedule = schedules.get(week)

    // Apply per-week roster overrides if provided
    if (roster_overrides_by_week && roster_overrides_by_week.has(week)) {
      const week_overrides = roster_overrides_by_week.get(week)
      rosters = rosters.map((roster) => {
        const override_pids = week_overrides.get(roster.team_id)
        if (override_pids) {
          return { ...roster, player_ids: override_pids }
        }
        return roster
      })
      log(
        `Applied roster overrides for week ${week}: ${week_overrides.size} teams`
      )
    }

    // Check if we have actual playoff points for all teams in this week
    // If so, use those fixed scores instead of simulating
    const week_playoff_points = playoff_actual_points.get(week)
    const has_all_playoff_scores =
      weeks_with_results.includes(week) &&
      week_playoff_points &&
      team_ids.every((tid) => week_playoff_points.has(tid))

    if (has_all_playoff_scores) {
      log(`Week ${week}: Using actual playoff scores from playoffs table`)

      // Create fixed scores for all simulations using actual playoff points
      const score_distributions = new Map()
      const win_probabilities = new Map()

      for (const team_id of team_ids) {
        const actual_score = week_playoff_points.get(team_id)
        const totals = championship_totals.get(team_id)

        // Set all simulations to the actual score
        for (let sim = 0; sim < n_simulations; sim++) {
          totals[sim] += actual_score
        }

        // Create score distribution with zero variance (actual result)
        score_distributions.set(team_id, {
          mean: actual_score,
          std: 0,
          min: actual_score,
          max: actual_score
        })
      }

      // Calculate win probabilities based on actual scores
      const sorted_by_score = team_ids
        .map((tid) => ({ tid, score: week_playoff_points.get(tid) }))
        .sort((a, b) => b.score - a.score)

      // Handle ties by distributing win probability
      let i = 0
      while (i < sorted_by_score.length) {
        let j = i
        while (
          j < sorted_by_score.length &&
          sorted_by_score[j].score === sorted_by_score[i].score
        ) {
          j++
        }
        const tie_count = j - i
        const win_prob = i === 0 ? 1 / tie_count : 0
        for (let k = i; k < j; k++) {
          win_probabilities.set(sorted_by_score[k].tid, win_prob)
        }
        i = j
      }

      week_results.push({
        week,
        win_probabilities: Object.fromEntries(win_probabilities),
        score_distributions: Object.fromEntries(score_distributions),
        locked_player_count: 0,
        market_projections_used: 0,
        game_environment_loaded: 0,
        extended_matrix_used: false,
        n_games_correlated: 0,
        used_playoff_actual_points: true
      })

      continue
    }

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
      traditional_stats,
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
        // For weeks after the first, fall back to first week's projections if unavailable
        fallback_week: week !== sorted_weeks[0] ? sorted_weeks[0] : undefined
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

    const { projections: traditional_projections } = projections_result

    // Merge projections: market stats override traditional stats where available
    const { projections } = merge_player_projections({
      player_ids: pending_player_ids,
      traditional_projections,
      traditional_stats,
      market_projections,
      player_info,
      league_settings
    })

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
