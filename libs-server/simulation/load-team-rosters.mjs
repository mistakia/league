/**
 * Unified roster loading for simulations.
 *
 * This module provides a clean interface for loading team rosters:
 * - Current/past weeks: Uses actual roster slot assignments from rosters_players
 * - Future weeks: Computes optimal lineup from current roster pool using projections
 *
 * This replaces the previous approach that relied on pre-computed league_team_lineup_starters,
 * which was stale and didn't reflect actual roster decisions.
 */

import debug from 'debug'

import db from '#db'
import {
  starting_lineup_slots,
  active_roster_slots,
  current_season
} from '#constants'
import { optimizeStandingsLineup } from '#libs-shared'

import {
  load_player_projections,
  load_player_info
} from './load-simulation-data.mjs'
import { load_simulation_context } from './simulation-helpers.mjs'

const log = debug('simulation:load-team-rosters')

/**
 * Load starters for a single team.
 *
 * For current/past weeks: Returns actual starters from roster slot assignments.
 * For future weeks: Computes optimal lineup from current roster pool.
 *
 * @param {Object} params
 * @param {number} params.league_id - League ID
 * @param {number} params.team_id - Fantasy team ID
 * @param {number} params.week - Target week to get starters for
 * @param {number} params.year - NFL year
 * @param {number} params.current_week - The actual current week (for determining actual vs optimal)
 * @param {string} params.scoring_format_hash - Scoring format hash for projections
 * @param {Object} params.league - League settings for optimizer constraints
 * @returns {Promise<Object>} { team_id, player_ids: string[] }
 */
export async function load_team_starters({
  league_id,
  team_id,
  week,
  year,
  current_week,
  scoring_format_hash,
  league
}) {
  // Validate current_week to prevent undefined comparison issues
  if (typeof current_week !== 'number' || current_week < 1) {
    throw new Error(
      `current_week must be a positive integer, got: ${current_week}`
    )
  }

  if (week <= current_week) {
    // Current/past week: use actual roster slot assignments
    const player_ids = await load_actual_starters({
      league_id,
      team_id,
      week,
      year
    })
    return { team_id, player_ids }
  } else {
    // Future week: compute optimal from current roster pool
    const player_ids = await calculate_optimal_starters({
      league_id,
      team_id,
      roster_week: current_week,
      projection_week: week,
      year,
      scoring_format_hash,
      league
    })
    return { team_id, player_ids }
  }
}

/**
 * Load starters for multiple teams in a single week.
 *
 * Returns an Array (not a Map) since the caller provides specific team_ids
 * and typically processes all results. Use load_all_teams_starters() if you
 * need a Map keyed by team_id for lookups.
 *
 * @param {Object} params
 * @param {number} params.league_id - League ID
 * @param {number[]} params.team_ids - Array of fantasy team IDs
 * @param {number} params.week - Target week to get starters for
 * @param {number} params.year - NFL year
 * @param {number} [params.current_week] - Current week (defaults to current_season.week)
 * @returns {Promise<Array<{team_id: number, player_ids: string[]}>>} Array of team rosters
 */
export async function load_teams_starters({
  league_id,
  team_ids,
  week,
  year,
  current_week = current_season.week
}) {
  log(`Loading starters for ${team_ids.length} teams, week ${week}`)

  // Load league context for scoring format and optimizer constraints
  const { league, scoring_format_hash } = await load_simulation_context({
    league_id,
    year
  })

  // Load all teams in parallel for better performance
  const all_results = await Promise.all(
    team_ids.map((team_id) =>
      load_team_starters({
        league_id,
        team_id,
        week,
        year,
        current_week,
        scoring_format_hash,
        league
      })
    )
  )

  // Filter to teams with starters and log any missing
  const results = []
  for (const result of all_results) {
    if (result.player_ids.length > 0) {
      results.push(result)
    } else {
      log(`No starters found for team ${result.team_id}, week ${week}`)
    }
  }

  log(`Loaded starters for ${results.length} teams`)
  return results
}

/**
 * Load starters for all teams in a league for a single week.
 *
 * Returns a Map keyed by team_id for efficient lookups when processing
 * matchups. Use load_teams_starters() if you have specific team_ids and
 * want an Array result.
 *
 * @param {Object} params
 * @param {number} params.league_id - League ID
 * @param {number} params.week - Target week
 * @param {number} params.year - NFL year
 * @param {number} [params.current_week] - Current week (defaults to current_season.week)
 * @returns {Promise<Map<number, {player_ids: string[]}>>} Map of team_id -> roster
 */
export async function load_all_teams_starters({
  league_id,
  week,
  year,
  current_week = current_season.week
}) {
  log(`Loading all team starters for league ${league_id}, week ${week}`)

  // Get all team IDs for the league
  const teams = await db('teams')
    .where({ lid: league_id, year })
    .select('uid as team_id')

  const team_ids = teams.map((t) => t.team_id)

  // Load league context
  const { league, scoring_format_hash } = await load_simulation_context({
    league_id,
    year
  })

  // Load all teams in parallel for better performance
  const all_results = await Promise.all(
    team_ids.map((team_id) =>
      load_team_starters({
        league_id,
        team_id,
        week,
        year,
        current_week,
        scoring_format_hash,
        league
      })
    )
  )

  // Build map from results, filtering out teams without starters
  const rosters = new Map()
  for (const result of all_results) {
    if (result.player_ids.length > 0) {
      rosters.set(result.team_id, { player_ids: result.player_ids })
    }
  }

  log(`Loaded starters for ${rosters.size} teams`)
  return rosters
}

