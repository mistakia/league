/**
 * Season forecasting using player-level correlation simulation.
 * Calculates playoff odds, division odds, bye odds, and championship odds.
 *
 * One principle runs through this module: every measure the league format reads
 * must move with the simulation. The 2026 format decides four of its six berths
 * on All Play win percentage and points for, so a forecast that copies those
 * two from actuals and never updates them is not a forecast of those berths at
 * all -- it is a deterministic function of the season so far, and in the
 * season's zero state it degenerates completely. Head-to-head outcome, points
 * for and All Play therefore all come from ONE drawn set of scores per week.
 */

import debug from 'debug'

import db from '#db'
import { current_season } from '#constants'
import {
  groupBy,
  get_playoff_seeding,
  seeded_random,
  calculate_week_all_play_records
} from '#libs-shared'
import { get_season_playoff_weeks } from '#libs-server'

import { simulate_league_week } from './simulate-league-week.mjs'
import { simulate_playoff_weeks_correlated } from './simulate-playoff-weeks.mjs'
import { load_simulation_context } from './simulation-helpers.mjs'
import { accumulate_simulated_week_standings } from './accumulate-simulated-week-standings.mjs'
import {
  find_highest_scoring_team,
  select_wildcard_winners,
  count_wildcard_survivors
} from './resolve-playoff-bracket.mjs'
import { league_has_divisions } from './resolve-division-odds.mjs'

const log = debug('simulation:season-forecast')

const SIMULATIONS = 10000

/**
 * The smallest conditional subset a forced-outcome forecast may be built from.
 *
 * Conditioning on an outcome discards every draw where it did not happen, so a
 * team at a 0.9 win probability has roughly a tenth of the sample left for its
 * forced LOSS. Measured over 1000 draws: p=0.9 leaves ~100 usable indices at a
 * 5.0pp standard error, p=0.95 leaves ~41 at 7.8pp, p=0.99 leaves ~6 at 20.4pp.
 * The outer loop cannot reduce that -- resampling the same six draws ten
 * thousand times reports 20pp of noise as a forecast. Emptiness is the wrong
 * trigger: it fires only in the determined case, which is handled separately
 * below and is an answer rather than a failure.
 */
const MINIMUM_CONDITIONAL_DRAWS = 100

/**
 * Load everything the forecast reads out of the database.
 *
 * Split out as an injectable parameter because every entry point below opens
 * with a query, which is what left this module with caller-level coverage only.
 * Production passes nothing and behaves identically -- a default parameter
 * evaluates only when the argument is omitted.
 *
 * @param {object} params
 * @param {number} params.league_id - League ID
 * @param {number} params.year - Season year
 * @param {number} params.current_week - Week the forecast runs from
 * @param {number | null} params.week - The caller's week override, if any
 * @param {number} params.regular_season_final_week - Last regular season week
 */
