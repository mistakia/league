/**
 * Simulation orchestrator module.
 * Orchestrates simulation by loading data and calling pure functions from libs-shared.
 */

import debug from 'debug'

import db from '#db'
import { simulation } from '#libs-shared'
import {
  find_winners,
  distribute_win_credit
} from '#libs-shared/simulation/simulation-utils.mjs'
import { getLeague } from '#libs-server'

import {
  load_player_variance,
  load_player_archetypes,
  load_player_info,
  load_actual_player_points
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

const log = debug('simulation:simulate-matchup')

/**
 * Categorize players into locked (completed games) vs pending (to simulate).
 *
 * @param {Object} params
 * @param {string[]} params.player_ids - Array of player IDs
 * @param {Map} params.player_info - Map of pid -> { position, nfl_team }
 * @param {Object} params.schedule - NFL schedule with game status
 * @param {boolean} params.use_actual_results - Whether to use actual results for completed games
 * @returns {Object} { locked_player_ids, pending_player_ids, completed_esbids }
 */
function categorize_players_by_game_status({
  player_ids,
  player_info,
  schedule,
  use_actual_results
}) {
  const locked_player_ids = []
  const pending_player_ids = []
  const completed_esbids = new Set()

  for (const pid of player_ids) {
    const info = player_info.get(pid)
    const game = schedule[info?.nfl_team]

    if (use_actual_results && game?.is_final) {
      locked_player_ids.push(pid)
      completed_esbids.add(game.esbid)
    } else {
      pending_player_ids.push(pid)
    }
  }

  return { locked_player_ids, pending_player_ids, completed_esbids }
}

/**
 * Build player objects for simulation from rosters and player info.
 *
 * @param {Object} params
 * @param {Object[]} params.rosters - Array of { team_id, player_ids }
 * @param {Map} params.player_info - Map of pid -> { position, nfl_team }
 * @param {Map} params.position_ranks - Map of pid -> position_rank
 * @returns {Object[]} Array of player objects for simulation
 */
function build_simulation_players({ rosters, player_info, position_ranks }) {
  const players = []
  for (const roster of rosters) {
    for (const pid of roster.player_ids) {
      const info = player_info.get(pid)
      if (!info) {
        log(`No player info for ${pid}, skipping`)
        continue
      }

      players.push({
        pid,
        nfl_team: info.nfl_team,
        position: info.position,
        position_rank: position_ranks.get(pid) || info.position,
        team_id: roster.team_id
      })
    }
  }
  return players
}

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

  // Load league to get scoring format
  const league = await getLeague({ lid: league_id })
  if (!league) {
    throw new Error(`League not found: ${league_id}`)
  }

  // Get scoring format hash from seasons table
  const season = await db('seasons').where({ lid: league_id, year }).first()

  if (!season) {
    throw new Error(`Season not found for league ${league_id}, year ${year}`)
  }

  const { scoring_format_hash } = season

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

  // Load remaining data in parallel
  const [
    actual_points,
    projections_result,
    variance_cache,
    position_ranks,
    correlation_cache,
    archetypes
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
    })
  ])

  const { projections } = projections_result

  // Build player objects for simulation
  const players = build_simulation_players({
    rosters,
    player_info,
    position_ranks
  })

  // Build teams array
  const teams = team_ids.map((team_id) => ({
    team_id,
    name: `Team ${team_id}`
  }))

  // Run simulation using pure function
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
    locked_scores: actual_points
  })

  log(
    `Simulation complete: ${results.n_simulations} iterations in ${results.elapsed_ms}ms, locked=${results.locked_player_count}, correlation_fallback=${results.correlation_fallback}`
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
    locked_player_count: results.locked_player_count
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
  const league = await getLeague({ lid: league_id })
  if (!league) {
    throw new Error(`League not found: ${league_id}`)
  }

  const season = await db('seasons').where({ lid: league_id, year }).first()

  const { scoring_format_hash } = season

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

  // Load shared data
  const [player_info, correlation_cache, archetypes, variance_cache] =
    await Promise.all([
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

    // Load week-specific data using consolidated fallback
    const [actual_points, projections_result, position_ranks] =
      await Promise.all([
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
        load_position_ranks({
          player_ids: pending_player_ids,
          year,
          week: Math.max(1, week - 1)
        })
      ])

    const { projections } = projections_result

    // Build players for this week
    const players = build_simulation_players({
      rosters,
      player_info,
      position_ranks
    })

    const teams = team_ids.map((team_id) => ({
      team_id,
      name: `Team ${team_id}`
    }))

    // Run week simulation with raw scores for aggregation
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
      locked_scores: actual_points
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
      locked_player_count: week_result.locked_player_count
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
    n_simulations
  }
}
