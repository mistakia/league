import db from '#db'

import {
  median,
  load_pick_value_curve
} from '#libs-server/composite-market-value/utils.mjs'

// FantasyPros rankings: overall_rank converted via league_format_draft_pick_value
// curve (same pattern as ADP per Topic 4 resolution). Median across present
// FantasyPros sources for (pid, date).
//
// Returns: Map<`${pid}__${date_iso}`, numeric_value>

export const extract_rankings_per_asset = async ({
  player_ids,
  ranking_type,
  league_format_id,
  start_date,
  end_date
}) => {
  const result = new Map()
  if (!player_ids.length) return result

  const rows = await db('player_rankings_history')
    .select(
      db.raw(
        "pid, TO_CHAR(observed_at, 'YYYY-MM-DD') AS date_iso, overall_rank, source_id"
      )
    )
    .whereIn('pid', player_ids)
    .where('ranking_type', ranking_type)
    .where('observed_at', '>=', new Date(start_date))
    .where(
      'observed_at',
      '<=',
      new Date(new Date(end_date).getTime() + 86400 * 1000)
    )
    .whereNotNull('overall_rank')

  const buckets = new Map()
  for (const r of rows) {
    const key = `${r.pid}__${r.date_iso}`
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(Number(r.overall_rank))
  }

  const pv_curve = await load_pick_value_curve({ league_format_id })

  for (const [key, ranks] of buckets) {
    const median_rank = Math.round(median(ranks))
    const v = pv_curve.get(median_rank)
    if (v != null) result.set(key, v)
  }
  return result
}

export default extract_rankings_per_asset
