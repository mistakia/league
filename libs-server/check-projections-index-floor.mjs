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
// WHEN THIS CHECK IS AWAKE, and why it is not `is_offseason`.
//
// It used to short-circuit on `current_season.is_offseason`, on the reasoning
// that a weekly row is legitimately absent in the offseason. The reasoning is
// half right and the predicate is wrong, in a way that switched the check off
// across exactly the window it most needed to watch.
//
// `is_offseason` is `week === 0`, and `week` is
// `diff(regular_season_start, 'weeks')` -- so it stays TRUE through the whole
// week between `regular_season_start` and the first game week, which is
// precisely when the sources publish week 1 and when the season's first weekly
// imports run. Measured on 2026-09-02, inside that window: sources 1, 3, 6 and
// 18 had all written real week-1 rows for 2026, while 4for4 and every FBG
// source had written none, and the check reported nothing for any of them
// because it had already returned.
//
// So the skip is bounded by the PUBLICATION WINDOW, stated here as its own
// condition, exactly as `check-season-projections-floor.mjs` states its own
// rather than borrowing a flag that happens to overlap. Weekly sources publish
// week N in the run-up to week N, and `regular_season_start` -- the Tuesday
// nine days before the opener, the anchor every week number is measured from --
// is the point at which that run-up has begun. Before it, nothing is published
// and nothing is expected; from it onward, an empty weekly slice is a finding.
//
// What this deliberately does NOT do is excuse a source that has not published
// yet once the window is open. That judgment needs to know what upstream
// actually said, which only the importer can see, so it belongs there: an
// importer that finds upstream has published nothing returns `{ skipped: true }`
// and its caller never reaches this check. `import-fftoday-projections.mjs` is
// the worked example. A guard every caller has to remember to carry locally is
// a guard that gets forgotten, which is how this hole opened.
export const sources_publish_weekly_projections = ({
  now = current_season.now
} = {}) => !now.isBefore(current_season.regular_season_start)

export default async function check_projections_index_floor({
  season_year,
  week,
  source_id,
  sourceids,
  season_type,
  floor,
  now = current_season.now
}) {
  if (!sources_publish_weekly_projections({ now })) {
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
