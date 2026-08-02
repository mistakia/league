/**
 * Playoff forecasting using player-level correlation simulation.
 * Handles wildcard round and championship round forecasts.
 */

import debug from 'debug'

import db from '#db'
import { current_season } from '#constants'

import { load_actual_playoff_points } from './load-simulation-data.mjs'
import { simulate_playoff_weeks_correlated } from './simulate-playoff-weeks.mjs'
import { load_simulation_context } from './simulation-helpers.mjs'

const log = debug('simulation:playoff-forecast')

const SIMULATIONS = 10000

/**
 * Simulate wildcard round forecast (week 15).
 * Called when regular season is complete but playoffs haven't started.
 * Uses player-level correlation simulation.
 * Incorporates actual results for completed weeks.
 *
 * @param {Object} params
 * @param {number} params.league_id - League ID
 * @param {number} [params.year] - NFL year
 * @param {number} [params.n_simulations=10000] - Number of simulations
 * @returns {Promise<Object>} Forecast results keyed by team ID
 */
export async function simulate_wildcard_forecast({
  league_id,
  year = current_season.year,
  n_simulations = SIMULATIONS
}) {
  const start_time = Date.now()
  log(`Starting wildcard forecast for league ${league_id}`)

  const { playoff_format } = await load_simulation_context({ league_id, year })
  const { playoff_team_count, bye_count } = playoff_format
  // One winner per wildcard pairing. The championship round is the byes plus
  // these, which is what championship_team_count asserts further down.
  const wildcard_survivor_count = Math.floor(
    (playoff_team_count - bye_count) / 2
  )

  // Get playoff teams
  const team_stats = await db('league_team_seasonlogs')
    .where({ lid: league_id, year })
    .whereBetween('regular_season_finish', [1, playoff_team_count])

  if (team_stats.length !== playoff_team_count) {
    throw new Error(
      `Expected ${playoff_team_count} playoff teams, found ${team_stats.length}`
    )
  }

  const bye_tids = team_stats
    .filter((t) => t.regular_season_finish <= bye_count)
    .map((t) => t.tid)

  // Seeds after the byes, up to the field size. Hardcoding 3..6 silently
  // dropped teams from the whole simulation at any other format: at 4/0 seeds
  // 1-2 vanished, at 8/2 seeds 7-8 did, each keeping playoff_odds 1.0 and
  // championship_odds 0 forever with no throw and no log.
  const wildcard_tids = team_stats
    .filter(
      (t) =>
        t.regular_season_finish > bye_count &&
        t.regular_season_finish <= playoff_team_count
    )
    .map((t) => t.tid)

  const all_playoff_tids = [...bye_tids, ...wildcard_tids]

  // Get all teams for result
  const all_teams = await db('teams').where({ lid: league_id, year })

  // Initialize results
  const result = {}
  for (const team of all_teams) {
    result[team.uid] = {
      tid: team.uid,
      playoff_odds: team_stats.some((t) => t.tid === team.uid) ? 1.0 : 0.0,
      division_odds: bye_tids.includes(team.uid) ? 1.0 : 0.0,
      bye_odds: bye_tids.includes(team.uid) ? 1.0 : 0.0,
      championship_wins: 0
    }
  }

  // Load actual playoff points for all weeks
  const { actual_points, weeks_with_results } =
    await load_actual_playoff_points({
      league_id,
      team_ids: all_playoff_tids,
      weeks: [15, 16, 17],
      year
    })

  log(`Weeks with actual results: ${weeks_with_results.join(', ') || 'none'}`)

  // Check if wildcard week (15) is complete
  const wildcard_complete = weeks_with_results.includes(15)

  // Determine which weeks need simulation
  const weeks_to_simulate = [15, 16, 17].filter(
    (w) => !weeks_with_results.includes(w)
  )

  // If all weeks complete, just return actual winner
  if (weeks_to_simulate.length === 0) {
    log('All playoff weeks complete - using actual results')

    // Determine wildcard winners from week 15 scores
    const week15_points = actual_points.get(15)
    const wildcard_results = wildcard_tids
      .map((tid) => ({ tid, score: week15_points?.get(tid) || 0 }))
      .sort((a, b) => b.score - a.score)
    const wildcard_winners = wildcard_results
      .slice(0, wildcard_survivor_count)
      .map((r) => r.tid)

    // Championship teams
    const championship_teams = [...bye_tids, ...wildcard_winners]

    // Calculate total championship scores
    const total_scores = {}
    for (const tid of championship_teams) {
      total_scores[tid] = 0
      for (const week of [16, 17]) {
        const week_points = actual_points.get(week)
        if (week_points?.has(tid)) {
          total_scores[tid] += week_points.get(tid)
        }
      }
    }

    // Find winner
    let max_score = -1
    let winner_tid = null
    for (const tid of championship_teams) {
      if (total_scores[tid] > max_score) {
        max_score = total_scores[tid]
        winner_tid = tid
      }
    }

    // Set championship odds for all teams (100% for winner, 0% for others)
    for (const tid in result) {
      result[tid].championship_odds = Number(tid) === winner_tid ? 1.0 : 0.0
      delete result[tid].championship_wins
    }

    const elapsed_ms = Date.now() - start_time
    log(`Wildcard forecast completed in ${elapsed_ms}ms (actual results)`)
    return result
  }

  // Run correlated simulations
  log(`Running correlated wildcard simulations`)

  // Determine which weeks need simulation for each round
  const wildcard_weeks_to_simulate = weeks_to_simulate.filter((w) => w === 15)
  const championship_weeks_to_simulate = weeks_to_simulate.filter(
    (w) => w >= 16
  )

  // Run correlated simulation for wildcard week if needed
  let wildcard_raw_scores = null
  if (wildcard_weeks_to_simulate.length > 0) {
    const wildcard_result = await simulate_playoff_weeks_correlated({
      league_id,
      team_ids: wildcard_tids,
      weeks: wildcard_weeks_to_simulate,
      year,
      n_simulations
    })
    wildcard_raw_scores = wildcard_result.raw_team_scores
  }

  // Run correlated simulation for championship weeks for all 6 playoff teams
  // (we need scores for all teams since wildcard winners vary per simulation)
  let championship_raw_scores = null
  if (championship_weeks_to_simulate.length > 0) {
    // Build locked week scores for championship weeks from actual_points
    const championship_locked_scores = new Map()
    for (const week of weeks_with_results) {
      if (week >= 16) {
        championship_locked_scores.set(week, actual_points.get(week))
      }
    }

    const championship_result = await simulate_playoff_weeks_correlated({
      league_id,
      team_ids: all_playoff_tids,
      weeks: championship_weeks_to_simulate,
      year,
      n_simulations,
      locked_week_scores: championship_locked_scores
    })
    championship_raw_scores = championship_result.raw_team_scores
  }

  // Run Monte Carlo winner counting
  log(`Counting winners from ${n_simulations} simulations`)
  for (let sim = 0; sim < n_simulations; sim++) {
    let wildcard_winners

    if (wildcard_complete) {
      // Use actual wildcard results
      const week15_points = actual_points.get(15)
      const wildcard_results = wildcard_tids
        .map((tid) => ({ tid, score: week15_points?.get(tid) || 0 }))
        .sort((a, b) => b.score - a.score)
      wildcard_winners = wildcard_results
        .slice(0, wildcard_survivor_count)
        .map((r) => r.tid)
    } else {
      // Determine wildcard winners from simulated week 15 scores
      const wildcard_results = wildcard_tids
        .map((tid) => ({ tid, score: wildcard_raw_scores.get(tid)[sim] }))
        .sort((a, b) => b.score - a.score)
      wildcard_winners = wildcard_results
        .slice(0, wildcard_survivor_count)
        .map((r) => r.tid)
    }

    // Championship round: bye teams + wildcard winners
    const championship_teams = [...bye_tids, ...wildcard_winners]

    // Calculate championship scores for this simulation
    const scores = {}
    for (const tid of championship_teams) {
      scores[tid] = 0

      // Add actual points from completed championship weeks
      for (const week of weeks_with_results) {
        if (week >= 16) {
          const week_points = actual_points.get(week)
          if (week_points?.has(tid)) {
            scores[tid] += week_points.get(tid)
          }
        }
      }

      // Add simulated championship week scores
      if (championship_raw_scores && championship_raw_scores.has(tid)) {
        scores[tid] += championship_raw_scores.get(tid)[sim]
      }
    }

    // Find winner (highest total)
    let max_score = -1
    let winner_tid = null
    for (const tid of championship_teams) {
      if (scores[tid] > max_score) {
        max_score = scores[tid]
        winner_tid = tid
      }
    }

    if (winner_tid) {
      result[winner_tid].championship_wins++
    }
  }

  // Calculate championship odds
  for (const tid in result) {
    result[tid].championship_odds =
      result[tid].championship_wins / n_simulations
    delete result[tid].championship_wins
  }

  const elapsed_ms = Date.now() - start_time
  log(`Wildcard forecast completed in ${elapsed_ms}ms`)

  return result
}

