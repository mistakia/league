import debug from 'debug'

import db from '#db'
import batch_insert from './batch-insert.mjs'

const log = debug('record-league-format-projection-value-history')

// One history table PER PERIOD, mirroring the base tables. The single mixed
// table this replaces keyed on a `week` column that carried '0', a numeric
// week, 'ros' and 'ros_net' at once, and both callers handed it one
// undifferentiated array -- so the writer was period-blind for exactly the
// reason the base-table writers were.
//
// There is deliberately NO season-period history table. The season base table
// is one row per (pid, league_format_id, season_year) and its value SEALS at the
// start of week 1, so a history mirror would record only the preseason
// re-upserts that seal discards -- reproducing at a new table name the churn the
// period split exists to remove. Operator ruling 2026-08-26.
const WEEKLY = {
  table: 'league_format_player_projection_values_history',
  // (pid, week): many weeks per player, one row per week. The weekly history
  // records the single signed net value; the weekly market salary is gone.
  grain_columns: ['pid', 'week'],
  value_columns: ['projected_points_added_net']
}

const REST_OF_SEASON = {
  table: 'league_format_player_rest_of_season_projection_values_history',
  // (pid) alone -- the period tables carry no week column, so a distinctOn
  // including one would never collapse to the latest observation per grain.
  grain_columns: ['pid'],
  value_columns: [
    'projected_points_added_positive',
    'projected_points_added_net',
    'market_salary_positive',
    'market_salary_net'
  ]
}

// Both tables store their values as numeric and Postgres returns numerics as
// strings. Both sides of the comparison are normalized to a fixed-2 string so a
// freshly computed float compares equal to the value it would round to on
// write -- otherwise every run would look like a change and the change-only
// store would degrade into a full snapshot.
const normalize = (value) => {
  if (value === null || value === undefined) return null
  const number = Number(value)
  return Number.isFinite(number) ? number.toFixed(2) : null
}

const grain_key = ({ row, grain_columns }) =>
  grain_columns.map((column) => String(row[column])).join('/')

// Change-only capture for one period table. Writes a row ONLY where a value
// differs from the grain's last recorded observation, and a tombstone where a
// grain that previously had a value is absent from this run.
//
// The tombstone is per PERIOD and that is load-bearing: a grain dropping out of
// the rest-of-season set needs `is_removed` in the REST-OF-SEASON history, not
// in the weekly one. Recording it against the wrong period leaves the real
// period's last observation standing forever, which is exactly the stale-value
// leakage this table was built to prevent.
const record_period_history = async ({
  spec,
  league_format_id,
  year,
  value_rows,
  observed_at
}) => {
  const { table, grain_columns, value_columns } = spec

  const previous_rows = await db(table)
    .distinctOn(...grain_columns)
    .select(...grain_columns, ...value_columns, 'is_removed')
    .where({ league_format_id, season_year: year })
    .orderBy([
      ...grain_columns.map((column) => ({ column })),
      { column: 'observed_at', order: 'desc' }
    ])

  const previous_by_key = new Map(
    previous_rows.map((row) => [grain_key({ row, grain_columns }), row])
  )

  const inserts = []
  const seen_keys = new Set()

  for (const value_row of value_rows) {
    const grain = {}
    for (const column of grain_columns) {
      // week is smallint on the weekly table now; the raw value passes through
      // unchanged. The grain_key below stringifies it for the change-detection
      // map regardless.
      grain[column] = value_row[column]
    }

    const key = grain_key({ row: grain, grain_columns })
    seen_keys.add(key)

    const values = {}
    for (const column of value_columns) {
      values[column] = normalize(value_row[column])
    }

    const previous = previous_by_key.get(key)
    const unchanged =
      previous &&
      !previous.is_removed &&
      value_columns.every(
        (column) => normalize(previous[column]) === values[column]
      )

    if (unchanged) continue

    inserts.push({
      ...grain,
      ...values,
      league_format_id,
      season_year: year,
      is_removed: false,
      observed_at
    })
  }

  const changed = inserts.length

  for (const [key, previous] of previous_by_key) {
    if (seen_keys.has(key) || previous.is_removed) continue

    const tombstone = {
      league_format_id,
      season_year: year,
      is_removed: true,
      observed_at
    }
    for (const column of grain_columns) {
      tombstone[column] = previous[column]
    }
    // Explicit NULLs rather than omitted keys. A NULL here is an OBSERVED
    // state -- "this grain has no value as of now" -- and an as-of read must
    // not carry an older value past it.
    for (const column of value_columns) {
      tombstone[column] = null
    }
    inserts.push(tombstone)
  }

  const tombstoned = inserts.length - changed

  if (inserts.length) {
    await batch_insert({
      items: inserts,
      // Two runs colliding on the same observation instant is benign -- the
      // second is recording the same state the first already recorded.
      save: (items) =>
        db(table)
          .insert(items)
          .onConflict([
            ...grain_columns,
            'league_format_id',
            'season_year',
            'observed_at'
          ])
          .ignore(),
      batch_size: 1000
    })
  }

  return { observed: value_rows.length, changed, tombstoned }
}

