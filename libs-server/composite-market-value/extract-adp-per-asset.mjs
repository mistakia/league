import db from '#db'

import {
  median,
  load_pick_value_curve
} from '#libs-server/composite-market-value/utils.mjs'

// ADP rank converted via league_format_draft_pick_value (format-aware empirical
// rank -> pts-added/game curve) before calibration. Topic 4 resolution: the
// curve preserves format-specific tail steepness that log(rank) would compress.
// Multi-source per (pid, date): median across whatever ADP sources are present.
//
// Returns: Map<`${pid}__${date_iso}`, numeric_value>

export const extract_adp_per_asset = async ({
  player_ids,
  adp_type,
  league_format_id,
  start_date,
  end_date
}) => {
  const result = new Map()
  if (!player_ids.length) return result

  const adp_rows = await db('player_adp_history')
    .select(
      db.raw(
        "pid, TO_CHAR(TO_TIMESTAMP(timestamp), 'YYYY-MM-DD') AS date_iso, adp, source_id"
      )
    )
    .whereIn('pid', player_ids)
    .where('adp_type', adp_type)
    .where('timestamp', '>=', Math.floor(new Date(start_date).getTime() / 1000))
    .where(
      'timestamp',
      '<=',
      Math.floor(new Date(end_date).getTime() / 1000) + 86400
    )
    .whereNotNull('adp')

  const buckets = new Map()
  for (const r of adp_rows) {
    const key = `${r.pid}__${r.date_iso}`
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(Number(r.adp))
  }

  const pv_curve = await load_pick_value_curve({ league_format_id })

  for (const [key, ranks] of buckets) {
    const median_rank = Math.round(median(ranks))
    const v = pv_curve.get(median_rank)
    if (v != null) result.set(key, v)
  }
  return result
}

export default extract_adp_per_asset