const load_forecast_context = async ({
  league_id,
  year,
  current_week,
  week,
  regular_season_final_week
}) => {
  const { playoff_format } = await load_simulation_context({ league_id, year })

  const teams = await db('teams').where({ lid: league_id, season_year: year })

  const team_stats_by_tid = {}

  if (week) {
    // Historical mode: the seasonlogs row describes the finished season, not
    // the season as of this week, so tally the completed matchups instead.
    const completed_matchups = await db('matchups')
      .where({ lid: league_id, season_year: year })
      .where('week', '<', current_week)
      .whereNotNull('home_points')
      .whereNotNull('away_points')

    for (const team of teams) {
      team_stats_by_tid[team.team_id] = {
        tid: team.team_id,
        division: team.division,
        regular_season_wins: 0,
        regular_season_losses: 0,
        regular_season_ties: 0,
        points_for: 0,
        all_play_wins: 0,
        all_play_losses: 0,
        all_play_ties: 0
      }
    }

    const scores_by_week = new Map()

    for (const m of completed_matchups) {
      const home_stats = team_stats_by_tid[m.home_team_id]
      const away_stats = team_stats_by_tid[m.away_team_id]

      if (!home_stats || !away_stats) {
        throw new Error(
          `matchup ${m.matchup_id} references a team outside league ${league_id} season ${year}: home ${m.home_team_id}, away ${m.away_team_id}`
        )
      }

      const home_points = parseFloat(m.home_points)
      const away_points = parseFloat(m.away_points)

      if (home_points > away_points) {
        home_stats.regular_season_wins++
        away_stats.regular_season_losses++
      } else if (away_points > home_points) {
        away_stats.regular_season_wins++
        home_stats.regular_season_losses++
      } else {
        home_stats.regular_season_ties++
        away_stats.regular_season_ties++
      }

      home_stats.points_for += home_points
      away_stats.points_for += away_points

      if (!scores_by_week.has(m.week)) scores_by_week.set(m.week, new Map())
      scores_by_week.get(m.week).set(m.home_team_id, home_points)
      scores_by_week.get(m.week).set(m.away_team_id, away_points)
    }

    // All Play is a primary sort key under this format, so the completed weeks
    // have to carry it too -- starting the simulation from a zero All Play
    // record understates every team that has been scoring well and losing.
    accumulate_completed_all_play({ team_stats_by_tid, scores_by_week })

    // regular_season_finish is a seasonlogs column and this branch has no
    // seasonlogs row; build_post_season_forecast reads it to award byes, so
    // rank the tallied standings on the league's own ladder to supply it.
    const { seeded_tids } = get_playoff_seeding({
      teams: Object.values(team_stats_by_tid),
      ...playoff_format
    })
    seeded_tids.forEach((tid, index) => {
      team_stats_by_tid[tid].regular_season_finish = index + 1
    })
  } else {
    const team_stats = await db('league_team_seasonlogs')
      .where({ lid: league_id, season_year: year })
      .whereIn(
        'tid',
        teams.map((t) => t.team_id)
      )

    for (const stats of team_stats) {
      team_stats_by_tid[stats.tid] = stats
    }
  }

  const remaining_matchups = await db('matchups')
    .where({ lid: league_id, season_year: year })
    .where('week', '>=', current_week)
    .where('week', '<=', regular_season_final_week)

  const { wildcard_week, championship_weeks } = await get_season_playoff_weeks({
    lid: league_id,
    season_year: year
  })

  return {
    teams,
    team_stats_by_tid,
    remaining_matchups,
    playoff_format,
    wildcard_week,
    championship_weeks
  }
}

/**
 * Fold the All Play record of every completed week into the starting standings.
 *
 * @param {object} params
 * @param {Record<number, object>} params.team_stats_by_tid - Standings to add to
 * @param {Map<number, Map<number, number>>} params.scores_by_week - week -> tid -> score
 */
const accumulate_completed_all_play = ({
  team_stats_by_tid,
  scores_by_week
}) => {
  for (const [, scores_by_team_id] of scores_by_week) {
    const records = calculate_week_all_play_records({ scores_by_team_id })
    for (const [team_id, record] of records) {
      const stats = team_stats_by_tid[team_id]
      stats.all_play_wins += record.all_play_wins
      stats.all_play_losses += record.all_play_losses
      stats.all_play_ties += record.all_play_ties
    }
  }
}

/**
 * One week's correlated per-team score vectors, at the forecast's own
 * simulation count.
 *
 * Built at the OUTER n_simulations deliberately. Drawing an index per week
 * samples with replacement from however many draws the vectors hold, so a
 * smaller inner count caps the effective sample size no matter how large the
 * outer loop is -- measured at a true week win probability of 0.5, an inner
 * 1000 freezes 1.57pp of the 1.65pp reported-odds RMSE. That was tolerable when
 * these vectors only fed a head-to-head probability; it is not now that they
 * are the noise floor on bye_odds, which is the number this exists to fix.
 *
 * @param {object} params
 * @param {number} params.league_id - League ID
 * @param {number} params.week - Week to simulate
 * @param {number} params.year - Season year
 * @param {number} params.n_simulations - Draws to build
 * @param {number} [params.seed] - Seed for the correlated draw
 * @param {boolean} params.use_actual_results - Use actual points for final games
 * @returns {Promise<Map<number, number[]>>} Per-team score vectors
 */
