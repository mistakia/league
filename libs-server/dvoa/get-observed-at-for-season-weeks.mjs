// Synthesizes observed_at for backfilled DVOA rows that carry no timestamp of
// their own -- (season_year, week) is their only temporal coordinate.
//
// Reads the existing nfl_year_week_timestamp matview AS-IS. That matview is
// REG-only (WHERE season_type = 'REG') and is read by non-DVOA subsystems, so
// nothing here renames or otherwise conforms it.
//
// A week with no matview row is a caller error rather than a null: the caller
// asked for an observed_at that cannot be derived, and silently returning null
// would put an unconstrained NOT NULL violation several statements downstream.

import db from '#db'

export default async function get_observed_at_for_season_weeks({
  season_year,
  weeks
}) {
  if (!season_year) {
    throw new Error('season_year is required')
  }

  if (!Array.isArray(weeks) || !weeks.length) {
    throw new Error('weeks must be a non-empty array')
  }

  const rows = await db('nfl_year_week_timestamp')
    .select('week', 'week_timestamp')
    .where('year', season_year)
    .whereIn('week', weeks)

  const observed_at_by_week = new Map(
    rows.map((row) => [row.week, new Date(row.week_timestamp * 1000)])
  )

  const missing_weeks = weeks.filter((week) => !observed_at_by_week.has(week))
  if (missing_weeks.length) {
    throw new Error(
      `nfl_year_week_timestamp has no REG row for ${season_year} week(s) ${missing_weeks.join(', ')}`
    )
  }

  return observed_at_by_week
}
