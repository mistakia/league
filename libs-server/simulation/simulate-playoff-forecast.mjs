/**
 * Playoff forecasting using player-level correlation simulation.
 * Handles wildcard round and championship round forecasts.
 */

import debug from 'debug'

import db from '#db'
import { current_season } from '#constants'
import { get_season_playoff_weeks } from '#libs-server'

import { load_actual_playoff_points } from './load-actual-points.mjs'
import {
  find_highest_scoring_team,
  select_wildcard_winners,
  count_wildcard_survivors
} from './resolve-playoff-bracket.mjs'
import {
  resolve_decided_division_winners,
  decided_division_odds
} from './resolve-division-odds.mjs'
import { simulate_playoff_weeks_correlated } from './simulate-playoff-weeks.mjs'
import { load_simulation_context } from './simulation-helpers.mjs'

const log = debug('simulation:playoff-forecast')

const SIMULATIONS = 10000

/**
 * Total a team's recorded points across the given weeks. A week with no
 * recorded result contributes nothing, so an incomplete round is a partial
 * total rather than an error.
 *
 * @param {object} params
 * @param {Map<number, Map<number, number>>} params.actual_points - week -> tid -> points
 * @param {number[]} params.weeks - Weeks to total
 * @param {number} params.tid - Team ID
 * @returns {number} Total points
 */
const sum_actual_points = ({ actual_points, weeks, tid }) => {
  let total = 0
  for (const week of weeks) {
    total += actual_points.get(week)?.get(tid) || 0
  }
  return total
}

/**
 * Resolve the forecast to a decided champion: the winner takes all the odds.
 *
 * @param {object} params
 * @param {object} params.result - Forecast keyed by team ID
 * @param {number | null} params.winner_tid - Winning team ID
 */
const set_decided_championship_odds = ({ result, winner_tid }) => {
  for (const tid in result) {
    result[tid].championship_odds = Number(tid) === winner_tid ? 1.0 : 0.0
    delete result[tid].championship_wins
  }
}

/**
 * Convert Monte Carlo win counts into championship odds.
 *
 * @param {object} params
 * @param {object} params.result - Forecast keyed by team ID
 * @param {number} params.n_simulations - Simulations run
 */
const set_simulated_championship_odds = ({ result, n_simulations }) => {
  for (const tid in result) {
    result[tid].championship_odds =
      result[tid].championship_wins / n_simulations
    delete result[tid].championship_wins
  }
}

