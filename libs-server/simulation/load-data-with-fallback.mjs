/**
 * Consolidated data loading functions with fallback support for future weeks.
 * These functions handle the common pattern of loading data for a week,
 * falling back to a base week when data is missing.
 */

import debug from 'debug'

import db from '#db'
import { active_roster_slots } from '#constants'

import {
  load_simulation_rosters,
  load_player_projections
} from './load-simulation-data.mjs'

const log = debug('simulation:load-data-with-fallback')

/**
 * Load rosters with automatic fallback to base week when data is missing.
 * Supports per-team fallback - teams with data use their own roster,
 * teams without data use the fallback roster.
 *
 * @param {Object} params
 * @param {number} params.league_id - League ID
 * @param {number[]} params.team_ids - Array of fantasy team IDs
 * @param {number} params.week - Target NFL week
 * @param {number} params.year - NFL year
 * @param {number} [params.fallback_week] - Week to use if target week has no data
 * @returns {Promise<Object>} { rosters, week_used, used_fallback }
 */
export async function load_rosters_with_fallback({
  league_id,
  team_ids,
  week,
  year,
  fallback_week
}) {
  log(`Loading rosters for week ${week} with fallback to week ${fallback_week}`)

  // Load rosters for target week
  let rosters = await load_simulation_rosters({
    league_id,
    team_ids,
    week,
    year
  })

  const week_used = week
  let used_fallback = false

  // Check if any teams are missing
  const found_team_ids = new Set(rosters.map((r) => r.team_id))
  const missing_team_ids = team_ids.filter((tid) => !found_team_ids.has(tid))

  if (missing_team_ids.length > 0 && fallback_week) {
    log(
      `Week ${week} missing roster data for teams ${missing_team_ids.join(',')}, using fallback week ${fallback_week}`
    )

    // Load fallback rosters for missing teams
    const fallback_rosters = await load_simulation_rosters({
      league_id,
      team_ids: missing_team_ids,
      week: fallback_week,
      year
    })

    // Merge: keep original rosters for teams that had data, add fallback for missing
    rosters = [...rosters, ...fallback_rosters]
    used_fallback = true

    // If still missing teams after fallback, note which week was primarily used
    if (rosters.length < team_ids.length) {
      log(`Warning: Still missing roster data for some teams after fallback`)
    }
  } else if (missing_team_ids.length > 0) {
    log(
      `Week ${week} missing roster data for teams ${missing_team_ids.join(',')} (no fallback provided)`
    )
  }

  return {
    rosters,
    week_used,
    used_fallback
  }
}

/**
 * Load projections with automatic fallback to base week when data is missing.
 * Players with projections for target week use those; others fall back.
 *
 * @param {Object} params
 * @param {string[]} params.player_ids - Array of player IDs
 * @param {number} params.week - Target NFL week
 * @param {number} params.year - NFL year
 * @param {string} params.scoring_format_hash - Scoring format hash
 * @param {number} [params.fallback_week] - Week to use if target week has no data
 * @returns {Promise<Object>} { projections, fallback_count }
 */
export async function load_projections_with_fallback({
  player_ids,
  week,
  year,
  scoring_format_hash,
  fallback_week
}) {
  if (!player_ids.length) {
    return { projections: new Map(), fallback_count: 0 }
  }

  log(
    `Loading projections for week ${week} with fallback to week ${fallback_week}`
  )

  // Load target week projections
  const week_projections = await load_player_projections({
    player_ids,
    week,
    year,
    scoring_format_hash
  })

  // If no fallback needed or no fallback_week provided, return as-is
  if (!fallback_week || week === fallback_week) {
    return { projections: week_projections, fallback_count: 0 }
  }

  // Find players missing projections
  const missing_pids = player_ids.filter((pid) => !week_projections.has(pid))

  if (missing_pids.length === 0) {
    return { projections: week_projections, fallback_count: 0 }
  }

  // Load fallback projections for missing players
  const fallback_projections = await load_player_projections({
    player_ids: missing_pids,
    week: fallback_week,
    year,
    scoring_format_hash
  })

  // Merge projections
  const projections = new Map(week_projections)
  let fallback_count = 0

  for (const pid of missing_pids) {
    if (fallback_projections.has(pid)) {
      projections.set(pid, fallback_projections.get(pid))
      fallback_count++
    }
  }

  if (fallback_count > 0) {
    log(
      `Using ${fallback_count} fallback projections from week ${fallback_week}`
    )
  }

  return { projections, fallback_count }
}

