import db from '#db'
import { current_season } from '#constants'

import throw_if_shortfall from './throw-if-shortfall.mjs'

// Post-run oracle for WEEKLY projection imports: counts rows in
// projections_index for the (season_year, week, source_id|sourceids,
// season_type) tuple and surfaces a shortfall through throw_if_shortfall when
// below the floor.
//
// Weekly is now the only thing this counts. The floor used to branch
// `week === 0 ? 50 : 30`, because week 0 of this table was the season-long row;
// that row lives in season_projections_index and `week` is CHECK (week >= 1), so
// the branch became unreachable rather than merely unused. Its counterpart is
// check-season-projections-floor.mjs, which the six season importers call.
//
// Offseason short-circuit: a WEEKLY row is legitimately absent in the offseason,
// so the check would report on a correct run. Skip it. Note this is the opposite
// of the season check, which deliberately stays awake then -- the offseason is
// exactly when a season row must exist.
export default async function check_projections_index_floor({
  season_year,
  week,
  source_id,
  sourceids,
  season_type,
  floor
}) {
  if (current_season.is_offseason) {
    return
  }

  const query = db('projections_index').where({
    season_year,
    week,
    season_type
  })
  if (sourceids) query.whereIn('source_id', sourceids)
  else query.where({ source_id })

  const [row] = await query.count('* as cnt')
  const count = Number(row?.cnt || 0)
  const effective_floor = floor ?? 30
  const source_label = sourceids ? sourceids.join(',') : source_id

  throw_if_shortfall(
    count < effective_floor
      ? `projections_index row-count shortfall for source_id=${source_label} (season_year=${season_year}, week=${week}, season_type=${season_type}): ${count} rows (floor=${effective_floor})`
      : null
  )
}
