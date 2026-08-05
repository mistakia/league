import debug from 'debug'

import db from '#db'
import batch_insert from './batch-insert.mjs'

const log = debug('record-league-format-projection-value-history')

const HISTORY_TABLE = 'league_format_player_projection_values_history'

// `league_format_player_projection_values` stores pts_added as numeric(7,2) and
// market_salary as numeric(6,2), and Postgres returns numerics as strings. Both
// sides of the comparison are normalized to a fixed-2 string so a freshly computed
// float compares equal to the value it would round to on write -- otherwise every
// run would look like a change and the change-only store would degrade into a full
// snapshot.
const normalize = (value) => {
  if (value === null || value === undefined) return null
  const number = Number(value)
  return Number.isFinite(number) ? number.toFixed(2) : null
}

/**
 * Record a change-only observation of a league format's projection values.
 *
 * `league_format_player_projection_values` is current-state only: both writers
 * full-DELETE-then-reinsert on every run, so a value that changes is gone. This
 * appends to the history side, writing a row ONLY where the value differs from the
 * grain's last recorded observation.
 *
 * A grain that previously had a value and is absent from `value_rows` gets a
 * `removed: true` tombstone, so a point-in-time read resolves to "no value as of D"
 * instead of returning a stale value indefinitely.
 *
 * Point-in-time read:
 *   SELECT DISTINCT ON (pid, week) pid, week, pts_added, market_salary, removed
 *   FROM league_format_player_projection_values_history
 *   WHERE league_format_id = ? AND season_year = ? AND observed_at <= ?
 *   ORDER BY pid, week, observed_at DESC;
 * ...then discard rows where `removed` is true.
 *
 * @param {Object} params
 * @param {string} params.league_format_id
 * @param {number} params.year
 * @param {Array<Object>} params.value_rows - { pid, week, pts_added, market_salary }
 * @param {Date} [params.observed_at] - observation instant, defaults to now
 * @returns {Promise<Object>} { observed, changed, tombstoned }
 */
export default async function record_league_format_projection_value_history({
  league_format_id,
  year,
  value_rows,
  observed_at = new Date()
}) {
  if (!league_format_id) throw new Error('league_format_id is required')
  if (!year) throw new Error('year is required')
  if (!value_rows) throw new Error('value_rows is required')

  const previous_rows = await db(HISTORY_TABLE)
    .distinctOn('pid', 'week')
    .select('pid', 'week', 'pts_added', 'market_salary', 'is_removed')
    .where({ league_format_id, season_year: year })
    .orderBy([
      { column: 'pid' },
      { column: 'week' },
      { column: 'observed_at', order: 'desc' }
    ])

  const previous_by_key = new Map(
    previous_rows.map((row) => [`${row.pid}/${row.week}`, row])
  )

  const inserts = []
  const seen_keys = new Set()

  for (const value_row of value_rows) {
    const week = String(value_row.week)
    const key = `${value_row.pid}/${week}`
    seen_keys.add(key)

    const pts_added = normalize(value_row.pts_added)
    const market_salary = normalize(value_row.market_salary)
    const previous = previous_by_key.get(key)

    const unchanged =
      previous &&
      !previous.is_removed &&
      normalize(previous.pts_added) === pts_added &&
      normalize(previous.market_salary) === market_salary

    if (unchanged) continue

    inserts.push({
      pid: value_row.pid,
      league_format_id,
      season_year: year,
      week,
      pts_added,
      market_salary,
      is_removed: false,
      observed_at
    })
  }

  const changed = inserts.length

  for (const [key, previous] of previous_by_key) {
    if (seen_keys.has(key) || previous.is_removed) continue
    inserts.push({
      pid: previous.pid,
      league_format_id,
      season_year: year,
      week: previous.week,
      pts_added: null,
      market_salary: null,
      is_removed: true,
      observed_at
    })
  }

  const tombstoned = inserts.length - changed

  if (inserts.length) {
    await batch_insert({
      items: inserts,
      // Two runs colliding on the same observation instant is benign -- the second
      // is recording the same state the first already recorded.
      save: (items) =>
        db(HISTORY_TABLE)
          .insert(items)
          .onConflict([
            'pid',
            'league_format_id',
            'season_year',
            'week',
            'observed_at'
          ])
          .ignore(),
      batch_size: 1000
    })
  }

  // The change rate is the whole cost model for this table -- log it so the real
  // number is observable from day one rather than inferred from the raw grain.
  const change_rate = value_rows.length
    ? ((changed / value_rows.length) * 100).toFixed(1)
    : '0.0'
  log(
    `${league_format_id} ${year}: ${value_rows.length} observed, ${changed} changed (${change_rate}%), ${tombstoned} tombstoned`
  )

  return { observed: value_rows.length, changed, tombstoned }
}