const load_week_raw_team_scores = async ({
  league_id,
  week,
  year,
  n_simulations,
  seed,
  use_actual_results
}) => {
  const week_result = await simulate_league_week({
    league_id,
    week,
    year,
    n_simulations,
    seed,
    use_actual_results
  })

  return week_result.raw_team_scores
}

/**
 * Per-week correlated score vectors for the playoff rounds.
 *
 * One call over the union of the rounds' weeks rather than one per round: each
 * call repeats the whole shared load -- rosters, projections, variance,
 * correlations, archetypes -- and the round split is recovered from the
 * per-week vectors afterwards.
 *
 * @param {object} params
 * @param {number} params.league_id - League ID
 * @param {number[]} params.team_ids - Every team, since the field varies per iteration
 * @param {number[]} params.weeks - Wildcard and championship weeks
 * @param {number} params.year - Season year
 * @param {number} params.n_simulations - Draws to build
 * @param {number} [params.seed] - Seed for the correlated draw
 * @returns {Promise<Map<number, Map<number, number[]>>>} week -> tid -> vector
 */
const load_playoff_raw_team_scores_by_week = async ({
  league_id,
  team_ids,
  weeks,
  year,
  n_simulations,
  seed
}) => {
  const { raw_team_scores_by_week } = await simulate_playoff_weeks_correlated({
    league_id,
    team_ids,
    weeks,
    year,
    n_simulations,
    seed
  })

  return raw_team_scores_by_week
}

/**
 * Simulate season forecast for a league.
 * Calculates playoff/division/bye/championship odds for all teams.
 *
 * @param {object} params
 * @param {number} params.league_id - League ID
 * @param {number} [params.year] - NFL year (defaults to current)
 * @param {number} [params.week] - Forecast from this week instead of the active
 *   fantasy week. Passing it also switches the mode: standings come from the
 *   completed matchups rather than the seasonlogs table, and the week
 *   simulations ignore actual results, since in historical testing the games
 *   being forecast have already been played. Passing the current week is
 *   therefore NOT equivalent to omitting it.
 * @param {number} [params.n_simulations=10000] - Number of Monte Carlo iterations
 * @param {number} [params.seed] - Seed for every draw the forecast makes
 * @param {string} [params.force_win_tid] - Force this team to win its matchup in
 *   the first remaining week
 * @param {string} [params.force_loss_tid] - Force this team to lose its matchup
 *   in the first remaining week
 * @param {(params: object) => Promise<object>} [params.load_context] - Test
 *   seam: everything the forecast reads out of the database
 * @param {(params: object) => Promise<Map<number, number[]>>} [params.load_week_scores] -
 *   Test seam: one week's per-team score vectors
 * @param {(params: object) => Promise<Map<number, Map<number, number[]>>>} [params.load_playoff_scores] -
 *   Test seam: per-week playoff score vectors
 * @returns {Promise<object>} Forecast results keyed by team ID
 */
