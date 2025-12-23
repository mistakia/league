/**
 * Calculate optimal lineups for fantasy teams.
 * Loads full team rosters and uses LP solver to find optimal starting lineup.
 */

import debug from 'debug'

import db from '#db'
import { active_roster_slots, current_season } from '#constants'
import { optimizeStandingsLineup } from '#libs-shared'

import {
  load_player_projections,
  load_player_info
} from './load-simulation-data.mjs'
import { load_simulation_context } from './simulation-helpers.mjs'

const log = debug('simulation:calculate-optimal-lineup')

/**
 * Load all rostered players for a team (active roster only, not practice squad/IR).
 * Falls back to fallback_week if no roster data exists for the requested week.
 *
 * @param {Object} params
 * @param {number} params.league_id - League ID
 * @param {number} params.team_id - Fantasy team ID
 * @param {number} params.week - NFL week
 * @param {number} params.year - NFL year
 * @param {number} [params.fallback_week] - Week to use if no roster exists for requested week
 * @returns {Promise<string[]>} Array of player IDs on active roster
 */
export async function load_full_team_roster({
  league_id,
  team_id,
  week,
  year,
  fallback_week
}) {
  log(`Loading full roster for team ${team_id}, week ${week}`)

  let roster_players = await db('rosters_players')
    .where({
      lid: league_id,
      tid: team_id,
      week,
      year
    })
    .whereIn('slot', active_roster_slots)
    .select('pid')

  // Fall back to fallback_week if no roster found
  if (roster_players.length === 0 && fallback_week && fallback_week !== week) {
    log(
      `No roster found for week ${week}, falling back to week ${fallback_week}`
    )
    roster_players = await db('rosters_players')
      .where({
        lid: league_id,
        tid: team_id,
        week: fallback_week,
        year
      })
      .whereIn('slot', active_roster_slots)
      .select('pid')
  }

  const player_ids = roster_players.map((r) => r.pid)
  log(`Loaded ${player_ids.length} players for team ${team_id}`)

  return player_ids
}

/**
 * Calculate optimal starting lineup for a team in a given week.
 *
 * @param {Object} params
 * @param {number} params.league_id - League ID
 * @param {number} params.team_id - Fantasy team ID
 * @param {number} params.week - NFL week
 * @param {number} params.year - NFL year
 * @returns {Promise<Object>} { starter_pids, total_points, all_roster_pids }
 */
export async function calculate_optimal_lineup({
  league_id,
  team_id,
  week,
  year
}) {
  log(`Calculating optimal lineup for team ${team_id}, week ${week}`)

  // Load league context for scoring format
  const { league, scoring_format_hash } = await load_simulation_context({
    league_id,
    year
  })

  // Load full roster (fall back to current week if no roster exists for future weeks)
  const all_roster_pids = await load_full_team_roster({
    league_id,
    team_id,
    week,
    year,
    fallback_week: current_season.week
  })

  if (all_roster_pids.length === 0) {
    log(`No roster players found for team ${team_id}`)
    return { starter_pids: [], total_points: 0, all_roster_pids: [] }
  }

  // Load projections and player info in parallel
  const [projections, player_info] = await Promise.all([
    load_player_projections({
      player_ids: all_roster_pids,
      week,
      year,
      scoring_format_hash
    }),
    load_player_info({ player_ids: all_roster_pids })
  ])

  // Build player objects for optimizer
  const players = []
  for (const pid of all_roster_pids) {
    const info = player_info.get(pid)
    const pos = info?.position
    const points = projections.get(pid) || 0

    if (!pos) {
      log(`No position found for player ${pid}, skipping`)
      continue
    }

    players.push({ pid, pos, points })
  }

  if (players.length === 0) {
    log(`No valid players for optimization`)
    return { starter_pids: [], total_points: 0, all_roster_pids }
  }

  // Run optimizer
  const result = optimizeStandingsLineup({ players, league })

  log(
    `Optimal lineup for team ${team_id}: ${result.starters.length} starters, ${result.total?.toFixed(1)} points`
  )

  return {
    starter_pids: result.starters,
    total_points: result.total || 0,
    all_roster_pids
  }
}

/**
 * Calculate optimal lineups for multiple teams in a given week.
 *
 * @param {Object} params
 * @param {number} params.league_id - League ID
 * @param {number[]} params.team_ids - Array of fantasy team IDs
 * @param {number} params.week - NFL week
 * @param {number} params.year - NFL year
 * @returns {Promise<Map<number, string[]>>} Map of team_id -> starter_pids
 */
export async function calculate_optimal_lineups_for_teams({
  league_id,
  team_ids,
  week,
  year
}) {
  log(`Calculating optimal lineups for ${team_ids.length} teams, week ${week}`)

  const optimal_lineups = new Map()

  for (const team_id of team_ids) {
    const result = await calculate_optimal_lineup({
      league_id,
      team_id,
      week,
      year
    })

    if (result.starter_pids.length > 0) {
      optimal_lineups.set(team_id, result.starter_pids)
    }
  }

  log(`Calculated optimal lineups for ${optimal_lineups.size} teams`)
  return optimal_lineups
}
