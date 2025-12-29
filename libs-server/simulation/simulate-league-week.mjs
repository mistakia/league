/**
 * League-wide simulation orchestrator.
 * Simulates all fantasy matchups for a league in a given week.
 */

import debug from 'debug'

import db from '#db'
import { current_season } from '#constants'

import {
  load_player_variance,
  load_player_archetypes,
  load_player_info,
  load_player_projections,
  load_player_projection_stats,
  load_actual_player_points,
  load_scoring_format
} from './load-simulation-data.mjs'
import { merge_player_projections } from './merge-player-projections.mjs'
import { load_correlations_for_players } from './load-correlations.mjs'
import { load_nfl_schedule } from './load-nfl-schedule.mjs'
import { load_position_ranks } from './calculate-position-ranks.mjs'
import { simulate_nfl_game_with_raw_scores } from './simulate-nfl-game.mjs'
import { load_all_teams_starters } from './load-team-rosters.mjs'
import {
  load_simulation_context,
  map_players_to_nfl_games,
  build_game_schedule,
  load_league_matchups,
  calculate_matchup_outcomes,
  calculate_score_stats
} from './simulation-helpers.mjs'
import { load_market_projections } from './load-market-projections.mjs'
import { load_game_environment } from './load-game-environment.mjs'
import { load_player_game_outcome_correlations } from './load-player-game-outcome-correlations.mjs'
import { load_position_game_outcome_defaults } from './load-position-game-outcome-defaults.mjs'

const log = debug('simulation:simulate-league-week')

/**
 * Simulate all fantasy matchups for a league in a given week.
 *
 * @param {Object} params
 * @param {number} params.league_id - League ID
 * @param {number} params.week - NFL week
 * @param {number} params.year - NFL year
 * @param {number} [params.n_simulations=10000] - Number of simulations
 * @param {number} [params.seed] - Optional seed for reproducibility
 * @param {boolean} [params.use_actual_results=true] - Use actual points for completed games
 * @returns {Promise<Object>} League-wide simulation results
 */