export async function simulate_season_forecast({
  league_id,
  year = current_season.year,
  week = null,
  n_simulations = SIMULATIONS,
  seed,
  force_win_tid = null,
  force_loss_tid = null,
  load_context = load_forecast_context,
  load_week_scores = load_week_raw_team_scores,
  load_playoff_scores = load_playoff_raw_team_scores_by_week
}) {
  const start_time = Date.now()
  const current_week = week || current_season.active_fantasy_week
  const regular_season_final_week = current_season.regular_season_final_week

  log(
    `Starting season forecast for league ${league_id}, week ${current_week}, year ${year}`
  )

  const {
    teams,
    team_stats_by_tid,
    remaining_matchups,
    playoff_format,
    wildcard_week,
    championship_weeks
  } = await load_context({
    league_id,
    year,
    current_week,
    week,
    regular_season_final_week
  })

  // Division membership is a property of the teams table and is invariant
  // across every iteration, so it is settled once here rather than
  // re-evaluated ten thousand times inside the loop -- and a partial
  // configuration has to stop the forecast BEFORE it starts rather than
  // mid-loop.
  const has_divisions = league_has_divisions({ teams })

  const team_ids = teams.map((team) => team.team_id)

  if (remaining_matchups.length === 0) {
    log('No remaining matchups - season complete')
    return build_post_season_forecast({
      league_id,
      year,
      teams,
      team_stats_by_tid,
      playoff_format,
      has_divisions,
      n_simulations,
      seed,
      wildcard_week,
      championship_weeks,
      load_playoff_scores
    })
  }

  const matchups_by_week = groupBy(remaining_matchups, 'week')
  const weeks = Object.keys(matchups_by_week)
    .map(Number)
    .sort((a, b) => a - b)

  log(`Simulating ${weeks.length} remaining weeks: ${weeks.join(', ')}`)

  // For historical testing, don't use actual results (games have already been played)
  const use_actual_results = !week

  // Every draw this function makes comes off one generator, so a run is
  // reproducible from `seed` alone. Unseeded, the clock supplies the seed --
  // which keeps a single code path rather than branching to the global PRNG.
  // Named here rather than spelled, so a grep asserting this module draws only
  // from the seeded generator reads a genuine zero.
  const draw_seed = Number.isInteger(seed) ? seed : Date.now() >>> 0
  const random = seeded_random(draw_seed)
  const draw_index = () => Math.floor(random() * n_simulations)

  // Build every remaining week's correlated score vectors up front. This is
  // what replaces the win-probability pre-pass: the probabilities were the
  // empirical win frequency over exactly these vectors, and collapsing to them
  // threw away the joint structure that makes points_for and All Play
  // consistent with the head-to-head result.
  const week_scores = new Map()
  let week_seed = Number.isInteger(seed) ? seed : undefined
  for (const sim_week of weeks) {
    log(`Building week ${sim_week} score vectors`)
    const raw_team_scores = await load_week_scores({
      league_id,
      week: sim_week,
      year,
      n_simulations,
      seed: week_seed,
      use_actual_results
    })

    // The pre-pass carried the only guard that a week covers every team, and
    // it can genuinely fail: simulate-league-week skips a matchup with missing
    // team scores, and load-team-rosters filters out a team with zero
    // starters. Without a named throw here the loop below reads
    // `raw_team_scores.get(tid)[index]` off undefined and reports a TypeError
    // naming nothing.
    const missing_tids = team_ids.filter((tid) => !raw_team_scores.has(tid))
    if (missing_tids.length) {
      throw new Error(
        `week ${sim_week} produced no simulated scores for team(s) ${missing_tids.join(', ')}, leaving them a game short of the rest of the league`
      )
    }

    week_scores.set(sim_week, raw_team_scores)

    // Each week gets its own stream so two weeks do not share a draw sequence.
    if (week_seed !== undefined) week_seed += 1000
  }

  if (!wildcard_week || !championship_weeks.length) {
    throw new Error(
      `league ${league_id} has no playoff weeks configured for ${year}, so championship odds cannot be simulated`
    )
  }

  const playoff_weeks = [wildcard_week, ...championship_weeks]
  log(`Building playoff score vectors for weeks ${playoff_weeks.join(', ')}`)

  // Over ALL teams, not the playoff field: the field varies per iteration, so
  // there is no fixed set to simulate.
  const playoff_scores_by_week = await load_playoff_scores({
    league_id,
    team_ids,
    weeks: playoff_weeks,
    year,
    n_simulations,
    seed: Number.isInteger(seed) ? seed + 100000 : undefined
  })

  const wildcard_survivor_count = count_wildcard_survivors({
    playoff_team_count: playoff_format.playoff_team_count,
    bye_count: playoff_format.bye_count
  })

  const first_remaining_week = weeks[0]
  const conditional_indexes = resolve_conditional_indexes({
    force_win_tid,
    force_loss_tid,
    week_matchups: matchups_by_week[first_remaining_week],
    raw_team_scores: week_scores.get(first_remaining_week),
    n_simulations,
    week: first_remaining_week
  })

  // Initialize result trackers
  const result = {}
  for (const team of teams) {
    result[team.team_id] = {
      tid: team.team_id,
      div: team.division,
      playoff_appearances: 0,
      division_wins: 0,
      byes: 0,
      championship_wins: 0
    }
  }

  log(`Running ${n_simulations} Monte Carlo simulations`)

  for (let sim = 0; sim < n_simulations; sim++) {
    const standings = {}
    for (const team of teams) {
      const stats = team_stats_by_tid[team.team_id] || {}
      standings[team.team_id] = {
        tid: team.team_id,
        division: team.division,
        regular_season_wins: stats.regular_season_wins || 0,
        regular_season_losses: stats.regular_season_losses || 0,
        regular_season_ties: stats.regular_season_ties || 0,
        points_for: Number(stats.points_for) || 0,
        all_play_wins: stats.all_play_wins || 0,
        all_play_losses: stats.all_play_losses || 0,
        all_play_ties: stats.all_play_ties || 0
      }
    }

    for (const sim_week of weeks) {
      const raw_team_scores = week_scores.get(sim_week)

      // One index for the whole week, read by every team. That is what carries
      // the correlated draw's joint structure into the standings: index i is
      // one coherent realization of the league's week, so a shootout that
      // lifts two teams together lifts them together here.
      const index =
        sim_week === first_remaining_week && conditional_indexes
          ? conditional_indexes[
              Math.floor(random() * conditional_indexes.length)
            ]
          : draw_index()

      const scores_by_team_id = new Map(
        team_ids.map((tid) => [tid, raw_team_scores.get(tid)[index]])
      )

      accumulate_simulated_week_standings({
        standings,
        week_matchups: matchups_by_week[sim_week],
        scores_by_team_id
      })
    }

    const { playoff_tids, bye_tids, division_winner_tids } =
      get_playoff_seeding({
        teams: Object.values(standings),
        ...playoff_format
      })

    for (const tid of playoff_tids) {
      result[tid].playoff_appearances++
    }
    for (const tid of bye_tids) {
      result[tid].byes++
    }
    if (has_divisions) {
      for (const tid of division_winner_tids) {
        result[tid].division_wins++
      }
    }

    const playoff_index = draw_index()
    const champion_tid = resolve_simulated_champion({
      playoff_tids,
      bye_tids,
      wildcard_survivor_count,
      playoff_scores_by_week,
      wildcard_week,
      championship_weeks,
      index: playoff_index
    })

    if (champion_tid !== null) {
      result[champion_tid].championship_wins++
    }
  }

  for (const tid in result) {
    result[tid].playoff_odds = result[tid].playoff_appearances / n_simulations
    // Null rather than a number for an undivided league: a 0 here is a claim
    // the team failed to win a division that does not exist.
    result[tid].division_odds = has_divisions
      ? result[tid].division_wins / n_simulations
      : null
    result[tid].bye_odds = result[tid].byes / n_simulations
    result[tid].championship_odds =
      result[tid].championship_wins / n_simulations
  }

  const elapsed_ms = Date.now() - start_time
  log(`Season forecast completed in ${elapsed_ms}ms`)

  return result
}

