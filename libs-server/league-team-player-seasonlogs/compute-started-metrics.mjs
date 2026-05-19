/**
 * Compute weeks_started and pts_added_{earned,net}_started per (tid, pid)
 * for a given (lid, year, league_format_hash) slice.
 */

import db from '#db'
import { starting_lineup_slots } from '#constants'

export default async function compute_started_metrics({
  lid,
  year,
  league_format_hash
}) {
  const weeks_rows = await db('rosters_players')
    .where({ lid, year })
    .whereIn('slot', starting_lineup_slots)
    .countDistinct({ weeks: 'week' })
    .select('tid', 'pid')
    .groupBy('tid', 'pid')

  const pts_rows = await db('league_format_player_gamelogs as g')
    .join('nfl_games as n', 'n.esbid', 'g.esbid')
    .join('rosters_players as r', function () {
      this.on('r.pid', '=', 'g.pid')
        .andOn('r.year', '=', 'n.year')
        .andOn('r.week', '=', 'n.week')
    })
    .where('r.lid', lid)
    .where('n.year', year)
    .where('g.league_format_hash', league_format_hash)
    .whereIn('r.slot', starting_lineup_slots)
    .groupBy('r.tid', 'g.pid')
    .select('r.tid', 'g.pid')
    .sum({ pts_added_earned: 'g.points_added_earned' })
    .sum({ pts_added_net: 'g.points_added_net' })

  const out = new Map()
  const key = (tid, pid) => `${tid}__${pid}`
  for (const r of weeks_rows) {
    out.set(key(r.tid, r.pid), {
      weeks_started: Number(r.weeks),
      pts_added_earned_started: null,
      pts_added_net_started: null
    })
  }
  for (const r of pts_rows) {
    const k = key(r.tid, r.pid)
    const existing = out.get(k) || {
      weeks_started: 0,
      pts_added_earned_started: null,
      pts_added_net_started: null
    }
    existing.pts_added_earned_started =
      r.pts_added_earned == null ? null : Number(r.pts_added_earned)
    existing.pts_added_net_started =
      r.pts_added_net == null ? null : Number(r.pts_added_net)
    out.set(k, existing)
  }
  return out
}