/**
 * Load actual starters from roster slot assignments.
 * Used for current and past weeks where we have actual lineup data.
 *
 * @param {Object} params
 * @param {number} params.league_id - League ID
 * @param {number} params.team_id - Fantasy team ID
 * @param {number} params.week - NFL week
 * @param {number} params.year - NFL year
 * @returns {Promise<string[]>} Array of player IDs in starting slots
 */
async function load_actual_starters({ league_id, team_id, week, year }) {
  const roster_players = await db('rosters_players')
    .where({
      lid: league_id,
      tid: team_id,
      week,
      year
    })
    .whereIn('slot', starting_lineup_slots)
    .select('pid')

  return roster_players.map((r) => r.pid)
}

/**
 * Calculate optimal starters for a future week.
 * Uses current roster pool with projections for the target week.
 *
 * @param {Object} params
 * @param {number} params.league_id - League ID
 * @param {number} params.team_id - Fantasy team ID
 * @param {number} params.roster_week - Week to get roster pool from (usually current week)
 * @param {number} params.projection_week - Week to get projections for
 * @param {number} params.year - NFL year
 * @param {string} params.scoring_format_hash - Scoring format hash
 * @param {Object} params.league - League settings for optimizer
 * @returns {Promise<string[]>} Array of optimal starter player IDs
 */
async function calculate_optimal_starters({
  league_id,
  team_id,
  roster_week,
  projection_week,
  year,
  scoring_format_hash,
  league
}) {
  log(
    `Calculating optimal starters for team ${team_id}, roster week ${roster_week}, projection week ${projection_week}`
  )

  // Load active roster from roster_week
  const roster_players = await db('rosters_players')
    .where({
      lid: league_id,
      tid: team_id,
      week: roster_week,
      year
    })
    .whereIn('slot', active_roster_slots)
    .select('pid')

  if (roster_players.length === 0) {
    log(`No roster players found for team ${team_id}, week ${roster_week}`)
    return []
  }

  const roster_pids = roster_players.map((r) => r.pid)

  // Load projections for target week and player info in parallel
  const [projections, player_info] = await Promise.all([
    load_player_projections({
      player_ids: roster_pids,
      week: projection_week,
      year,
      scoring_format_hash
    }),
    load_player_info({ player_ids: roster_pids })
  ])

  // Build players for optimizer
  const players = []
  for (const pid of roster_pids) {
    const info = player_info.get(pid)
    const pos = info?.position

    if (!pos) {
      log(`No position found for player ${pid}, skipping`)
      continue
    }

    players.push({
      pid,
      pos,
      points: projections.get(pid) || 0
    })
  }

  if (players.length === 0) {
    log(`No valid players for optimization for team ${team_id}`)
    return []
  }

  // Run optimizer
  const result = optimizeStandingsLineup({ players, league })

  log(
    `Optimal lineup for team ${team_id}: ${result.starters.length} starters, ${result.total?.toFixed(1)} projected points`
  )

  return result.starters
}

/**
 * Load starters for multiple weeks (used by championship simulations).
 * Efficiently batches loading across weeks with parallel execution.
 *
 * Returns a Map keyed by week number, where each value is an Array of
 * team rosters for that week.
 *
 * @param {Object} params
 * @param {number} params.league_id - League ID
 * @param {number[]} params.team_ids - Array of fantasy team IDs
 * @param {number[]} params.weeks - Array of weeks to load
 * @param {number} params.year - NFL year
 * @param {number} [params.current_week] - Current week (defaults to current_season.week)
 * @returns {Promise<Map<number, Array<{team_id: number, player_ids: string[]}>>>} Map of week -> team rosters
 */
export async function load_teams_starters_by_week({
  league_id,
  team_ids,
  weeks,
  year,
  current_week = current_season.week
}) {
  log(
    `Loading starters for ${team_ids.length} teams across ${weeks.length} weeks`
  )

  // Load league context once
  const { league, scoring_format_hash } = await load_simulation_context({
    league_id,
    year
  })

  // Load all weeks in parallel, with teams parallelized within each week
  const week_results = await Promise.all(
    weeks.map(async (week) => {
      const all_results = await Promise.all(
        team_ids.map((team_id) =>
          load_team_starters({
            league_id,
            team_id,
            week,
            year,
            current_week,
            scoring_format_hash,
            league
          })
        )
      )

      // Filter to teams with starters
      const week_rosters = all_results.filter((r) => r.player_ids.length > 0)
      return { week, rosters: week_rosters }
    })
  )

  // Build map from results
  const rosters_by_week = new Map()
  for (const { week, rosters } of week_results) {
    rosters_by_week.set(week, rosters)
  }

  log(`Loaded starters across ${rosters_by_week.size} weeks`)
  return rosters_by_week
}
