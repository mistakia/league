// Reserved output column carrying the `count(*) over ()` total. Column ids and
// their generated aliases are `[a-z0-9_]`, so leading/trailing double
// underscores cannot collide with a real one; the collision is asserted against
// the generated SQL before the column is added.
//
// Shared by both execution paths -- the structured one in
// libs-server/get-data-view-results.mjs and the sandboxed-SQL one in
// libs-server/data-views/generation/execute-generated-sql.mjs -- because the
// reserved key and the stripping rule are one contract and two copies of it
// drift.
export const TOTAL_COUNT_KEY = '__data_view_total_count__'

// Split the reserved total-count column off the rows and strip it, so no
// consumer -- the HTTP route, the websocket socket, the CSV export -- ever sees
// it. An empty result set yields no rows to read the count from, in which case
// the total is 0, matching what the wrapped COUNT(*) returned.
//
// The FIELD descriptors are stripped in the same place and for the same reason.
// Missing that half is an off-by-one on every total-counted query -- which is
// most of them -- because the descriptor list would then be one longer than the
// column list and the reconciliation downstream pairs them by position.
export function extract_total_count({
  rows,
  fields = [],
  calculate_total_count
}) {
  const data_view_fields = fields.filter(
    (field) => field.name !== TOTAL_COUNT_KEY
  )

  if (!calculate_total_count) {
    return { data_view_results: rows, data_view_fields, total_count: null }
  }

  const total_count = rows.length ? parseInt(rows[0][TOTAL_COUNT_KEY], 10) : 0

  const data_view_results = rows.map(
    ({ [TOTAL_COUNT_KEY]: reserved_total_count, ...data_view_row }) =>
      data_view_row
  )

  return { data_view_results, data_view_fields, total_count }
}
