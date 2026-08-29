import db from '#db'
import { current_season } from '#constants'

import throw_if_shortfall from './throw-if-shortfall.mjs'

// Post-run oracle for the SEASON-LONG projection importers, the counterpart to
// check-projections-index-floor.mjs.
//
// It exists because that check counted `projections_index` and branched its
// floor on `week === 0`. Once the season row moved to its own table that branch
// was dead, and six importers -- ESPN, CBS, Fantasy Sharks, FFToday, 4for4 and
// Sleeper -- would have been left with no row-count oracle at all. Five of them
// publish ONLY a season projection, so for those it was their only one.
//
// THE OFFSEASON IS NOT SKIPPED HERE, and that is the difference that matters.
// The weekly check short-circuits on `current_season.is_offseason` because a
// weekly row is legitimately absent then. A SEASON row is the opposite: the
// offseason is exactly when these importers run and exactly when the row must
// exist. Inheriting that skip would have produced a check that is blind for the
// entire window it exists to watch.
//
// What is legitimately absent is a season projection before the sources publish
// one, which happens when camps open rather than at any fantasy-calendar
// boundary. That is stated as its own condition below rather than borrowed from
// the offseason flag.
const SOURCES_PUBLISH_FROM_MONTH = 6 // July, zero-indexed

export const sources_publish_season_projections = ({ now = new Date() } = {}) =>
  current_season.is_regular_season ||
  now.getMonth() >= SOURCES_PUBLISH_FROM_MONTH

export default async function check_season_projections_floor({
  season_year,
  source_id,
  sourceids,
  floor = 50,
  now = new Date()
}) {
  if (!sources_publish_season_projections({ now })) {
    return
  }

  const query = db('season_projections_index').where({ season_year })
  if (sourceids) query.whereIn('source_id', sourceids)
  else query.where({ source_id })

  const [row] = await query.count('* as cnt')
  const count = Number(row?.cnt || 0)
  const source_label = sourceids ? sourceids.join(',') : source_id

  throw_if_shortfall(
    count < floor
      ? `season_projections_index row-count shortfall for source_id=${source_label} (season_year=${season_year}): ${count} rows (floor=${floor})`
      : null
  )
}
