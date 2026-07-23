import db from '#db'
import { is_offseason } from '#constants'

import throw_if_shortfall from './throw-if-shortfall.mjs'

// Post-run oracle for projection imports: counts rows in projections_index
// for the (year, week, sourceid|sourceids, seas_type) tuple and surfaces a
// shortfall through throw_if_shortfall when below the floor. Default floor
// is 50 for season totals (week=0) and 30 for weekly.
//
// Offseason short-circuit: during offseason (week=0) season-total projections
// are legitimately absent from most sources — sources only publish preseason
// outlooks once training camps open. Skip the floor check to avoid false
// positives. Matches the ESPN seasonal-import guard (§891) and the nflverse
// zero-UFA in-season-only guard (league 56ee6942).
export default async function check_projections_index_floor({
  year,
  week,
  sourceid,
  sourceids,
  seas_type,
  floor
}) {
  if (is_offseason) {
    return
  }

  const query = db('projections_index').where({
    season_year: year,
    week,
    season_type: seas_type
  })
  if (sourceids) query.whereIn('sourceid', sourceids)
  else query.where({ sourceid })

  const [row] = await query.count('* as cnt')
  const count = Number(row?.cnt || 0)
  const effective_floor = floor ?? (week === 0 ? 50 : 30)
  const source_label = sourceids ? sourceids.join(',') : sourceid

  throw_if_shortfall(
    count < effective_floor
      ? `projections_index row-count shortfall for sourceid=${source_label} (season_year=${year}, week=${week}, season_type=${seas_type}): ${count} rows (floor=${effective_floor})`
      : null
  )
}
