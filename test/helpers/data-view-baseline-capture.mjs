// Result-set baseline capture engine for the source/bridge migration.
//
// Pure dependency-injected module: no #libs-server imports. The specs
// (test/data-view-queries-result-baselines-capture.spec.mjs,
// test/data-view-queries-result-equivalence.spec.mjs) wire in knex, the
// fixture loader, and get_data_view_results_query.
//
// Output shape (one JSON file keyed by fixture filename):
//   {
//     "fixture-a.json": {
//       "row_count": 12,
//       "column_count": 8,
//       "row_hash": "<sha256 hex>",
//       "seed_sparse": false,
//       "captured_at": "<iso8601>",
//       "captured_against": "<git sha>",
//       "error": null | "<message>"
//     },
//     ...
//   }

import crypto from 'node:crypto'

const normalize_value = (value) => (value === undefined ? null : value)

const normalize_row = (row, columns) => {
  const out = {}
  for (const col of columns) out[col] = normalize_value(row[col])
  return out
}

const hash_rows = (rows) => {
  const h = crypto.createHash('sha256')
  for (const row of rows) h.update(JSON.stringify(row) + '\n')
  return h.digest('hex')
}

const sort_rows_stably = (rows) =>
  [...rows].sort((a, b) =>
    JSON.stringify(a).localeCompare(JSON.stringify(b))
  )

export const capture_fixture_baseline = async ({
  fixture,
  get_data_view_results_query,
  captured_against
}) => {
  const captured_at = new Date().toISOString()
  try {
    const { query } = await get_data_view_results_query(fixture.request)
    const rows = await query
    const row_array = Array.isArray(rows) ? rows : []
    const columns =
      row_array.length > 0 ? Object.keys(row_array[0]).sort() : []
    const normalized = row_array.map((r) => normalize_row(r, columns))
    const sorted = sort_rows_stably(normalized)
    return {
      row_count: sorted.length,
      column_count: columns.length,
      row_hash: hash_rows(sorted),
      seed_sparse: sorted.length === 0,
      captured_at,
      captured_against,
      error: null
    }
  } catch (error) {
    return {
      row_count: null,
      column_count: null,
      row_hash: null,
      seed_sparse: false,
      captured_at,
      captured_against,
      error: error && error.message ? error.message : String(error)
    }
  }
}

export const capture_all_baselines = async ({
  fixtures,
  get_data_view_results_query,
  captured_against,
  on_progress
}) => {
  const results = {}
  for (const fixture of fixtures) {
    const key = fixture.filename || fixture.name
    const entry = await capture_fixture_baseline({
      fixture,
      get_data_view_results_query,
      captured_against
    })
    results[key] = entry
    if (on_progress) on_progress(key, entry)
  }
  return results
}