/**
 * Resolve one iteration's champion from the drawn playoff scores.
 *
 * @param {object} params
 * @param {number[]} params.playoff_tids - The iteration's playoff field
 * @param {number[]} params.bye_tids - Teams admitted directly
 * @param {number} params.wildcard_survivor_count - Teams advancing from the wildcard round
 * @param {Map<number, Map<number, number[]>>} params.playoff_scores_by_week - week -> tid -> vector
 * @param {number} params.wildcard_week - The wildcard round's week
 * @param {number[]} params.championship_weeks - The championship round's weeks
 * @param {number} params.index - The drawn simulation index
 * @returns {number | null} Champion team ID
 */
const resolve_simulated_champion = ({
  playoff_tids,
  bye_tids,
  wildcard_survivor_count,
  playoff_scores_by_week,
  wildcard_week,
  championship_weeks,
  index
}) => {
  const bye_tid_set = new Set(bye_tids)
  const wildcard_tids = playoff_tids.filter((tid) => !bye_tid_set.has(tid))

  const wildcard_scores = playoff_scores_by_week.get(wildcard_week)
  const wildcard_winners = select_wildcard_winners({
    wildcard_tids,
    survivor_count: wildcard_survivor_count,
    get_score: (tid) => wildcard_scores.get(tid)[index]
  })

  const championship_teams = [...bye_tids, ...wildcard_winners]

  return find_highest_scoring_team({
    team_ids: championship_teams,
    get_score: (tid) =>
      championship_weeks.reduce(
        (total, championship_week) =>
          total + playoff_scores_by_week.get(championship_week).get(tid)[index],
        0
      )
  })
}

