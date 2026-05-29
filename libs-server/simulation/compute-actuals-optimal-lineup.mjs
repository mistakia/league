/**
 * Compute optimal starting lineups using realized (actual) weekly fantasy points.
 *
 * Sibling of calculate-optimal-lineup.mjs, which sources points from
 * scoring_format_player_projection_points (forward-looking projections,
 * unsuitable for historical attribution). This helper instead reads
 * scoring_format_player_gamelogs for the actual points scored in the week.
 *
 * The LP solver (optimizeStandingsLineup) is reused unchanged; only the
 * point-source layer differs.
 */

import debug from 'debug'

import db from '#db'
import { active_roster_slots } from '#constants'
import { optimizeStandingsLineup } from '#libs-shared'

const log = debug('simulation:compute-actuals-optimal-lineup')

/**
 * Compute the optimal starting lineup for a team in a given week using
 * realized fantasy points.
 *
 * @param {Object} params
 * @param {number} params.lid - League ID
 * @param {number} params.tid - Fantasy team ID
 * @param {number} params.week - NFL week
 * @param {number} params.year - NFL year
 * @param {Object} params.league_format_record - Full league_formats row.
 *   Required by getOptimizerPositionConstraints (slot counts) and to
 *   resolve the scoring_format_id that keys scoring_format_player_gamelogs.
 * @returns {Promise<{starter_pids: string[], total_points: number}>}
 */
export async function compute_actuals_optimal_lineup({
  lid,
  tid,
  week,
  year,
  league_format_record
}) {
  const { scoring_format_id } = league_format_record

  const roster_rows = await db('rosters_players')
    .where({ lid, tid, week, year })
    .whereIn('slot', active_roster_slots)
    .select('pid', 'pos')

  if (roster_rows.length === 0) {
    return { starter_pids: [], total_points: 0 }
  }

  const roster_pids = roster_rows.map((r) => r.pid)

  const points_rows = await db('scoring_format_player_gamelogs as g')
    .join('nfl_games as n', 'n.esbid', 'g.esbid')
    .where('g.scoring_format_id', scoring_format_id)
    .where('n.year', year)
    .where('n.week', week)
    .whereIn('g.pid', roster_pids)
    .select('g.pid', 'g.points')

  const points_by_pid = new Map(points_rows.map((r) => [r.pid, r.points]))

  const players = []
  for (const row of roster_rows) {
    const points = points_by_pid.get(row.pid)
    if (row.pos == null || points == null) continue
    players.push({ pid: row.pid, pos: row.pos, points: Number(points) })
  }

  if (players.length === 0) {
    return { starter_pids: [], total_points: 0 }
  }

  const result = optimizeStandingsLineup({
    players,
    league: league_format_record
  })

  log(
    `team ${tid} week ${week}/${year}: ${result.starters.length} starters, ${(result.total || 0).toFixed(1)} pts`
  )

  return {
    starter_pids: result.starters,
    total_points: result.total || 0
  }
}

/**
 * Compute optimal lineups for multiple teams in a given week.
 *
 * @param {Object} params
 * @param {number} params.lid
 * @param {number[]} params.team_ids
 * @param {number} params.week
 * @param {number} params.year
 * @param {Object} params.league_format_record
 * @returns {Promise<Map<number, string[]>>} Map of tid -> starter_pids
 */
export async function compute_actuals_optimal_lineups_for_teams({
  lid,
  team_ids,
  week,
  year,
  league_format_record
}) {
  const lineups = new Map()
  for (const tid of team_ids) {
    const { starter_pids } = await compute_actuals_optimal_lineup({
      lid,
      tid,
      week,
      year,
      league_format_record
    })
    if (starter_pids.length > 0) {
      lineups.set(tid, starter_pids)
    }
  }
  return lineups
}
