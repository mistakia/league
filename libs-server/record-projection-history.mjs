import debug from 'debug'

import db from '#db'
import batch_insert from './batch-insert.mjs'

const log = debug('record-projection-history')

// The season-long series lives in its own table rather than under a week = 0
// sentinel in projections_history. It has no week, so it carries no week,
// season_type or nfl_week_id -- the sentinel existed only because the mixed
// table demanded a week, and it minted a YYYY_REG_WEEK_0 identifier the season
// vocabulary does not admit.
//
// Both table names are written as LITERALS at every query site below rather than
// hoisted into constants. `check-knex-column-resolution` and
// `check-renamed-column-consumers` derive their candidate set from `db('<table>')`
// FROM-target literals, so a table name behind a constant is invisible to both --
// the exact shape docs/guides/schema.md warns defeats reference-shaped matchers.

// The 36 stat columns, in schema order. This is the tuple that decides whether
// an observation is a CHANGE, so it must be the whole value set: a comparison
// over a subset silently collapses genuinely distinct forecasts into one run,
// which is the failure mode that reads as a working change detector.
const STAT_COLUMNS = [
  'passing_attempts',
  'passing_completions',
  'passing_yards',
  'passing_interceptions',
  'passing_touchdowns',
  'rushing_attempts',
  'rushing_yards',
  'rushing_touchdowns',
  'targets',
  'receptions',
  'receiving_yards',
  'receiving_touchdowns',
  'fumbles_lost',
  'two_point_conversions',
  'field_goals_made',
  'field_goal_yards',
  'field_goals_made_0_19_yards',
  'field_goals_made_20_29_yards',
  'field_goals_made_30_39_yards',
  'field_goals_made_40_49_yards',
  'field_goals_made_50_plus_yards',
  'extra_points_made',
  'defensive_sacks',
  'defensive_interceptions',
  'defensive_forced_fumbles',
  'defensive_recovered_fumbles',
  'defensive_three_and_outs',
  'defensive_fourth_down_stops',
  'defensive_points_against',
  'defensive_yards_against',
  'defensive_blocked_kicks',
  'defensive_safeties',
  'defensive_two_point_returns',
  'defensive_touchdowns',
  'kickoff_return_touchdowns',
  'punt_return_touchdowns'
]

// field_goal_yards is `integer`; every other stat column is `numeric(n,1)`.
const INTEGER_COLUMNS = new Set(['field_goal_yards'])

// Postgres returns numerics as strings, so a freshly parsed source value has to
// be normalized to the spelling it would ROUND TO on write before it can be
// compared to a stored one -- otherwise every run reads as a change and the
// change-only store degrades into the full snapshot it was built to replace.
// This is the same trap record-league-format-projection-value-history.mjs
// documents, at scale 1 rather than 2.
//
// Note which way this fails. A normalization mismatch makes an unchanged value
// look CHANGED, which costs one redundant row; it cannot make a changed value
// look unchanged, which would lose a forecast movement. The safe direction is
// the one worth checking.
const normalize = (value, column) => {
  if (value === null || value === undefined) return null
  const number = Number(value)
  if (!Number.isFinite(number)) return null
  return INTEGER_COLUMNS.has(column)
    ? String(Math.round(number))
    : number.toFixed(1)
}

const grain_key = (row) => `${row.source_id}/${row.pid}/${row.season_year}`

const values_equal = (previous, row) =>
  STAT_COLUMNS.every(
    (column) =>
      normalize(previous[column], column) === normalize(row[column], column)
  )