/**
 * Simulate the wildcard round forecast.
 * Called when regular season is complete but playoffs haven't started.
 * Uses player-level correlation simulation.
 * Incorporates actual results for completed weeks.
 *
 * @param {object} params
 * @param {number} params.league_id - League ID
 * @param {number} [params.year] - NFL year
 * @param {number} [params.n_simulations=10000] - Number of simulations
 * @returns {Promise<object>} Forecast results keyed by team ID
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
  const wildcard_survivor_count = count_wildcard_survivors({
    playoff_team_count,
    bye_count
  })

  // The playoff weeks are per-league configuration on the season row, the same
  // source the caller dispatches on. Hardcoding 15/16/17 forecasts weeks the
  // league does not play: no actual results are found there and the rosters
  // simulated are the wrong ones, silently, the same way hardcoding the seed
  // range did below.
  const { wildcard_week, championship_weeks, playoff_weeks } =
    await get_season_playoff_weeks({ lid: league_id, season_year: year })

  if (!wildcard_week || !championship_weeks.length) {
    throw new Error(
      `No playoff weeks configured for league ${league_id} in ${year}`
    )
  }

  // Get playoff teams
  const team_stats = await db('league_team_seasonlogs')
    .where({ lid: league_id, season_year: year })
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
  const all_teams = await db('teams').where({
    lid: league_id,
    season_year: year
  })

  // Division winners are decided by the completed regular season, so they need
  // every team's final standings rather than the playoff field's. Reading them
  // is what retires the old division_odds, which was the bye flag under a
  // second name and had reported byes as division titles since 2ce9f7225.
  const all_team_stats = await db('league_team_seasonlogs').where({
    lid: league_id,
    season_year: year
  })
  const all_team_stats_by_tid = {}
  for (const stats of all_team_stats) {
    all_team_stats_by_tid[stats.tid] = stats
  }

  const division_winner_tids = resolve_decided_division_winners({
    teams: all_teams,
    team_stats_by_tid: all_team_stats_by_tid,
    playoff_format
  })

  // Initialize results
  const result = {}
  for (const team of all_teams) {
    result[team.team_id] = {
      tid: team.team_id,
      playoff_odds: team_stats.some((t) => t.tid === team.team_id) ? 1.0 : 0.0,
      division_odds: decided_division_odds({
        division_winner_tids,
        team_id: team.team_id
      }),
      bye_odds: bye_tids.includes(team.team_id) ? 1.0 : 0.0,
      championship_wins: 0
    }
  }

  // Load actual playoff points for all weeks
  const { actual_points, weeks_with_results } =
    await load_actual_playoff_points({
      league_id,
      team_ids: all_playoff_tids,
      weeks: playoff_weeks,
      year
    })

  log(`Weeks with actual results: ${weeks_with_results.join(', ') || 'none'}`)

  const wildcard_complete = weeks_with_results.includes(wildcard_week)

  // Determine which weeks need simulation
  const weeks_to_simulate = playoff_weeks.filter(
    (w) => !weeks_with_results.includes(w)
  )

  // The wildcard result, once it exists, is the same in every simulation, so
  // resolve the survivors once rather than per iteration below.
  const actual_wildcard_winners = wildcard_complete
    ? select_wildcard_winners({
        wildcard_tids,
        survivor_count: wildcard_survivor_count,
        get_score: (tid) => actual_points.get(wildcard_week)?.get(tid) || 0
      })
    : null

  // If all weeks complete, just return actual winner. Nothing left to simulate
  // means the wildcard week has results, so actual_wildcard_winners is set.
  if (weeks_to_simulate.length === 0) {
    log('All playoff weeks complete - using actual results')

    const championship_teams = [...bye_tids, ...actual_wildcard_winners]
    const winner_tid = find_highest_scoring_team({
      team_ids: championship_teams,
      get_score: (tid) =>
        sum_actual_points({ actual_points, weeks: championship_weeks, tid })
    })

    set_decided_championship_odds({ result, winner_tid })

    const elapsed_ms = Date.now() - start_time
    log(`Wildcard forecast completed in ${elapsed_ms}ms (actual results)`)
    return result
  }

  // Run correlated simulations
  log(`Running correlated wildcard simulations`)

  // Determine which weeks need simulation for each round
  const wildcard_weeks_to_simulate = weeks_to_simulate.filter(
    (w) => w === wildcard_week
  )
  const championship_weeks_to_simulate = weeks_to_simulate.filter((w) =>
    championship_weeks.includes(w)
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

  // Run correlated simulation for championship weeks for every playoff team
  // (we need scores for all teams since wildcard winners vary per simulation)
  let championship_raw_scores = null
  if (championship_weeks_to_simulate.length > 0) {
    const championship_result = await simulate_playoff_weeks_correlated({
      league_id,
      team_ids: all_playoff_tids,
      weeks: championship_weeks_to_simulate,
      year,
      n_simulations
    })
    championship_raw_scores = championship_result.raw_team_scores
  }

  // Completed championship weeks are constant across simulations, so total them
  // once. They are deliberately NOT passed to the simulation as
  // locked_week_scores: that folds them into every entry of raw_team_scores, so
  // adding them here as well would weight a completed week twice against a
  // simulated one.
  const completed_championship_totals = new Map(
    all_playoff_tids.map((tid) => [
      tid,
      sum_actual_points({ actual_points, weeks: championship_weeks, tid })
    ])
  )

  // Run Monte Carlo winner counting
  log(`Counting winners from ${n_simulations} simulations`)
  for (let sim = 0; sim < n_simulations; sim++) {
    const wildcard_winners =
      actual_wildcard_winners ||
      select_wildcard_winners({
        wildcard_tids,
        survivor_count: wildcard_survivor_count,
        get_score: (tid) => wildcard_raw_scores.get(tid)[sim]
      })

    // Championship round: bye teams + wildcard winners
    const championship_teams = [...bye_tids, ...wildcard_winners]

    const winner_tid = find_highest_scoring_team({
      team_ids: championship_teams,
      get_score: (tid) =>
        completed_championship_totals.get(tid) +
        (championship_raw_scores ? championship_raw_scores.get(tid)[sim] : 0)
    })

    if (winner_tid !== null) {
      result[winner_tid].championship_wins++
    }
  }

  set_simulated_championship_odds({ result, n_simulations })

  const elapsed_ms = Date.now() - start_time
  log(`Wildcard forecast completed in ${elapsed_ms}ms`)

  return result
}

/**
 * Simulate the championship round forecast.
 * Uses player-level correlation simulation.
 * Incorporates actual results for completed weeks.
 *
 * @param {object} params
 * @param {number} params.league_id - League ID
 * @param {number} [params.year] - NFL year
 * @param {number} [params.n_simulations=10000] - Number of simulations
 * @returns {Promise<object>} Forecast results keyed by team ID
 */