/**
 * Load bench players with projection data, supporting fallback for future weeks.
 *
 * @param {Object} params
 * @param {number} params.league_id - League ID
 * @param {number} params.team_id - Fantasy team ID
 * @param {number} params.week - Target NFL week
 * @param {number} params.year - NFL year
 * @param {string[]} params.starter_pids - PIDs of starting players to exclude
 * @param {string} params.scoring_format_hash - Scoring format hash
 * @param {number} [params.fallback_week] - Week to use for projections if missing
 * @returns {Promise<Object[]>} Array of bench players with { pid, slot, projection }
 */
export async function load_bench_players_with_fallback({
  league_id,
  team_id,
  week,
  year,
  starter_pids,
  scoring_format_hash,
  fallback_week
}) {
  log(`Loading bench players for week ${week}`)

  // Determine which week to use for roster data
  const roster_week = fallback_week || week

  // Load all rostered players with their projections for the target week
  const roster_players = await db('rosters_players')
    .leftJoin('scoring_format_player_projection_points', function () {
      this.on(
        'rosters_players.pid',
        'scoring_format_player_projection_points.pid'
      )
        .andOn(
          db.raw('scoring_format_player_projection_points.week = ?', [
            String(week)
          ])
        )
        .andOn(
          db.raw('scoring_format_player_projection_points.year = ?', [year])
        )
        .andOn(
          db.raw(
            'scoring_format_player_projection_points.scoring_format_hash = ?',
            [scoring_format_hash]
          )
        )
    })
    .where({
      'rosters_players.lid': league_id,
      'rosters_players.tid': team_id,
      'rosters_players.week': roster_week,
      'rosters_players.year': year
    })
    .whereIn('rosters_players.slot', active_roster_slots)
    .select(
      'rosters_players.pid',
      'rosters_players.slot',
      'scoring_format_player_projection_points.total as projection'
    )

  // Filter out starters
  let bench = roster_players.filter((p) => !starter_pids.includes(p.pid))

  // If fallback_week provided, try to get projections for players missing them
  if (fallback_week && fallback_week !== week) {
    const missing_projection_pids = bench
      .filter((p) => p.projection === null || parseFloat(p.projection) <= 0)
      .map((p) => p.pid)

    if (missing_projection_pids.length > 0) {
      // Load fallback projections
      const fallback_projections = await db(
        'scoring_format_player_projection_points'
      )
        .whereIn('pid', missing_projection_pids)
        .where({
          week: String(fallback_week),
          year,
          scoring_format_hash
        })
        .select('pid', 'total as projection')

      const fallback_map = new Map()
      for (const row of fallback_projections) {
        fallback_map.set(row.pid, parseFloat(row.projection))
      }

      // Update bench players with fallback projections
      bench = bench.map((p) => {
        if (
          (p.projection === null || parseFloat(p.projection) <= 0) &&
          fallback_map.has(p.pid)
        ) {
          return { ...p, projection: fallback_map.get(p.pid) }
        }
        return p
      })

      log(
        `Used ${fallback_map.size} fallback projections for bench players from week ${fallback_week}`
      )
    }
  }

  // Filter to only bench players with valid projections
  return bench.filter(
    (p) => p.projection !== null && parseFloat(p.projection) > 0
  )
}