// Change-only capture for the season series. Writes a row ONLY where the stat
// tuple differs from the grain's last recorded observation.
//
// There is deliberately NO tombstone column, unlike the league-format history.
// The 119,077 rows migrated out of the week = 0 sentinel carry no notion of a
// grain being withdrawn, so adding one here would make the writer's semantics
// disagree with the entire existing series -- a point-in-time read would behave
// differently either side of the migration boundary. A source dropping a player
// is recorded the same way it always has been: the grain simply stops gaining
// observations.
const record_season_history = async ({ rows, generated_at }) => {
  if (!rows.length) return { observed: 0, changed: 0 }

  const previous_rows = await db('season_projections_history')
    .distinctOn('source_id', 'pid', 'season_year')
    .select('source_id', 'pid', 'season_year', ...STAT_COLUMNS)
    .whereIn(
      ['source_id', 'season_year'],
      [
        ...new Set(rows.map((row) => `${row.source_id}/${row.season_year}`))
      ].map((pair) => pair.split('/').map(Number))
    )
    .orderBy([
      { column: 'source_id' },
      { column: 'pid' },
      { column: 'season_year' },
      { column: 'generated_at', order: 'desc' }
    ])

  const previous_by_key = new Map(
    previous_rows.map((row) => [grain_key(row), row])
  )

  const inserts = []
  for (const row of rows) {
    const previous = previous_by_key.get(grain_key(row))
    if (previous && values_equal(previous, row)) continue

    const insert = {
      pid: row.pid,
      source_id: row.source_id,
      season_year: row.season_year,
      generated_at
    }
    for (const column of STAT_COLUMNS) {
      // Explicit undefined-to-null. An omitted key binds DEFAULT rather than
      // NULL, which would store 0 for field_goal_yards and read as a change on
      // the following run.
      insert[column] = row[column] === undefined ? null : row[column]
    }
    inserts.push(insert)
  }

  if (inserts.length) {
    await batch_insert({
      items: inserts,
      // Two runs colliding on the same instant is benign -- the second is
      // recording the state the first already recorded.
      save: (items) =>
        db('season_projections_history')
          .insert(items)
          .onConflict(['source_id', 'pid', 'season_year', 'generated_at'])
          .ignore(),
      batch_size: 1000
    })
  }

  return { observed: rows.length, changed: inserts.length }
}

/**
 * Record raw projection observations, routing the season-long series to
 * `season_projections_history` and everything else to `projections_history`.
 *
 * The season series is stored CHANGE-ONLY: one row per distinct value run,
 * stamped with the first `generated_at` at which the forecast took that value.
 * The weekly series is stored as-is, one row per importer run, unchanged from
 * how these writers have always behaved.
 *
 * Point-in-time read of the season board:
 *   SELECT DISTINCT ON (source_id, pid) *
 *   FROM season_projections_history
 *   WHERE season_year = ? AND generated_at <= ?
 *   ORDER BY source_id, pid, generated_at DESC;
 * Change-only storage returns identical values here, because the row this
 * selects is the last value CHANGE at or before the cutoff either way.
 *
 * @param {object} params
 * @param {Array<object>} params.inserts - the same rows written to
 *   `projections_index`, carrying pid, source_id, season_year, week,
 *   season_type and the stat columns
 * @param {Date} params.generated_at - observation instant
 * @returns {Promise<object>} { weekly: { inserted }, season: { observed, changed } }
 */
export default async function record_projection_history({
  inserts,
  generated_at
}) {
  if (!inserts) throw new Error('inserts is required')
  if (!generated_at) throw new Error('generated_at is required')

  // Number('0') is 0, and the sentinel arrives as a number from every caller --
  // but compare loosely on the parsed value rather than on the spelling, since
  // the projections_index writers upstream have carried both.
  const season_rows = inserts.filter((row) => Number(row.week) === 0)
  const weekly_rows = inserts.filter((row) => Number(row.week) !== 0)

  // The season table carries no season_type and no user_id, so a row that is
  // not REG or not source-authored would be SILENTLY relabelled by the routing
  // rather than stored wrong-but-visible. Every one of the 2,430,367 rows the
  // migration read was season_type REG, and the user-authored projection
  // feature was removed end to end, so neither case is reachable today --
  // which is exactly why it has to fail loudly if one ever appears. The PFF
  // importer is the live reason this is not theoretical: it passes seas_type
  // straight through and can emit POST.
  for (const row of season_rows) {
    if (row.season_type && row.season_type !== 'REG') {
      throw new Error(
        `season-long projection at week 0 carries season_type ${row.season_type}; ` +
          'the season table has no season_type column to store it in'
      )
    }
    if (row.user_id) {
      throw new Error(
        `season-long projection at week 0 carries user_id ${row.user_id}; ` +
          'the season table has no user_id column to store it in'
      )
    }
  }

  let inserted = 0
  if (weekly_rows.length) {
    const rows = weekly_rows.map((row) => ({ ...row, generated_at }))
    await batch_insert({
      items: rows,
      save: (items) => db('projections_history').insert(items),
      batch_size: 1000
    })
    inserted = rows.length
  }

  const season = await record_season_history({
    rows: season_rows,
    generated_at
  })

  if (season.observed) {
    const rate = ((season.changed / season.observed) * 100).toFixed(1)
    log(
      `season: ${season.observed} observed, ${season.changed} changed (${rate}%); ` +
        `weekly: ${inserted} inserted`
    )
  }

  return { weekly: { inserted }, season }
}
