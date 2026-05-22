import db from '#db'

import throw_if_shortfall from './throw-if-shortfall.mjs'

// Post-run oracle for projection imports: counts rows in projections_index
// for the (year, week, sourceid|sourceids, seas_type) tuple and surfaces a
// shortfall through throw_if_shortfall when below the floor. Default floor
// is 50 for season totals (week=0) and 30 for weekly.
export default async function check_projections_index_floor({
  year,
  week,
  sourceid,
  sourceids,
  seas_type,
  floor
}) {
  const query = db('projections_index').where({ year, week, seas_type })
  if (sourceids) query.whereIn('sourceid', sourceids)
  else query.where({ sourceid })

  const [row] = await query.count('* as cnt')
  const count = Number(row?.cnt || 0)
  const effective_floor = floor ?? (week === 0 ? 50 : 30)
  const source_label = sourceids ? sourceids.join(',') : sourceid

  throw_if_shortfall(
    count < effective_floor
      ? `projections_index row-count shortfall for sourceid=${source_label} (year=${year}, week=${week}, seas_type=${seas_type}): ${count} rows (floor=${effective_floor})`
      : null
  )
}
