import db from '#db'

import execute_generated_sql from '#libs-server/data-views/generation/execute-generated-sql.mjs'
import derive_view_from_query_result, {
  QueryViewDerivationError
} from '#libs-server/data-views/derive-view-from-query-result.mjs'

// The execution path for a view backed by a data_view_queries row.
//
// Substitutable for get_data_view_results as the shared executor's `run_query`,
// which is what puts a query-backed view inside the same admission gate,
// timeout policy, telemetry and result cache as every other data-view path.
//
// THE SEED-VERSUS-LIVE RULE LIVES HERE, and it is one line with a long reason.
// Derivation runs on every execution because the descriptors come off the pg
// field metadata, which only exists once the query has run. But it produces
// ONLY the descriptors -- never the sort, the filters, the offset or the limit,
// all of which arrive from the caller's table_state. Deriving those on reload
// would silently reset a saved view's sort every time it is opened, which reads
// as flakiness rather than as a bug, and which is why the derived table_state is
// called a SEED and is written exactly once, at creation.

export class QueryBackedViewError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'QueryBackedViewError'
    this.code = code
    this.is_invalid_request = true
  }
}

/**
 * Load the persisted statement and its annotations.
 *
 * Separate from execution because the authoring script and the render path both
 * need it, and because a missing row must be a named refusal rather than an
 * `undefined.sql_text` further down.
 */
export const load_data_view_query = async ({ query_id, query_runner = db }) => {
  if (!query_id) {
    throw new QueryBackedViewError('missing_query_id', 'query_id is required')
  }
  const row = await query_runner('data_view_queries')
    .where({ query_id })
    .first()
  if (!row) {
    throw new QueryBackedViewError(
      'unknown_query_id',
      `no data_view_queries row for ${query_id}`
    )
  }
  return {
    query_id: row.query_id,
    sql_text: row.sql_text,
    // The `json` column comes back parsed from pg, but a row written by a
    // client that stringified it once too often would arrive as a string, and
    // the deriver's "not an object" refusal would then blame the author rather
    // than the write.
    column_annotations:
      typeof row.column_annotations === 'string'
        ? JSON.parse(row.column_annotations)
        : row.column_annotations
  }
}

// The table reads a cell as `row.original[`${accessorKey}_${column_index}`]`,
// and an ad-hoc alias is unique so its index is always 0. Postgres returns the
// row keyed by the bare alias, so the two are one suffix apart.
//
// WHY HERE AND NOT IN THE SQL. Aliasing the outer projection to `<alias>_0`
// would cost nothing at runtime, but it would also rename the pg FIELD
// DESCRIPTORS -- which are what the deriver reconciles against the authored
// annotations. The annotations would then have to be written in the display
// convention, which is a rendering detail leaking into the authored contract.
// So the descriptors keep the real alias and only the wire rows carry the
// convention, which is where a display convention belongs.
const key_rows_for_client = ({ rows, columns }) =>
  rows.map((row) => {
    const keyed = {}
    for (const column of columns) {
      keyed[`${column.accessorKey}_0`] = row[column.column_id]
    }
    return keyed
  })

/**
 * @param {object} opts - the caller's table_state, spread by the shared executor
 * @returns {Promise<{ data_view_results: Array<object>, data_view_metadata: object, data_view_fields: Array<object> }>}
 */
export default async function run_query_backed_view({
  query_id,
  where = [],
  sort = [],
  offset = 0,
  limit = 500,
  max_limit = null,
  timeout = null,
  calculate_total_count = true,
  user_id = null,
  query_runner = db,
  // Seam. The seed-versus-live rule is a statement about what this function
  // PASSES DOWN -- the caller's sort and filters, never a re-derived seed -- and
  // asserting that needs to see the executor's arguments, not its rows.
  execute_sql = execute_generated_sql
}) {
  const { sql_text, column_annotations } = await load_data_view_query({
    query_id,
    query_runner
  })

  const effective_limit = max_limit
    ? Math.min(Number(limit) || 500, max_limit)
    : limit

  const { data_view_results, data_view_metadata, data_view_fields } =
    await execute_sql({
      sql_text,
      where,
      sort,
      offset,
      limit: effective_limit,
      timeout,
      calculate_total_count,
      user_id
    })

  let derived
  try {
    derived = derive_view_from_query_result({
      data_view_fields,
      column_annotations
    })
  } catch (error) {
    if (!(error instanceof QueryViewDerivationError)) throw error
    // A statement whose projection has drifted from its annotations is a
    // BROKEN SAVED VIEW, not a bad request -- the author reconciled them once
    // and something moved underneath. Re-raise naming the query so the fix has
    // somewhere to start, keeping the derivation code.
    throw new QueryBackedViewError(
      error.code,
      `query ${query_id}: ${error.message}`
    )
  }

  return {
    data_view_results: key_rows_for_client({
      rows: data_view_results,
      columns: derived.columns
    }),
    data_view_metadata: {
      ...data_view_metadata,
      // The channel the client merges wholesale, so no reducer change is
      // needed. Descriptors ride the cached envelope too, which is what keeps a
      // cache hit renderable -- a cached result whose descriptors were dropped
      // renders every column as its raw alias.
      columns: derived.columns,
      query_id
    },
    data_view_fields
  }
}