/**
 * The draw indexes a forced-outcome forecast may sample from.
 *
 * Conditioning rather than flipping. The old behaviour overwrote the matchup
 * result while leaving the scores that contradicted it in place, which is what
 * made the forced forecast incoherent the moment points_for and All Play
 * started moving with the draw: a team could be recorded as winning a week it
 * lost by forty points and carry the losing score into its own tiebreakers.
 *
 * @param {object} params
 * @param {string|number|null} params.force_win_tid - Team forced to win
 * @param {string|number|null} params.force_loss_tid - Team forced to lose
 * @param {object[]} params.week_matchups - The first remaining week's matchups
 * @param {Map<number, number[]>} params.raw_team_scores - That week's score vectors
 * @param {number} params.n_simulations - Draws available
 * @param {number} params.week - The week being conditioned, for the error text
 * @returns {number[] | null} Sampleable indexes, or null when nothing is forced
 */
const resolve_conditional_indexes = ({
  force_win_tid,
  force_loss_tid,
  week_matchups,
  raw_team_scores,
  n_simulations,
  week
}) => {
  const forced_tid = force_win_tid ?? force_loss_tid
  if (forced_tid === null || forced_tid === undefined) return null

  if (force_win_tid !== null && force_loss_tid !== null) {
    throw new Error(
      'force_win_tid and force_loss_tid cannot both be set; they condition the same matchup on opposite outcomes'
    )
  }

  const team_id = Number(forced_tid)
  const matchup = week_matchups.find(
    (m) => m.home_team_id === team_id || m.away_team_id === team_id
  )

  if (!matchup) {
    throw new Error(
      `team ${team_id} has no matchup in week ${week}, so its outcome cannot be forced`
    )
  }

  const opponent_id =
    matchup.home_team_id === team_id
      ? matchup.away_team_id
      : matchup.home_team_id

  const team_scores = raw_team_scores.get(team_id)
  const opponent_scores = raw_team_scores.get(opponent_id)
  const wants_win = force_win_tid !== null

  const matching = []
  const opposing = []
  for (let index = 0; index < n_simulations; index++) {
    if (team_scores[index] > opponent_scores[index]) {
      ;(wants_win ? matching : opposing).push(index)
    } else if (team_scores[index] < opponent_scores[index]) {
      ;(wants_win ? opposing : matching).push(index)
    }
  }

  if (matching.length >= MINIMUM_CONDITIONAL_DRAWS) return matching

  // Determined: every game in the week is final and use_actual_results is set,
  // so each score vector is a constant and one side of the matchup is a
  // certainty. This happens every week between the last kickoff and the
  // rollover, so it must not throw -- a determined outcome is an answer. The
  // condition selects nothing, so the forecast is the unconditional one.
  if (matching.length === 0 && opposing.length === n_simulations) {
    log(
      `week ${week} matchup ${matchup.matchup_id} is already decided; the forced ${wants_win ? 'win' : 'loss'} for team ${team_id} cannot occur, returning the unconditional forecast`
    )
    return null
  }

  throw new Error(
    `forcing team ${team_id} to ${wants_win ? 'win' : 'lose'} in week ${week} leaves only ${matching.length} of ${n_simulations} draws, below the ${MINIMUM_CONDITIONAL_DRAWS} needed for a usable estimate; resampling that few draws reports its own noise as a forecast`
  )
}

