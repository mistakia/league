import db from '#db'

/**
 * Single writer for every canonical `{table}_changelog` audit table.
 *
 * All four changelog tables share ONE shape and differ only by their entity
 * key column(s):
 *
 *   { <entity key(s)>, column_name, previous_value, new_value, source,
 *     reason, changed_at }
 *
 * Every curated-dimension mutation site records its field-level settlements
 * through this helper instead of hand-rolling an insert, so the audit shape,
 * provenance (`source`), and typing stay uniform across the schema.
 */

// Entity-key columns and the natural conflict target (a unique constraint the
// DB enforces) for each changelog table. A null conflict means a plain insert.
const CHANGELOG_TABLES = {
  player_changelog: {
    keys: ['pid'],
    conflict: null
  },
  play_changelog: {
    keys: ['esbid', 'play_id'],
    conflict: ['esbid', 'play_id', 'column_name', 'changed_at']
  },
  nfl_games_changelog: {
    keys: ['esbid'],
    conflict: null
  },
  pff_player_seasonlogs_changelog: {
    keys: ['pid', 'season_year'],
    conflict: null
  }
}

/**
 * Record one or more changelog entries.
 *
 * @param {Object} params
 * @param {string} params.table - one of the four `{table}_changelog` tables
 * @param {Object|Object[]} params.rows - a single row or a batch. Each row
 *   MUST carry the table's entity key(s), a `column_name`, and a `source`.
 *   `previous_value`, `new_value`, and `reason` are optional (default null).
 *   `changed_at` is an optional JS `Date` (defaults to now) — callers with a
 *   synthetic event time (e.g. nflverse kickoff-minus-day) pass their own.
 * @param {import('knex').Knex|import('knex').Knex.Transaction} [params.trx]
 *   - optional connection/transaction; defaults to the shared `db`.
 * @returns {Promise<number>} number of rows inserted (pre-conflict)
 */
export const record_changelog = async ({ table, rows, trx }) => {
  const spec = CHANGELOG_TABLES[table]
  if (!spec) {
    throw new Error(`record_changelog: unknown changelog table '${table}'`)
  }

  const list = Array.isArray(rows) ? rows : [rows]
  if (list.length === 0) {
    return 0
  }

  const now = new Date()
  const prepared = list.map((row) => {
    for (const key of spec.keys) {
      if (row[key] === undefined || row[key] === null) {
        throw new Error(
          `record_changelog(${table}): missing entity key '${key}'`
        )
      }
    }
    if (!row.column_name) {
      throw new Error(`record_changelog(${table}): missing column_name`)
    }
    if (!row.source) {
      throw new Error(`record_changelog(${table}): missing source`)
    }

    const prepared_row = {
      column_name: row.column_name,
      previous_value:
        row.previous_value === undefined ? null : row.previous_value,
      new_value: row.new_value === undefined ? null : row.new_value,
      source: row.source,
      reason: row.reason === undefined ? null : row.reason,
      changed_at: row.changed_at || now
    }
    for (const key of spec.keys) {
      prepared_row[key] = row[key]
    }
    return prepared_row
  })

  const connection = trx || db
  let query = connection(table).insert(prepared)
  if (spec.conflict) {
    query = query.onConflict(spec.conflict).ignore()
  }
  await query

  return prepared.length
}

export default record_changelog
