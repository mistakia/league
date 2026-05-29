/**
 * Compute weeks-count and pts_added_{earned,net} per (tid, pid) for a given
 * (lid, year, league_format_id) slice, parameterized by which roster slot
 * family to count.
 *
 * Used for both the rostered lens (`active_roster_slots`, suffix `rostered`)
 * and the started lens (`starting_lineup_slots`, suffix `started`).
 */

import db from '#db'

export default async function compute_roster_slot_metrics({
  lid,
  year,
  league_format_id,
  slots,
  suffix
}) {
  const weeks_key = `weeks_${suffix}`
  const earned_key = `pts_added_earned_${suffix}`
  const net_key = `pts_added_net_${suffix}`

  const weeks_rows = await db('rosters_players')
    .where({ lid, year })
    .whereIn('slot', slots)
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
    .where('g.league_format_id', league_format_id)
    .whereIn('r.slot', slots)
    .groupBy('r.tid', 'g.pid')
    .select('r.tid', 'g.pid')
    .sum({ pts_added_earned: 'g.points_added_earned' })
    .sum({ pts_added_net: 'g.points_added_net' })

  const out = new Map()
  const key = (tid, pid) => `${tid}__${pid}`
  for (const r of weeks_rows) {
    out.set(key(r.tid, r.pid), {
      [weeks_key]: Number(r.weeks),
      [earned_key]: null,
      [net_key]: null
    })
  }
  for (const r of pts_rows) {
    const k = key(r.tid, r.pid)
    const existing = out.get(k) || {
      [weeks_key]: 0,
      [earned_key]: null,
      [net_key]: null
    }
    existing[earned_key] =
      r.pts_added_earned == null ? null : Number(r.pts_added_earned)
    existing[net_key] = r.pts_added_net == null ? null : Number(r.pts_added_net)
    out.set(k, existing)
  }
  return out
}
