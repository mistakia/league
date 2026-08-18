/**
 * Compute weeks-count and realized_points_added_{positive,net} per (tid, pid)
 * for a given
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
  // An explicit map rather than a template, because a key BUILT from the
  // suffix is a rename no grep, no column check and no consumer gate can see:
  // the pts conform renamed these two and swept the sibling lens and the
  // insert payload, leaving this file emitting pts_added_* against a consumer
  // reading realized_points_added_*. Nothing threw -- the payload still named
  // real columns, so the write succeeded with four columns silently NULL.
  const metric_keys = {
    rostered: {
      weeks: 'weeks_rostered',
      earned: 'realized_points_added_positive_rostered',
      net: 'realized_points_added_net_rostered'
    },
    started: {
      weeks: 'weeks_started',
      earned: 'realized_points_added_positive_started',
      net: 'realized_points_added_net_started'
    }
  }[suffix]

  if (!metric_keys) {
    throw new Error(`compute_roster_slot_metrics: unknown suffix '${suffix}'`)
  }

  const weeks_key = metric_keys.weeks
  const earned_key = metric_keys.earned
  const net_key = metric_keys.net

  const weeks_rows = await db('rosters_players')
    .where({ lid, season_year: year })
    .whereIn('slot', slots)
    .countDistinct({ weeks: 'week' })
    .select('tid', 'pid')
    .groupBy('tid', 'pid')

  const pts_rows = await db('league_format_player_gamelogs as g')
    .join('nfl_games as n', 'n.esbid', 'g.esbid')
    .join('rosters_players as r', function () {
      this.on('r.pid', '=', 'g.pid')
        .andOn('r.season_year', '=', 'n.season_year')
        .andOn('r.week', '=', 'n.week')
    })
    .where('r.lid', lid)
    .where('n.season_year', year)
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
