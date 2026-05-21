import db from '#db'
import { keeptradecut_metric_types } from '#constants'

// Player KTC values per (pid, date), filtered by the format category's
// qb_axis (qb=1 single-QB, qb=2 superflex). v1 ships players only; KTC pick
// values exist in keeptradecut_rankings (KTCPICK% pids) but mapping
// (year, round, slot) to (pick_original_owner_tid) requires a standings-based
// pick-order projection that is deferred to a follow-up. See plan
// "Round-three review findings applied".
//
// Returns: Map<`${pid}__${date_iso}`, numeric_value>

export const extract_ktc_per_asset = async ({ player_ids, ktc_qb_axis, start_date, end_date }) => {
  const result = new Map()
  if (!player_ids.length) return result
  const rows = await db('keeptradecut_rankings')
    .select(db.raw("pid, TO_CHAR(TO_TIMESTAMP(d), 'YYYY-MM-DD') AS date_iso, v"))
    .whereIn('pid', player_ids)
    .where('qb', ktc_qb_axis)
    .where('type', keeptradecut_metric_types.VALUE)
    .where('d', '>=', Math.floor(new Date(start_date).getTime() / 1000))
    .where('d', '<=', Math.floor(new Date(end_date).getTime() / 1000) + 86400)
    .orderBy('d', 'asc')
  for (const r of rows) {
    result.set(`${r.pid}__${r.date_iso}`, Number(r.v))
  }
  return result
}

export default extract_ktc_per_asset