export async function simulate_championship_forecast({
  league_id,
  year = current_season.year,
  n_simulations = SIMULATIONS
}) {
  const start_time = Date.now()
  log(`Starting championship forecast for league ${league_id}`)

  // The championship weeks are per-league configuration on the season row, the
  // same source the caller dispatches on.
  const { championship_weeks } = await get_season_playoff_weeks({
    lid: league_id,
    season_year: year
  })

  if (!championship_weeks.length) {
    throw new Error(
      `No championship weeks configured for league ${league_id} in ${year}`
    )
  }

  // One read of the playoff field, filtered two ways below.
  // playoffs.playoff_week_number is an ORDINAL, not a week: 1 is the wildcard
  // round and every entry above it is the championship round, however many
  // weeks that round spans.
  const playoffs = await db('playoffs').where({
    lid: league_id,
    season_year: year
  })

  const championship_tids = [
    ...new Set(
      playoffs.filter((p) => p.playoff_week_number > 1).map((p) => p.tid)
    )
  ]
  const all_playoff_tids = [...new Set(playoffs.map((p) => p.tid))]

  const { playoff_format } = await load_simulation_context({ league_id, year })
  const { bye_count } = playoff_format
  const wildcard_survivor_count = count_wildcard_survivors({
    playoff_team_count: playoff_format.playoff_team_count,
    bye_count
  })
  // Byes plus the wildcard survivors, which is one winner per wildcard pairing.
  const championship_team_count = bye_count + wildcard_survivor_count

  if (championship_tids.length !== championship_team_count) {
    throw new Error(
      `Expected ${championship_team_count} championship teams, found ${championship_tids.length}`
    )
  }

  // Get all teams for result
  const all_teams = await db('teams').where({
    lid: league_id,
    season_year: year
  })

  // Load team stats to identify which seeds received a bye, and to resolve the
  // division winners the completed regular season decided.
  const team_stats_list = await db('league_team_seasonlogs').where({
    lid: league_id,
    season_year: year
  })

  const team_stats_by_tid = {}
  for (const stats of team_stats_list) {
    team_stats_by_tid[stats.tid] = stats
  }

  const division_winner_tids = resolve_decided_division_winners({
    teams: all_teams,
    team_stats_by_tid,
    playoff_format
  })

  // Initialize results
  const result = {}
  for (const team of all_teams) {
    const team_stats = team_stats_by_tid[team.team_id]
    // The top bye_count seeds receive the bye; divisions confer no berth.
    // Number.isInteger first: the optional chain guards undefined, not null,
    // and a null regular_season_finish coerces to 0 <= bye_count, awarding a
    // bye to every team with no recorded finish.
    const has_bye =
      Number.isInteger(team_stats?.regular_season_finish) &&
      team_stats.regular_season_finish <= bye_count

    result[team.team_id] = {
      tid: team.team_id,
      playoff_odds: all_playoff_tids.includes(team.team_id) ? 1.0 : 0.0,
      division_odds: decided_division_odds({
        division_winner_tids,
        team_id: team.team_id
      }),
      bye_odds: has_bye ? 1.0 : 0.0,
      championship_wins: 0
    }
  }

  // Load actual playoff points for completed weeks
  const { actual_points, weeks_with_results } =
    await load_actual_playoff_points({
      league_id,
      team_ids: championship_tids,
      weeks: championship_weeks,
      year
    })

  log(`Weeks with actual results: ${weeks_with_results.join(', ') || 'none'}`)

  // Determine which weeks need simulation
  const weeks_to_simulate = championship_weeks.filter(
    (w) => !weeks_with_results.includes(w)
  )

  // If all weeks have results, no simulation needed - just count the winner
  if (weeks_to_simulate.length === 0) {
    log('All championship weeks complete - using actual results')

    const winner_tid = find_highest_scoring_team({
      team_ids: championship_tids,
      get_score: (tid) =>
        sum_actual_points({ actual_points, weeks: championship_weeks, tid })
    })

    set_decided_championship_odds({ result, winner_tid })

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
    const winner_tid = find_highest_scoring_team({
      team_ids: championship_tids,
      get_score: (tid) => raw_team_scores.get(tid)[sim]
    })

    if (winner_tid !== null) {
      result[winner_tid].championship_wins++
    }
  }

  set_simulated_championship_odds({ result, n_simulations })

  const elapsed_ms = Date.now() - start_time
  log(`Championship forecast completed in ${elapsed_ms}ms`)

  return result
}
