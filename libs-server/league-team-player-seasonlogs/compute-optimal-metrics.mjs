/**
 * Compute pts_added_{earned,net}_optimal per (tid, pid) for a given
 * (lid, year, league_format_hash) slice using an actuals-based LP solve.
 *
 * For each fantasy week in the season, the actuals optimal lineup is
 * computed per team. A player is credited for the week iff their pid is
 * in that team's starter_pids. Credit is the corresponding row in
 * league_format_player_gamelogs JOIN nfl_games for the matched (pid, week).
 */

import db from '#db'
import { fantasy_weeks } from '#constants'

import { compute_actuals_optimal_lineups_for_teams } from '#libs-server/simulation/compute-actuals-optimal-lineup.mjs'

export default async function compute_optimal_metrics({
  lid,
  year,
  league_format_hash,
  league_format_record
}) {
  const team_rows = await db('teams').where({ lid, year }).select('uid')
  const team_ids = team_rows.map((t) => t.uid)
  if (team_ids.length === 0) return new Map()

  const gamelog_rows = await db('league_format_player_gamelogs as g')
    .join('nfl_games as n', 'n.esbid', 'g.esbid')
    .where('n.year', year)
    .where('g.league_format_hash', league_format_hash)
    .select('g.pid', 'n.week', 'g.points_added_earned', 'g.points_added_net')

  const gamelog_by_pid_week = new Map()
  for (const r of gamelog_rows) {
    gamelog_by_pid_week.set(`${r.pid}__${r.week}`, r)
  }

  const out = new Map()
  const key = (tid, pid) => `${tid}__${pid}`

  for (const week of fantasy_weeks) {
    const lineups = await compute_actuals_optimal_lineups_for_teams({
      lid,
      team_ids,
      week,
      year,
      league_format_record
    })
    for (const [tid, starter_pids] of lineups) {
      for (const pid of starter_pids) {
        const gl = gamelog_by_pid_week.get(`${pid}__${week}`)
        if (!gl) continue
        const k = key(tid, pid)
        const existing = out.get(k) || {
          pts_added_earned_optimal: null,
          pts_added_net_optimal: null
        }
        if (gl.points_added_earned != null) {
          existing.pts_added_earned_optimal =
            (existing.pts_added_earned_optimal || 0) +
            Number(gl.points_added_earned)
        }
        if (gl.points_added_net != null) {
          existing.pts_added_net_optimal =
            (existing.pts_added_net_optimal || 0) + Number(gl.points_added_net)
        }
        out.set(k, existing)
      }
    }
  }
  return out
}
