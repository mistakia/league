/**
 * Season forecasting using player-level correlation simulation.
 * Calculates playoff odds, division odds, bye odds, and championship odds.
 */

import debug from 'debug'

import db from '#db'
import { current_season } from '#constants'
import { groupBy, simulation } from '#libs-shared'

import { simulate_league_week } from './simulate-league-week.mjs'
import {
  load_simulation_context,
  load_all_league_rosters,
  build_simulation_players
} from './simulation-helpers.mjs'
import {
  load_player_projections,
  load_player_projection_stats,
  load_player_variance,
  load_player_info,
  load_actual_player_points,
  load_player_archetypes,
  load_scoring_format,
  merge_market_stats_with_traditional
} from './load-simulation-data.mjs'
import { load_nfl_schedules_for_weeks } from './load-nfl-schedule.mjs'
import { load_correlations_for_players } from './load-correlations.mjs'
import { load_position_ranks } from './calculate-position-ranks.mjs'
import { load_market_projections } from './load-market-projections.mjs'
import { load_game_environment } from './load-game-environment.mjs'
import { load_player_game_outcome_correlations } from './load-player-game-outcome-correlations.mjs'
import { load_position_game_outcome_defaults } from './load-position-game-outcome-defaults.mjs'

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
async function simulate_playoff_weeks_correlated({
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
    const locked_player_ids = []
    const pending_player_ids = []
    const completed_esbids = new Set()

    for (const pid of week_player_ids) {
      const info = player_info.get(pid)
      const game = schedule[info?.nfl_team]

      if (game?.is_final) {
        locked_player_ids.push(pid)
        completed_esbids.add(game.esbid)
      } else {
        pending_player_ids.push(pid)
      }
    }

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

    // Merge projections at stat level: market stats override traditional stats
    const projections = new Map()
    for (const pid of pending_player_ids) {
      const trad_stats = traditional_stats.get(pid)
      const market_data = market_projections.get(pid)
      const info = player_info.get(pid)
      const position = info?.position || ''

      const merge_result = merge_market_stats_with_traditional({
        traditional_stats: trad_stats,
        market_data,
        position,
        league_settings
      })

      if (merge_result) {
        projections.set(pid, merge_result.points)
      } else {
        // Fall back to pre-calculated traditional projection if available
        const trad_points = traditional_projections.get(pid)
        if (trad_points !== undefined) {
          projections.set(pid, trad_points)
        }
      }
    }

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

  // Get playoff teams
  const team_stats = await db('league_team_seasonlogs')
    .where({ lid: league_id, year })
    .whereIn('regular_season_finish', [1, 2, 3, 4, 5, 6])

  if (team_stats.length !== 6) {
    throw new Error(`Expected 6 playoff teams, found ${team_stats.length}`)
  }

  const bye_tids = team_stats
    .filter((t) => [1, 2].includes(t.regular_season_finish))
    .map((t) => t.tid)

  const wildcard_tids = team_stats
    .filter((t) => [3, 4, 5, 6].includes(t.regular_season_finish))
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
    const wildcard_winners = wildcard_results.slice(0, 2).map((r) => r.tid)

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
      wildcard_winners = wildcard_results.slice(0, 2).map((r) => r.tid)
    } else {
      // Determine wildcard winners from simulated week 15 scores
      const wildcard_results = wildcard_tids
        .map((tid) => ({ tid, score: wildcard_raw_scores.get(tid)[sim] }))
        .sort((a, b) => b.score - a.score)
      wildcard_winners = wildcard_results.slice(0, 2).map((r) => r.tid)
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
 * Load actual playoff points from the playoffs table.
 * Returns a map of tid -> points for weeks that have actual results.
 *
 * @param {Object} params
 * @param {number} params.league_id - League ID
 * @param {number[]} params.team_ids - Team IDs to load
 * @param {number[]} params.weeks - Weeks to check
 * @param {number} params.year - NFL year
 * @returns {Promise<Object>} { actual_points: Map<week, Map<tid, points>>, weeks_with_results: number[] }
 */
async function load_actual_playoff_points({
  league_id,
  team_ids,
  weeks,
  year
}) {
  const playoff_entries = await db('playoffs')
    .where({ lid: league_id, year })
    .whereIn('week', weeks)
    .whereIn('tid', team_ids)
    .whereNotNull('points')

  const actual_points = new Map()
  const weeks_with_results = new Set()

  for (const entry of playoff_entries) {
    const points = parseFloat(entry.points)
    // Only count as having results if points > 0 (game actually played)
    if (points > 0) {
      if (!actual_points.has(entry.week)) {
        actual_points.set(entry.week, new Map())
      }
      actual_points.get(entry.week).set(entry.tid, points)
      weeks_with_results.add(entry.week)
    }
  }

  return {
    actual_points,
    weeks_with_results: [...weeks_with_results].sort((a, b) => a - b)
  }
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

  if (championship_tids.length !== 4) {
    throw new Error(
      `Expected 4 championship teams, found ${championship_tids.length}`
    )
  }

  // Get all teams for result
  const all_teams = await db('teams').where({ lid: league_id, year })
  const all_playoff_tids = [
    ...new Set(
      (await db('playoffs').where({ lid: league_id, year })).map((p) => p.tid)
    )
  ]

  // Load team stats for division winner determination
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
    const is_division_winner = [1, 2].includes(
      team_stats?.regular_season_finish
    )

    result[team.uid] = {
      tid: team.uid,
      playoff_odds: all_playoff_tids.includes(team.uid) ? 1.0 : 0.0,
      division_odds: is_division_winner ? 1.0 : 0.0,
      bye_odds: is_division_winner ? 1.0 : 0.0,
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