/**
 * Record a change-only observation of a league format's projection values,
 * partitioned by period.
 *
 * The base tables are current-state only: both writers full-DELETE-then-reinsert
 * on every run, so a value that changes is gone. This appends to the history
 * side of each period.
 *
 * Point-in-time read (rest-of-season shown; the weekly table adds `week` to the
 * DISTINCT ON and the ORDER BY):
 *   SELECT DISTINCT ON (pid) pid, projected_points_added_positive,
 *          projected_points_added_net, market_salary_positive,
 *          market_salary_net, is_removed
 *   FROM league_format_player_rest_of_season_projection_values_history
 *   WHERE league_format_id = ? AND season_year = ? AND observed_at <= ?
 *   ORDER BY pid, observed_at DESC;
 * ...then discard rows where `is_removed` is true.
 *
 * @param {object} params
 * @param {string} params.league_format_id
 * @param {number} params.year
 * @param {Array<object>} params.weekly_value_rows - { pid, week,
 *   projected_points_added_net }
 * @param {Array<object>} params.rest_of_season_value_rows - { pid,
 *   projected_points_added_positive, projected_points_added_net,
 *   market_salary_positive, market_salary_net }
 * @param {Date} [params.observed_at] - observation instant, defaults to now
 * @returns {Promise<object>} per-period { observed, changed, tombstoned }
 */
export default async function record_league_format_projection_value_history({
  league_format_id,
  year,
  weekly_value_rows,
  rest_of_season_value_rows,
  observed_at = new Date()
}) {
  if (!league_format_id) throw new Error('league_format_id is required')
  if (!year) throw new Error('year is required')
  if (!weekly_value_rows) throw new Error('weekly_value_rows is required')
  if (!rest_of_season_value_rows) {
    throw new Error('rest_of_season_value_rows is required')
  }

  const weekly = await record_period_history({
    spec: WEEKLY,
    league_format_id,
    year,
    value_rows: weekly_value_rows,
    observed_at
  })

  const rest_of_season = await record_period_history({
    spec: REST_OF_SEASON,
    league_format_id,
    year,
    value_rows: rest_of_season_value_rows,
    observed_at
  })

  // The change rate is the whole cost model for these tables -- log it per
  // period so the real number is observable rather than inferred. The two
  // periods churn at very different rates, which a combined figure hid.
  const rate = ({ observed, changed }) =>
    observed ? ((changed / observed) * 100).toFixed(1) : '0.0'
  log(
    `${league_format_id} ${year}: weekly ${weekly.observed} observed, ` +
      `${weekly.changed} changed (${rate(weekly)}%), ${weekly.tombstoned} tombstoned; ` +
      `rest-of-season ${rest_of_season.observed} observed, ` +
      `${rest_of_season.changed} changed (${rate(rest_of_season)}%), ` +
      `${rest_of_season.tombstoned} tombstoned`
  )

  return { weekly, rest_of_season }
}