export async function simulate_league_week({
  league_id,
  week,
  year,
  n_simulations = 10000,
  seed,
  use_actual_results = true
}) {
  const start_time = Date.now()
  log(
    `Starting league-wide simulation: league ${league_id}, week ${week}, year ${year}`
  )

  // Load league and scoring format
  const { scoring_format_hash } = await load_simulation_context({
    league_id,
    year
  })

  // Load scoring format settings for market projection calculation
  const league_settings = await load_scoring_format({ scoring_format_hash })

  // Load matchups and rosters in parallel
  // Rosters use unified loader: actual starters for current/past weeks,
  // optimal lineup for future weeks
  const [matchups, rosters, schedule] = await Promise.all([
    load_league_matchups({ league_id, week, year }),
    load_all_teams_starters({
      league_id,
      week,
      year,
      current_week: current_season.week
    }),
    load_nfl_schedule({ year, week })
  ])

  if (matchups.length === 0) {
    throw new Error(`No matchups found for league ${league_id}, week ${week}`)
  }

  // Collect all player IDs from all rosters
  const all_player_ids = new Set()
  for (const [, roster] of rosters) {
    for (const pid of roster.player_ids) {
      all_player_ids.add(pid)
    }
  }

  const player_ids_array = [...all_player_ids]
  log(`Total unique players: ${player_ids_array.length}`)

  // Load all player data in parallel (including market projections and game data)
  const [
    player_info,
    traditional_projections,
    market_projections,
    traditional_stats,
    game_environment,
    variance_cache,
    position_ranks,
    correlation_cache,
    archetypes,
    game_outcome_correlations,
    position_game_defaults
  ] = await Promise.all([
    load_player_info({ player_ids: player_ids_array }),
    load_player_projections({
      player_ids: player_ids_array,
      week,
      year,
      scoring_format_hash
    }),
    load_market_projections({
      player_ids: player_ids_array,
      week,
      year,
      league: league_settings
    }),
    load_player_projection_stats({
      player_ids: player_ids_array,
      week,
      year
    }),
    load_game_environment({
      week,
      year
    }),
    load_player_variance({
      player_ids: player_ids_array,
      year: year - 1,
      scoring_format_hash
    }),
    load_position_ranks({
      player_ids: player_ids_array,
      year,
      week: Math.max(1, week - 1)
    }),
    load_correlations_for_players({
      player_ids: player_ids_array,
      year: year - 1
    }),
    load_player_archetypes({
      player_ids: player_ids_array,
      year: year - 1
    }),
    // NOTE: Game outcome correlation loaders use current year (not year - 1) because
    // they have built-in fallback logic that queries both current and prior year,
    // preferring current year data when available. This differs from other historical
    // loaders (variance, correlations, archetypes) which only query the exact year passed.
    load_player_game_outcome_correlations({
      player_ids: player_ids_array,
      year // Loader queries both year and year-1, prefers current year when available
    }),
    load_position_game_outcome_defaults({
      year // Loader queries both year and year-1, prefers current year when available
    })
  ])

  // Merge projections: market stats override traditional stats where available
  const { projections, market_merged_count } = merge_player_projections({
    player_ids: player_ids_array,
    traditional_projections,
    traditional_stats,
    market_projections,
    player_info,
    league_settings
  })

  log(
    `Projections: ${traditional_projections.size} traditional, ${market_projections.size} market, ${market_merged_count} merged`
  )

  // Map players to NFL games
  const { games_map, bye_player_ids } = map_players_to_nfl_games({
    player_info,
    schedule
  })

  log(
    `Players grouped into ${games_map.size} NFL games, ${bye_player_ids.length} on bye`
  )

  // Identify completed games and load actual scores
  const completed_esbids = []
  const locked_player_ids = []

  if (use_actual_results) {
    for (const [esbid, game_data] of games_map) {
      if (game_data.is_final) {
        completed_esbids.push(esbid)
        for (const player of game_data.players) {
          locked_player_ids.push(player.pid)
        }
      }
    }
  }

  const actual_points = await load_actual_player_points({
    player_ids: locked_player_ids,
    esbids: completed_esbids,
    scoring_format_hash
  })

  log(
    `Locked players: ${actual_points.size} (from ${completed_esbids.length} completed games)`
  )

  // Initialize per-player raw scores storage
  const player_raw_scores = new Map()

  // Simulate each NFL game
  let game_seed = seed
  for (const [, game_data] of games_map) {
    const game_players = game_data.players.map((p) => ({
      ...p,
      position_rank: position_ranks.get(p.pid) || p.position,
      team_id: 0 // Will be set per-roster during aggregation
    }))

    const game_schedule = build_game_schedule(game_data.players, schedule)

    const result = simulate_nfl_game_with_raw_scores({
      game_players,
      projections,
      variance_cache,
      correlation_cache,
      archetypes,
      game_schedule,
      n_simulations,
      seed: game_seed,
      locked_scores: actual_points,
      game_environment,
      game_outcome_correlations,
      position_defaults: position_game_defaults
    })

    // Merge player scores
    for (const [pid, scores] of result.player_scores) {
      player_raw_scores.set(pid, scores)
    }

    // Increment seed for next game if provided
    if (game_seed !== undefined) {
      game_seed++
    }
  }

  // Add zero scores for bye-week players
  for (const pid of bye_player_ids) {
    player_raw_scores.set(pid, new Array(n_simulations).fill(0))
  }

  // Aggregate player scores to fantasy team totals
  const team_raw_scores = new Map()
  for (const [team_id, roster] of rosters) {
    const totals = new Array(n_simulations).fill(0)

    for (const pid of roster.player_ids) {
      const player_scores = player_raw_scores.get(pid)
      if (player_scores) {
        for (let sim = 0; sim < n_simulations; sim++) {
          totals[sim] += player_scores[sim]
        }
      }
    }

    team_raw_scores.set(team_id, totals)
  }

  // Calculate matchup results
  const matchup_results = []

  for (const matchup of matchups) {
    const home_scores = team_raw_scores.get(matchup.home_team_id)
    const away_scores = team_raw_scores.get(matchup.away_team_id)

    if (!home_scores || !away_scores) {
      log(
        `Missing scores for matchup ${matchup.matchup_id}: home=${matchup.home_team_id}, away=${matchup.away_team_id}`
      )
      continue
    }

    const { home_wins, away_wins, ties } = calculate_matchup_outcomes({
      home_scores,
      away_scores,
      n_simulations
    })

    const home_stats = calculate_score_stats(home_scores)
    const away_stats = calculate_score_stats(away_scores)

    matchup_results.push({
      matchup_id: matchup.matchup_id,
      home_team_id: matchup.home_team_id,
      away_team_id: matchup.away_team_id,
      home_win_probability: home_wins / n_simulations,
      away_win_probability: away_wins / n_simulations,
      tie_probability: ties / n_simulations,
      home_expected_score: home_stats.mean,
      away_expected_score: away_stats.mean,
      home_score_std: home_stats.std,
      away_score_std: away_stats.std
    })
  }

  const elapsed_ms = Date.now() - start_time
  log(`League-wide simulation completed in ${elapsed_ms}ms`)

  return {
    league_id,
    week,
    year,
    n_simulations,
    elapsed_ms,
    matchups: matchup_results,
    team_count: rosters.size,
    player_count: player_ids_array.length,
    nfl_games_simulated: games_map.size,
    locked_games: completed_esbids.length,
    bye_players: bye_player_ids.length,
    // Market data stats
    market_projections_used: market_merged_count,
    traditional_projections_used:
      traditional_projections.size - market_merged_count,
    game_environment_loaded: game_environment.size,
    game_outcome_correlations_loaded: game_outcome_correlations.size,
    position_defaults_loaded: position_game_defaults.size
  }
}

/**
 * Save simulation results to the matchups table.
 *
 * @param {Object[]} matchup_results - Array of matchup simulation results
 * @returns {Promise<number>} Number of matchups updated
 */
export async function save_matchup_probabilities(matchup_results) {
  log(`Saving probabilities for ${matchup_results.length} matchups`)

  let updated = 0
  for (const result of matchup_results) {
    await db('matchups').where('uid', result.matchup_id).update({
      home_win_probability: result.home_win_probability,
      away_win_probability: result.away_win_probability,
      simulation_timestamp: new Date()
    })
    updated++
  }

  log(`Updated ${updated} matchups with simulation probabilities`)
  return updated
}
