import db from '#db'

// Player KTC values per (pid, date), filtered by the format category's
// qb_axis (qb=1 single-QB, qb=2 superflex -- a
// format_category_signal_mapping column, translated to the is_superflex
// boolean at the query boundary). v1 ships players only; KTC pick
// values exist in keeptradecut_valuations (KTCPICK% pids) but mapping
// (year, round, slot) to (pick_original_owner_tid) requires a standings-based
// pick-order projection that is deferred to a follow-up. See plan
// "Round-three review findings applied".
//
// Returns: Map<`${pid}__${date_iso}`, numeric_value>

export const extract_ktc_per_asset = async ({
  player_ids,
  ktc_quarterback_axis,
  start_date,
  end_date
}) => {
  const result = new Map()
  if (!player_ids.length) return result
  // `new Date('YYYY-MM-DD')` is UTC midnight while observed_at holds NY local
  // midnight, so these bounds carry a 4-5h skew. That is pre-existing and
  // absorbed by the day of slack on the upper bound; tightening it would lose
  // the boundary day, so the instants are preserved exactly as the epoch
  // arithmetic they replace produced.
  const end_bound = new Date(new Date(end_date).getTime() + 86400 * 1000)
  const rows = await db('keeptradecut_valuations')
    .select(
      db.raw(
        "pid, TO_CHAR(observed_at, 'YYYY-MM-DD') AS date_iso, keeptradecut_value"
      )
    )
    .whereIn('pid', player_ids)
    .where('is_superflex', ktc_quarterback_axis === 2)
    .where('observed_at', '>=', new Date(start_date))
    .where('observed_at', '<=', end_bound)
    .orderBy('observed_at', 'asc')
  for (const r of rows) {
    result.set(`${r.pid}__${r.date_iso}`, Number(r.keeptradecut_value))
  }
  return result
}

export default extract_ktc_per_asset
