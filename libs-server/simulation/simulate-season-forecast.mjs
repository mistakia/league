/**
 * Season forecasting using player-level correlation simulation.
 * Calculates playoff odds, division odds, bye odds, and championship odds.
 */

import debug from 'debug'

import db from '#db'
import { current_season } from '#constants'
import { groupBy } from '#libs-shared'

import { simulate_league_week } from './simulate-league-week.mjs'
import { load_simulation_context } from './simulation-helpers.mjs'

const log = debug('simulation:season-forecast')

const SIMULATIONS = 10000

/**
 * Simulate season forecast for a league.
 * Calculates playoff/division/bye/championship odds for all teams.
 *
 * @param {Object} params
 * @param {number} params.league_id - League ID
 * @param {number} [params.year] - NFL year (defaults to current)
 * @param {number} [params.week] - Override week for historical testing
 * @param {number} [params.n_simulations=10000] - Number of Monte Carlo iterations
 * @param {string} [params.force_win_tid] - Force this team to win current matchup
 * @param {string} [params.force_loss_tid] - Force this team to lose current matchup
 * @returns {Promise<Object>} Forecast results keyed by team ID
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
  const current_week = week || Math.max(current_season.week, 1)
  const regular_season_final_week = current_season.regularSeasonFinalWeek

  log(
    `Starting season forecast for league ${league_id}, week ${current_week}, year ${year}`
  )

  // Load league context (validates league exists)
  await load_simulation_context({
    league_id,
    year
  })

  // Load teams and current standings
  const teams = await db('teams').where({ lid: league_id, year })

  // If week override is provided, compute standings from completed matchups
  // Otherwise use the seasonlogs table
  const team_stats_by_tid = {}

  if (week) {
    // Compute standings from matchups through week-1
    const completed_matchups = await db('matchups')
      .where({ lid: league_id, year })
      .where('week', '<', current_week)
      .whereNotNull('hp')
      .whereNotNull('ap')

    for (const team of teams) {
      team_stats_by_tid[team.uid] = {
        tid: team.uid,
        wins: 0,
        losses: 0,
        ties: 0,
        pf: 0,
        apWins: 0,
        apLosses: 0,
        apTies: 0
      }
    }

    for (const m of completed_matchups) {
      const hp = parseFloat(m.hp)
      const ap = parseFloat(m.ap)

      if (hp > ap) {
        team_stats_by_tid[m.hid].wins++
        team_stats_by_tid[m.aid].losses++
      } else if (ap > hp) {
        team_stats_by_tid[m.aid].wins++
        team_stats_by_tid[m.hid].losses++
      } else {
        team_stats_by_tid[m.hid].ties++
        team_stats_by_tid[m.aid].ties++
      }

      team_stats_by_tid[m.hid].pf += hp
      team_stats_by_tid[m.aid].pf += ap
    }
  } else {
    // Use end-of-season stats
    const team_stats = await db('league_team_seasonlogs')
      .where({ lid: league_id, year })
      .whereIn(
        'tid',
        teams.map((t) => t.uid)
      )

    for (const stats of team_stats) {
      team_stats_by_tid[stats.tid] = stats
    }
  }

  // Load remaining regular season matchups
  const remaining_matchups = await db('matchups')
    .where({ lid: league_id, year })
    .where('week', '>=', current_week)
    .where('week', '<=', regular_season_final_week)

  if (remaining_matchups.length === 0) {
    log('No remaining matchups - season complete')
    return build_post_season_forecast({
      league_id,
      year,
      teams,
      team_stats_by_tid
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

  for (const sim_week of weeks) {
    log(`Computing win probabilities for week ${sim_week}`)
    try {
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
          home_team_id: matchup.home_team_id,
          away_team_id: matchup.away_team_id,
          home_win_prob: matchup.home_win_probability,
          away_win_prob: matchup.away_win_probability
        })
      }
      week_probabilities.set(sim_week, probs)
    } catch (err) {
      log(`Error computing week ${sim_week} probabilities: ${err.message}`)
      // Use 50/50 as fallback
      const probs = new Map()
      for (const matchup of matchups_by_week[sim_week]) {
        probs.set(matchup.uid, {
          home_team_id: matchup.hid,
          away_team_id: matchup.aid,
          home_win_prob: 0.5,
          away_win_prob: 0.5
        })
      }
      week_probabilities.set(sim_week, probs)
    }
  }

  // Initialize result trackers
  const result = {}
  for (const team of teams) {
    result[team.uid] = {
      tid: team.uid,
      div: team.div,
      playoff_appearances: 0,
      division_wins: 0,
      byes: 0,
      championship_wins: 0
    }
  }

  // Run Monte Carlo simulations
  log(`Running ${n_simulations} Monte Carlo simulations`)

  for (let sim = 0; sim < n_simulations; sim++) {
    // Initialize standings with current stats
    const standings = {}
    for (const team of teams) {
      const stats = team_stats_by_tid[team.uid] || {
        wins: 0,
        losses: 0,
        ties: 0,
        pf: 0,
        apWins: 0,
        apLosses: 0,
        apTies: 0
      }
      standings[team.uid] = {
        tid: team.uid,
        div: team.div,
        wins: stats.wins || 0,
        losses: stats.losses || 0,
        ties: stats.ties || 0,
        pf: stats.pf || 0,
        apWins: stats.apWins || 0,
        apLosses: stats.apLosses || 0,
        apTies: stats.apTies || 0
      }
    }

    // Simulate remaining weeks
    let is_first_matchup = true
    for (const sim_week of weeks) {
      const week_matchups = matchups_by_week[sim_week]
      const probs = week_probabilities.get(sim_week)

      for (const matchup of week_matchups) {
        const prob_data = probs.get(matchup.uid)
        if (!prob_data) continue

        let home_wins = false

        // Handle force win/loss for first matchup
        if (is_first_matchup && (force_win_tid || force_loss_tid)) {
          if (force_win_tid) {
            home_wins = matchup.hid === Number(force_win_tid)
          } else if (force_loss_tid) {
            home_wins = matchup.hid !== Number(force_loss_tid)
          }
          is_first_matchup = false
        } else {
          // Use pre-computed probabilities
          home_wins = Math.random() < prob_data.home_win_prob
        }

        if (home_wins) {
          standings[matchup.hid].wins++
          standings[matchup.aid].losses++
        } else {
          standings[matchup.aid].wins++
          standings[matchup.hid].losses++
        }
      }
    }

    // Determine playoff seedings
    const playoff_result = determine_playoffs({
      standings,
      teams
    })

    // Record results
    for (const tid of playoff_result.playoff_tids) {
      result[tid].playoff_appearances++
    }
    for (const tid of playoff_result.bye_tids) {
      result[tid].division_wins++
      result[tid].byes++
    }

    // Simulate playoffs
    const champion_tid = simulate_playoffs({
      playoff_tids: playoff_result.playoff_tids,
      bye_tids: playoff_result.bye_tids,
      wildcard_tids: playoff_result.wildcard_tids
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
 * Determine playoff seedings from standings.
 */