/**
 * Build forecast when regular season is complete.
 *
 * The regular season's berths are decided, so playoff, bye and division odds
 * are 1 or 0. Championship odds are not decided and are simulated over the
 * actual field rather than fabricated -- this function used to return a literal
 * zero for every team, which the caller persisted.
 *
 * @param {object} params
 * @param {number} params.league_id - League ID
 * @param {number} params.year - Season year
 * @param {object[]} params.teams - Team rows
 * @param {Record<number, object>} params.team_stats_by_tid - Final standings
 * @param {object} params.playoff_format - The league's playoff settings
 * @param {boolean} params.has_divisions - Whether the league has divisions
 * @param {number} params.n_simulations - Monte Carlo iterations
 * @param {number} [params.seed] - Seed for every draw
 * @param {number | null} params.wildcard_week - Wildcard round week
 * @param {number[]} params.championship_weeks - Championship round weeks
 * @param {(params: object) => Promise<Map<number, Map<number, number[]>>>} params.load_playoff_scores -
 *   Playoff score vector loader
 * @returns {Promise<object>} Forecast results keyed by team ID
 */
async function build_post_season_forecast({
  league_id,
  year,
  teams,
  team_stats_by_tid,
  playoff_format,
  has_divisions,
  n_simulations,
  seed,
  wildcard_week,
  championship_weeks,
  load_playoff_scores
}) {
  const playoffs = await db('playoffs').where({
    lid: league_id,
    season_year: year
  })

  const { division_winner_tids } = get_playoff_seeding({
    teams: teams.map((team) => ({
      ...(team_stats_by_tid[team.team_id] || {}),
      tid: team.team_id,
      division: team.division
    })),
    ...playoff_format
  })
  const division_winner_tid_set = new Set(division_winner_tids)

  const result = {}
  const playoff_tids = []
  const bye_tids = []

  for (const team of teams) {
    const stats = team_stats_by_tid[team.team_id]
    const is_playoff_team = playoffs.some((p) => p.tid === team.team_id)
    // Number.isInteger first: the optional chain guards undefined, not null,
    // and a null finish coerces to 0 <= bye_count, awarding a bye to every team
    // with no recorded finish.
    const has_bye =
      Number.isInteger(stats?.regular_season_finish) &&
      stats.regular_season_finish <= playoff_format.bye_count

    if (is_playoff_team) playoff_tids.push(team.team_id)
    if (has_bye) bye_tids.push(team.team_id)

    result[team.team_id] = {
      tid: team.team_id,
      playoff_odds: is_playoff_team ? 1.0 : 0.0,
      division_odds: has_divisions
        ? division_winner_tid_set.has(team.team_id)
          ? 1.0
          : 0.0
        : null,
      bye_odds: has_bye ? 1.0 : 0.0,
      championship_odds: 0
    }
  }

  const championship_wins = {}

  if (!playoff_tids.length) {
    log('No playoff field recorded - leaving championship odds at zero')
    return result
  }

  if (!wildcard_week || !championship_weeks.length) {
    throw new Error(
      `league ${league_id} has no playoff weeks configured for ${year}, so championship odds cannot be simulated`
    )
  }

  const playoff_weeks = [wildcard_week, ...championship_weeks]
  const playoff_scores_by_week = await load_playoff_scores({
    league_id,
    team_ids: playoff_tids,
    weeks: playoff_weeks,
    year,
    n_simulations,
    seed: Number.isInteger(seed) ? seed + 100000 : undefined
  })

  const wildcard_survivor_count = count_wildcard_survivors({
    playoff_team_count: playoff_format.playoff_team_count,
    bye_count: playoff_format.bye_count
  })

  for (let sim = 0; sim < n_simulations; sim++) {
    const champion_tid = resolve_simulated_champion({
      playoff_tids,
      bye_tids,
      wildcard_survivor_count,
      playoff_scores_by_week,
      wildcard_week,
      championship_weeks,
      index: sim
    })

    if (champion_tid !== null) {
      championship_wins[champion_tid] =
        (championship_wins[champion_tid] || 0) + 1
    }
  }

  for (const tid in result) {
    result[tid].championship_odds =
      (championship_wins[tid] || 0) / n_simulations
  }

  return result
}
