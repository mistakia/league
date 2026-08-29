import debug from 'debug'

import db from '#db'
import record_projection_history from './record-projection-history.mjs'

const log = debug('save-projections')

// The two periods an importer can publish. A source either gives a number for
// one game week or a number for the whole season; there is no third thing, and
// the closed set is what lets each caller say which one it means instead of
// encoding it as a reserved week value.
export const projection_periods = {
  WEEK: 'week',
  SEASON: 'season'
}

// The single write path for every projection importer, for one source, one
// season_year and one period.
//
// It exists because the same three-step block -- delete the rows this run did
// not produce, upsert the ones it did, record the observation in history -- was
// open-coded in eight importers. That is eight places for a period encoding to
// drift, and it did: the season row was written as `week: 0` into the per-week
// table, which is the sentinel this table split removes. Now an importer names
// its period and this decides what that means physically.
//
// CALLERS PASS DATA, NOT PERIOD COLUMNS. `inserts` carries `pid` and the stat
// columns only. `week` and `season_type` are period encoding and belong here --
// an importer that could set them could set them wrong.
export default async function save_projections({
  period,
  inserts,
  source_id,
  season_year,
  week,
  season_type = 'REG',
  generated_at
}) {
  if (
    period !== projection_periods.WEEK &&
    period !== projection_periods.SEASON
  ) {
    throw new Error(`period must be 'week' or 'season'; got ${period}`)
  }
  if (period === projection_periods.WEEK && !(week >= 1)) {
    // `projections_index` holds `CHECK (week >= 1)`, so a 0 here is a row the
    // table rejects mid-batch, after the delete above has already committed.
    // Refusing at the boundary turns that into a readable error.
    throw new Error(
      `weekly projections need a game week >= 1; got ${week}. ` +
        'A season-long projection uses period `season`, not week 0.'
    )
  }
  if (!inserts.length) return { deleted: 0, saved: 0 }

  const is_season = period === projection_periods.SEASON
  const table = is_season ? 'season_projections_index' : 'projections_index'
  const pids = inserts.map((row) => row.pid)

  const rows = inserts.map((row) => ({
    ...row,
    source_id,
    season_year,
    ...(is_season ? {} : { week, season_type })
  }))

  // Remove any existing projections for this slice that this run did not
  // produce, so a player a source drops does not keep a stale row forever.
  const stale_scope = is_season
    ? { season_year, source_id }
    : { season_year, week, season_type, source_id }

  const deleted = await db(table)
    .where(stale_scope)
    .whereNotIn('pid', pids)
    .del()

  log(`${table}: deleting ${deleted} stale rows, saving ${rows.length}`)

  await db(table)
    .insert(rows)
    .onConflict(
      is_season
        ? ['source_id', 'pid', 'season_year']
        : ['source_id', 'pid', 'user_id', 'week', 'season_year', 'season_type']
    )
    .merge()

  await record_projection_history({ inserts: rows, period, generated_at })

  return { deleted, saved: rows.length }
}