/**
 * Simulate championship round forecast (weeks 16-17).
 * Uses player-level correlation simulation.
 * Incorporates actual results for completed weeks.
 *
 * @param {Object} params
 * @param {number} params.league_id - League ID
 * @param {number} [params.year] - NFL year
 * @param {number} [params.n_simulations=10000] - Number of simulations
 * @returns {Promise<Object>} Forecast results keyed by team ID
 */
export async function simulate_championship_forecast({
  league_id,
  year = current_season.year,
  n_simulations = SIMULATIONS
}) {
  const start_time = Date.now()
  log(`Starting championship forecast for league ${league_id}`)

  // Get championship teams from playoffs table
  const playoffs = await db('playoffs')
    .where({ lid: league_id, year })
    .whereIn('uid', [2, 3]) // Championship round entries

  const championship_tids = [...new Set(playoffs.map((p) => p.tid))]

  const { playoff_format } = await load_simulation_context({ league_id, year })
  const { bye_count } = playoff_format
  const wildcard_survivor_count = Math.floor(
    (playoff_format.playoff_team_count - bye_count) / 2
  )
  // Byes plus the wildcard survivors, which is one winner per wildcard pairing.
  const championship_team_count = bye_count + wildcard_survivor_count

  if (championship_tids.length !== championship_team_count) {
    throw new Error(
      `Expected ${championship_team_count} championship teams, found ${championship_tids.length}`
    )
  }

  // Get all teams for result
  const all_teams = await db('teams').where({ lid: league_id, year })
  const all_playoff_tids = [
    ...new Set(
      (await db('playoffs').where({ lid: league_id, year })).map((p) => p.tid)
    )
  ]

  // Load team stats to identify which seeds received a bye
  const team_stats_list = await db('league_team_seasonlogs').where({
    lid: league_id,
    year
  })

  const team_stats_by_tid = {}
  for (const stats of team_stats_list) {
    team_stats_by_tid[stats.tid] = stats
  }

  // Initialize results
  const result = {}
  for (const team of all_teams) {
    const team_stats = team_stats_by_tid[team.uid]
    // Top two seeds receive the bye; divisions confer no berth.
    // Number.isInteger first: the optional chain guards undefined, not null,
    // and a null regular_season_finish coerces to 0 <= bye_count, awarding a
    // bye to every team with no recorded finish.
    const has_bye =
      Number.isInteger(team_stats?.regular_season_finish) &&
      team_stats.regular_season_finish <= bye_count

    result[team.uid] = {
      tid: team.uid,
      playoff_odds: all_playoff_tids.includes(team.uid) ? 1.0 : 0.0,
      division_odds: has_bye ? 1.0 : 0.0,
      bye_odds: has_bye ? 1.0 : 0.0,
      championship_wins: 0
    }
  }

  // Load actual playoff points for completed weeks
  const { actual_points, weeks_with_results } =
    await load_actual_playoff_points({
      league_id,
      team_ids: championship_tids,
      weeks: [16, 17],
      year
    })

  log(`Weeks with actual results: ${weeks_with_results.join(', ') || 'none'}`)

  // Determine which weeks need simulation
  const weeks_to_simulate = [16, 17].filter(
    (w) => !weeks_with_results.includes(w)
  )

  // If all weeks have results, no simulation needed - just count the winner
  if (weeks_to_simulate.length === 0) {
    log('All championship weeks complete - using actual results')

    // Calculate total scores from actual results
    const total_scores = {}
    for (const tid of championship_tids) {
      total_scores[tid] = 0
      for (const week of [16, 17]) {
        const week_points = actual_points.get(week)
        if (week_points?.has(tid)) {
          total_scores[tid] += week_points.get(tid)
        }
      }
    }

    // Find winner
    let max_score = -1
    let winner_tid = null
    for (const tid of championship_tids) {
      if (total_scores[tid] > max_score) {
        max_score = total_scores[tid]
        winner_tid = tid
      }
    }

    // Set championship odds for all teams (100% for winner, 0% for others)
    for (const tid in result) {
      result[tid].championship_odds = Number(tid) === winner_tid ? 1.0 : 0.0
      delete result[tid].championship_wins
    }

    const elapsed_ms = Date.now() - start_time
    log(`Championship forecast completed in ${elapsed_ms}ms (actual results)`)
    return result
  }

  // Run correlated simulation for weeks that need simulation
  log(`Running correlated simulation for weeks ${weeks_to_simulate.join(', ')}`)

  const { raw_team_scores } = await simulate_playoff_weeks_correlated({
    league_id,
    team_ids: championship_tids,
    weeks: weeks_to_simulate,
    year,
    n_simulations,
    locked_week_scores: actual_points
  })

  // Count winners from simulation results
  for (let sim = 0; sim < n_simulations; sim++) {
    // Find winner for this simulation (highest total)
    let max_score = -1
    let winner_tid = null
    for (const tid of championship_tids) {
      const score = raw_team_scores.get(tid)[sim]
      if (score > max_score) {
        max_score = score
        winner_tid = tid
      }
    }

    if (winner_tid) {
      result[winner_tid].championship_wins++
    }
  }

  // Calculate championship odds
  for (const tid in result) {
    result[tid].championship_odds =
      result[tid].championship_wins / n_simulations
    delete result[tid].championship_wins
  }

  const elapsed_ms = Date.now() - start_time
  log(`Championship forecast completed in ${elapsed_ms}ms`)

  return result
}