function determine_playoffs({ standings, teams }) {
  // Group by division
  const divisions = groupBy(Object.values(standings), 'div')

  const bye_tids = []
  const division_wildcard_tids = []

  for (const div_teams of Object.values(divisions)) {
    // Sort by wins, then ties, then points for
    const sorted = div_teams.sort(
      (a, b) => b.wins - a.wins || b.ties - a.ties || b.pf - a.pf
    )

    // Top 2 are division leaders, sorted by all-play record
    const leaders = sorted.slice(0, 2).sort((a, b) => b.apWins - a.apWins)
    bye_tids.push(leaders[0].tid)
    division_wildcard_tids.push(leaders[1].tid)
  }

  // Wildcard: top 2 non-division winners by points for
  const division_winner_tids = [...bye_tids, ...division_wildcard_tids]
  const wildcard_candidates = Object.values(standings)
    .filter((t) => !division_winner_tids.includes(t.tid))
    .sort((a, b) => b.pf - a.pf)

  const wildcard_tids = wildcard_candidates.slice(0, 2).map((t) => t.tid)

  // All playoff teams
  const playoff_tids = [
    ...bye_tids,
    ...division_wildcard_tids,
    ...wildcard_tids
  ]

  return { playoff_tids, bye_tids, wildcard_tids }
}

/**
 * Simulate playoff rounds.
 * Uses simplified probability-based simulation.
 */
function simulate_playoffs({ playoff_tids, bye_tids, wildcard_tids }) {
  // All non-bye teams compete in wildcard round
  const wildcard_competitors = playoff_tids.filter(
    (tid) => !bye_tids.includes(tid)
  )

  // Simulate wildcard round - top 2 advance
  const wildcard_scores = wildcard_competitors.map((tid) => ({
    tid,
    score: Math.random()
  }))
  wildcard_scores.sort((a, b) => b.score - a.score)
  const wildcard_winners = wildcard_scores.slice(0, 2).map((s) => s.tid)

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
  team_stats_by_tid
}) {
  // Load playoff data
  const playoffs = await db('playoffs').where({ lid: league_id, year })

  const result = {}
  for (const team of teams) {
    const stats = team_stats_by_tid[team.uid]
    const is_playoff_team = playoffs.some((p) => p.tid === team.uid)
    const is_division_winner = stats?.regular_season_finish <= 2

    result[team.uid] = {
      tid: team.uid,
      playoff_odds: is_playoff_team ? 1.0 : 0.0,
      division_odds: is_division_winner ? 1.0 : 0.0,
      bye_odds: is_division_winner ? 1.0 : 0.0,
      championship_odds: 0 // Would need playoff simulation
    }
  }

  return result
}
