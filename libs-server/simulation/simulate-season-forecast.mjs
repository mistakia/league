/**
 * Season forecasting using player-level correlation simulation.
 * Calculates playoff odds, division odds, bye odds, and championship odds.
 */

import debug from 'debug'

import db from '#db'
import { current_season } from '#constants'
import { groupBy, get_playoff_seeding } from '#libs-shared'

import { simulate_league_week } from './simulate-league-week.mjs'
import { load_simulation_context } from './simulation-helpers.mjs'

const log = debug('simulation:season-forecast')

const SIMULATIONS = 10000

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
 * @param {string} [params.force_win_tid] - Force this team to win its matchup in
 *   the first remaining week
 * @param {string} [params.force_loss_tid] - Force this team to lose its matchup
 *   in the first remaining week
 * @returns {Promise<object>} Forecast results keyed by team ID
 */
export async function simulate_season_forecast({
  league_id,
  year = current_season.year,
  week = null,
  n_simulations = SIMULATIONS,
  force_win_tid = null,
  force_loss_tid = null
}) {
  const start_time = Date.now()
  const current_week = week || current_season.active_fantasy_week
  const regular_season_final_week = current_season.regular_season_final_week

  log(
    `Starting season forecast for league ${league_id}, week ${current_week}, year ${year}`
  )

  // Load league context (validates league exists, supplies the playoff format)
  const { playoff_format } = await load_simulation_context({
    league_id,
    year
  })

  // Load teams and current standings
  const teams = await db('teams').where({ lid: league_id, season_year: year })

  // If week override is provided, compute standings from completed matchups
  // Otherwise use the seasonlogs table
  const team_stats_by_tid = {}

  if (week) {
    // Compute standings from matchups through week-1
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

    for (const m of completed_matchups) {
      const home_stats = team_stats_by_tid[m.home_team_id]
      const away_stats = team_stats_by_tid[m.away_team_id]

      if (!home_stats || !away_stats) {
        throw new Error(
          `matchup ${m.matchup_id} references a team outside league ${league_id} season ${year}: home ${m.home_team_id}, away ${m.away_team_id}`
        )
      }

      const hp = parseFloat(m.home_points)
      const ap = parseFloat(m.away_points)

      if (hp > ap) {
        home_stats.regular_season_wins++
        away_stats.regular_season_losses++
      } else if (ap > hp) {
        away_stats.regular_season_wins++
        home_stats.regular_season_losses++
      } else {
        home_stats.regular_season_ties++
        away_stats.regular_season_ties++
      }

      home_stats.points_for += hp
      away_stats.points_for += ap
    }

    // regular_season_finish is a seasonlogs column, and this branch has no
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
    // Use end-of-season stats
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

  // Load remaining regular season matchups
  const remaining_matchups = await db('matchups')
    .where({ lid: league_id, season_year: year })
    .where('week', '>=', current_week)
    .where('week', '<=', regular_season_final_week)

  if (remaining_matchups.length === 0) {
    log('No remaining matchups - season complete')
    return build_post_season_forecast({
      league_id,
      year,
      teams,
      team_stats_by_tid,
      playoff_format
    })
  }

  // Group matchups by week
  const matchups_by_week = groupBy(remaining_matchups, 'week')
  const weeks = Object.keys(matchups_by_week)
    .map(Number)
    .sort((a, b) => a - b)

  log(`Simulating ${weeks.length} remaining weeks: ${weeks.join(', ')}`)

  // For historical testing, don't use actual results (games have already been played)
  const use_actual_results = !week

  // Pre-compute matchup win probabilities for each remaining week
  const week_probabilities = new Map()

  // No fallback probabilities. A week that cannot be simulated -- a failed
  // projection load, a matchup whose rosters produced no scores -- has to stop
  // the forecast, because every substitute (50/50, or dropping the matchup)
  // produces a plausible-looking forecast the caller persists as real.
  for (const sim_week of weeks) {
    log(`Computing win probabilities for week ${sim_week}`)
    const week_result = await simulate_league_week({
      league_id,
      week: sim_week,
      year,
      n_simulations: 1000, // Fewer sims for probability estimation
      use_actual_results
    })

    const probs = new Map()
    for (const matchup of week_result.matchups) {
      probs.set(matchup.matchup_id, {
        home_win_prob: matchup.home_win_probability,
        tie_prob: matchup.tie_probability
      })
    }

    for (const matchup of matchups_by_week[sim_week]) {
      if (!probs.has(matchup.matchup_id)) {
        throw new Error(
          `week ${sim_week} matchup ${matchup.matchup_id} was omitted by simulate_league_week, leaving both teams a game short of the rest of the league`
        )
      }
    }

    week_probabilities.set(sim_week, probs)
  }

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

  // The forced team's own matchup, in the first remaining week -- the game the
  // caller means by "current".
  const force_win_team_id = force_win_tid ? Number(force_win_tid) : null
  const force_loss_team_id = force_loss_tid ? Number(force_loss_tid) : null
  const first_remaining_week = weeks[0]

  // Run Monte Carlo simulations
  log(`Running ${n_simulations} Monte Carlo simulations`)

  for (let sim = 0; sim < n_simulations; sim++) {
    // Initialize standings with current stats. The keys are the ones
    // compare_playoff_seed reads, so the simulated record actually seeds.
    const standings = {}
    for (const team of teams) {
      const stats = team_stats_by_tid[team.team_id] || {}
      standings[team.team_id] = {
        tid: team.team_id,
        division: team.division,
        regular_season_wins: stats.regular_season_wins || 0,
        regular_season_losses: stats.regular_season_losses || 0,
        regular_season_ties: stats.regular_season_ties || 0,
        points_for: stats.points_for || 0,
        all_play_wins: stats.all_play_wins || 0,
        all_play_losses: stats.all_play_losses || 0,
        all_play_ties: stats.all_play_ties || 0
      }
    }

    // Simulate remaining weeks
    for (const sim_week of weeks) {
      const week_matchups = matchups_by_week[sim_week]
      const probs = week_probabilities.get(sim_week)

      for (const matchup of week_matchups) {
        const home_stats = standings[matchup.home_team_id]
        const away_stats = standings[matchup.away_team_id]
        const outcome = decide_matchup_outcome({
          matchup,
          probabilities: probs.get(matchup.matchup_id),
          force_win_team_id:
            sim_week === first_remaining_week ? force_win_team_id : null,
          force_loss_team_id:
            sim_week === first_remaining_week ? force_loss_team_id : null
        })

        if (outcome === 'home') {
          home_stats.regular_season_wins++
          away_stats.regular_season_losses++
        } else if (outcome === 'away') {
          away_stats.regular_season_wins++
          home_stats.regular_season_losses++
        } else {
          home_stats.regular_season_ties++
          away_stats.regular_season_ties++
        }
      }
    }

    // Determine playoff seedings
    const { playoff_tids, bye_tids } = get_playoff_seeding({
      teams: Object.values(standings),
      ...playoff_format
    })

    // Record results
    for (const tid of playoff_tids) {
      result[tid].playoff_appearances++
    }
    for (const tid of bye_tids) {
      // division_wins mirrors byes because a division confers no berth; the
      // division_odds column it feeds is now a duplicate of bye_odds and is
      // retained only because the column is NOT NULL in the schema.
      result[tid].division_wins++
      result[tid].byes++
    }

    // Simulate playoffs
    const champion_tid = simulate_playoffs({
      playoff_tids,
      bye_tids,
      playoff_format
    })

    if (champion_tid) {
      result[champion_tid].championship_wins++
    }
  }

  // Calculate final odds
  for (const tid in result) {
    result[tid].playoff_odds = result[tid].playoff_appearances / n_simulations
    result[tid].division_odds = result[tid].division_wins / n_simulations
    result[tid].bye_odds = result[tid].byes / n_simulations
    result[tid].championship_odds =
      result[tid].championship_wins / n_simulations
  }

  const elapsed_ms = Date.now() - start_time
  log(`Season forecast completed in ${elapsed_ms}ms`)

  return result
}

/**
 * Decide one simulated matchup.
 *
 * Three outcomes, drawn from the probabilities simulate_league_week returned:
 * home and away win probabilities do not sum to 1, and the remainder is the tie
 * mass, so a single boolean against home_win_prob would hand every tie to the
 * away team.
 *
 * A force applies to the matchup the forced team is actually in -- the caller
 * names a team, not a position in the schedule's iteration order.
 *
 * @returns {'home'|'away'|'tie'}
 */
function decide_matchup_outcome({
  matchup,
  probabilities,
  force_win_team_id,
  force_loss_team_id
}) {
  if (
    force_win_team_id === matchup.home_team_id ||
    force_loss_team_id === matchup.away_team_id
  ) {
    return 'home'
  }

  if (
    force_win_team_id === matchup.away_team_id ||
    force_loss_team_id === matchup.home_team_id
  ) {
    return 'away'
  }

  const draw = Math.random()

  if (draw < probabilities.home_win_prob) {
    return 'home'
  }

  if (draw < probabilities.home_win_prob + probabilities.tie_prob) {
    return 'tie'
  }

  return 'away'
}

/**
 * Simulate playoff rounds.
 * Uses simplified probability-based simulation.
 */
function simulate_playoffs({ playoff_tids, bye_tids, playoff_format }) {
  // All non-bye teams compete in wildcard round
  const wildcard_competitors = playoff_tids.filter(
    (tid) => !bye_tids.includes(tid)
  )

  // Bracket shape comes from the league's format, as in
  // simulate-playoff-forecast.mjs: half the non-bye field survives the wildcard
  // round and joins the bye teams in the championship.
  const wildcard_survivor_count = Math.floor(
    (playoff_format.playoff_team_count - playoff_format.bye_count) / 2
  )

  const wildcard_scores = wildcard_competitors.map((tid) => ({
    tid,
    score: Math.random()
  }))
  wildcard_scores.sort((a, b) => b.score - a.score)
  const wildcard_winners = wildcard_scores
    .slice(0, wildcard_survivor_count)
    .map((s) => s.tid)

  // Championship round: bye teams + wildcard winners
  const championship_teams = [...bye_tids, ...wildcard_winners]

  // Simulate 2-week championship
  const championship_scores = championship_teams.map((tid) => ({
    tid,
    score: Math.random() + Math.random() // 2 weeks
  }))
  championship_scores.sort((a, b) => b.score - a.score)

  return championship_scores[0]?.tid
}

/**
 * Build forecast when regular season is complete.
 */
async function build_post_season_forecast({
  league_id,
  year,
  teams,
  team_stats_by_tid,
  playoff_format
}) {
  // Load playoff data
  const playoffs = await db('playoffs').where({
    lid: league_id,
    season_year: year
  })

  const result = {}
  for (const team of teams) {
    const stats = team_stats_by_tid[team.team_id]
    const is_playoff_team = playoffs.some((p) => p.tid === team.team_id)
    // Number.isInteger first: the optional chain guards undefined, not null,
    // and a null finish coerces to 0 <= bye_count, awarding a bye to every team
    // with no recorded finish.
    const has_bye =
      Number.isInteger(stats?.regular_season_finish) &&
      stats.regular_season_finish <= playoff_format.bye_count

    result[team.team_id] = {
      tid: team.team_id,
      playoff_odds: is_playoff_team ? 1.0 : 0.0,
      division_odds: has_bye ? 1.0 : 0.0,
      bye_odds: has_bye ? 1.0 : 0.0,
      championship_odds: 0 // Would need playoff simulation
    }
  }

  return result
}
