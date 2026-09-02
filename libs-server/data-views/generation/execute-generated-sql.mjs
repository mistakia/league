import db from '#db'
import { get_sandbox_db } from '#db/sandbox-pool.mjs'
import { run_sandboxed_read } from '#libs-server/sandboxed-read.mjs'
import {
  TOTAL_COUNT_KEY,
  extract_total_count
} from '#libs-server/data-views/extract-total-count.mjs'
import resolve_pg_field_types from '#libs-server/data-views/resolve-pg-field-types.mjs'

import { assert_data_view_sql_enabled } from './data-view-sql-kill-switch.mjs'
import validate_generated_sql, {
  quote_output_identifier
} from './validate-generated-sql.mjs'

// The execution half of the sandboxed-SQL data-view tier. Substitutable for
// get_data_view_results as the shared executor's `run_query`, which is what puts
// generated SQL inside the same bounded-concurrency admission gate, the same
// timeout policy and the same telemetry as every other data-view path rather
// than opening a fifth one around it.
//
// THE CONTROLS, and which of them is actually load-bearing:
//
//   - the parser (validate-generated-sql.mjs), rejecting writes, DDL, locking
//     clauses, non-allowlisted relations and unaliased projections. This one is
//     specific to THIS tier: its caller wrote the statement
//   - a SEPARATE connection pool held by league_data_view_reader, whose GRANTs
//     are an enumerated allowlist. Not `SET ROLE` on the main pool -- see
//     db/sandbox-pool.mjs
//   - the read-only transaction, statement timeout and EXPLAIN preflight, all
//     of which live in libs-server/sandboxed-read.mjs because the contribution
//     reproduction substrate runs inside the same envelope. Each carries a
//     non-obvious reason to be exactly what it is; that reasoning is kept in
//     one copy there rather than duplicated per caller
//   - a hard row cap applied as the outer LIMIT
//
// RESULT CACHING IS ON, and the condition it waited for has landed. It shipped
// off because get_data_view_hash knew nothing about SQL, so two different
// statements at the same offset and limit produced the SAME key and would have
// served each other's rows -- a cross-view data leak, not a performance
// question. get_data_view_hash now folds in query_id, so a cached result is
// separated by the statement that produced it.
//
// The bound on that: caching is safe for a request that arrives through
// run-query-backed-view.mjs, which HAS a query_id. A caller executing a raw
// sql_text with no persisted row has no key to separate it by and must still
// pass skip_cache.

const MAX_ROW_CAP = 10000

const SUPPORTED_OPERATORS = new Set([
  '=',
  '!=',
  '>',
  '>=',
  '<',
  '<=',
  'LIKE',
  'NOT LIKE',
  'IN',
  'NOT IN',
  'IS NULL',
  'IS NOT NULL'
])

const VALUE_FREE_OPERATORS = new Set(['IS NULL', 'IS NOT NULL'])
const LIST_OPERATORS = new Set(['IN', 'NOT IN'])

class GeneratedSqlExecutionError extends Error {
  constructor(message, { cause } = {}) {
    super(message)
    this.name = 'GeneratedSqlExecutionError'
    this.cause = cause
    // Postgres's SQLSTATE, carried up rather than buried in `cause`. A caller
    // distinguishing a statement_timeout cancellation (57014) from a privilege
    // denial (42501) is the whole reason this error exists, and reading it out
    // of a message string is not that.
    this.code = (cause && cause.code) || 'execution_error'
  }
}

// The outer clauses are built from the output aliases the parser returned, never
// from anything the caller names freely. An alias may legally contain a doubled
// double-quote, so it goes through quote_output_identifier -- interpolating the
// raw name is an injection point, and it is the only one left once the inner
// statement is wrapped.
const assert_known_alias = ({ column_id, output_aliases }) => {
  if (!output_aliases.includes(column_id)) {
    throw new GeneratedSqlExecutionError(
      `column ${column_id} is not projected by this statement`
    )
  }
}

const build_where_clause = ({ where, output_aliases }) => {
  const conditions = []
  const bindings = []

  for (const condition of where) {
    const { column_id, operator, value } = condition || {}
    assert_known_alias({ column_id, output_aliases })

    const normalized_operator = String(operator || '=').toUpperCase()
    if (!SUPPORTED_OPERATORS.has(normalized_operator)) {
      throw new GeneratedSqlExecutionError(
        `unsupported filter operator ${operator}`
      )
    }

    const quoted = quote_output_identifier(column_id)

    if (VALUE_FREE_OPERATORS.has(normalized_operator)) {
      conditions.push(`${quoted} ${normalized_operator}`)
      continue
    }

    if (LIST_OPERATORS.has(normalized_operator)) {
      const values = Array.isArray(value) ? value : [value]
      if (!values.length) {
        throw new GeneratedSqlExecutionError(
          `${normalized_operator} filter on ${column_id} has no values`
        )
      }
      conditions.push(
        `${quoted} ${normalized_operator} (${values.map(() => '?').join(', ')})`
      )
      bindings.push(...values)
      continue
    }

    conditions.push(`${quoted} ${normalized_operator} ?`)
    bindings.push(value)
  }

  return {
    clause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    bindings
  }
}

const build_order_clause = ({ sort, output_aliases }) => {
  if (!sort || !sort.length) return ''
  const terms = sort.map((entry) => {
    const { column_id, desc } = entry || {}
    assert_known_alias({ column_id, output_aliases })
    return `${quote_output_identifier(column_id)} ${desc ? 'DESC' : 'ASC'} NULLS LAST`
  })
  return `ORDER BY ${terms.join(', ')}`
}

// Wrapping the generated statement as a subquery is what keeps the existing UI
// controls working -- sort, filter and paginate apply to the OUTER query.
// Measured against PG16 across plain wraps, inner CTEs, inner UNIONs and an
// inner `ORDER BY ... LIMIT`: all four survive the wrap.
export const build_wrapped_query = ({
  sql_text,
  output_aliases,
  where = [],
  sort = [],
  offset = 0,
  limit = 500,
  calculate_total_count = true
}) => {
  const row_cap = Math.max(1, Math.min(Number(limit) || 500, MAX_ROW_CAP))
  const row_offset = Math.max(0, Number(offset) || 0)

  const { clause: where_clause, bindings } = build_where_clause({
    where,
    output_aliases
  })
  const order_clause = build_order_clause({ sort, output_aliases })

  const total_count_select = calculate_total_count
    ? `, count(*) over () as "${TOTAL_COUNT_KEY}"`
    : ''

  // The reserved column is `[a-z0-9_]` bracketed by double underscores and the
  // alias contract has already made every projected name explicit, so a
  // collision would have to be deliberate -- but the structured path asserts it
  // too, and the assertion is cheap.
  if (output_aliases.includes(TOTAL_COUNT_KEY)) {
    throw new GeneratedSqlExecutionError(
      `statement collides with reserved column ${TOTAL_COUNT_KEY}`
    )
  }

  const query_string = [
    `SELECT data_view_sandbox_query.*${total_count_select}`,
    `FROM (${sql_text}) data_view_sandbox_query`,
    where_clause,
    order_clause,
    `LIMIT ${row_cap} OFFSET ${row_offset}`
  ]
    .filter(Boolean)
    .join(' ')

  return { query_string, bindings }
}

const record_audit = async ({
  audit_writer,
  outcome,
  outcome_detail = null,
  sql_text,
  user_id,
  result_row_count = null,
  duration_milliseconds = null
}) => {
  try {
    await audit_writer('data_view_sql_audit').insert({
      outcome,
      outcome_detail,
      statement_text: sql_text,
      user_id: user_id || null,
      result_row_count,
      duration_milliseconds
    })
  } catch (error) {
    // The audit write must never be what fails a query the sandbox already
    // decided was safe, and it must never swallow itself silently either. Per
    // the repo's logging rule, anything whose log IS its audit trail uses
    // console, not debug.
    console.error(
      `data-view-sql-audit: write failed (${outcome}): ${error.message}`
    )
  }
}

/**
 * Execute one validated, sandboxed SQL statement.
 *
 * The signature is deliberately substitutable for get_data_view_results so the
 * shared executor can take it as `run_query` without a branch.
 *
 * @param {object} opts
 * @param {string} opts.sql_text
 * @param {Array<object>} [opts.where] - outer filters, keyed on output aliases
 * @param {Array<object>} [opts.sort] - outer sort, keyed on output aliases
 * @param {number} [opts.offset]
 * @param {number} [opts.limit]
 * @param {number|null} [opts.timeout] - statement timeout in ms
 * @param {boolean} [opts.calculate_total_count]
 * @param {number|null} [opts.user_id]
 * @param {object} [opts.sandbox_db] - test seam for the second pool
 * @param {object} [opts.audit_writer] - test seam for the audit write
 * @returns {Promise<{ data_view_results: Array<object>, data_view_metadata: object, data_view_fields: Array<object>, data_view_query_string: string }>}
 */
export default async function execute_generated_sql({
  sql_text,
  where = [],
  sort = [],
  offset = 0,
  limit = 500,
  timeout = null,
  calculate_total_count = true,
  user_id = null,
  sandbox_db = null,
  audit_writer = db
}) {
  await assert_data_view_sql_enabled()

  let output_aliases
  try {
    ;({ output_aliases } = await validate_generated_sql({ sql_text }))
  } catch (error) {
    await record_audit({
      audit_writer,
      outcome: 'rejected',
      outcome_detail: error.code || error.message,
      sql_text,
      user_id
    })
    throw error
  }

  const { query_string, bindings } = build_wrapped_query({
    sql_text,
    output_aliases,
    where,
    sort,
    offset,
    limit,
    calculate_total_count
  })

  const pool = sandbox_db || get_sandbox_db('data_view')
  const started_at = Date.now()

  let rows
  let fields
  try {
    ;({ rows, fields } = await run_sandboxed_read({
      pool,
      query_string,
      bindings,
      timeout
    }))
  } catch (error) {
    await record_audit({
      audit_writer,
      outcome: 'error',
      outcome_detail: `${error.code || 'unknown'}: ${error.message}`,
      sql_text,
      user_id,
      duration_milliseconds: Date.now() - started_at
    })
    throw new GeneratedSqlExecutionError(
      `sandboxed SQL execution failed: ${error.message}`,
      { cause: error }
    )
  }

  const duration_milliseconds = Date.now() - started_at

  const {
    data_view_results,
    data_view_fields: projected_fields,
    total_count
  } = extract_total_count({ rows, fields, calculate_total_count })

  await record_audit({
    audit_writer,
    outcome: 'executed',
    sql_text,
    user_id,
    result_row_count: data_view_results.length,
    duration_milliseconds
  })

  return {
    data_view_results,
    data_view_metadata: {
      ...(total_count !== null ? { total_count } : {})
    },
    // Resolved on the MAIN pool, outside the READ ONLY transaction that has now
    // committed.
    //
    // allow_unresolved, because THIS layer cannot make the decision the throw
    // demands. An OID neither the name table nor typcategory can bucket is
    // recoverable only from an authored column_annotations data_type, and this
    // executor has no annotations -- it is substitutable for
    // get_data_view_results and knows nothing about a saved view. The
    // obligation therefore moves one layer out, to
    // derive-view-from-query-result.mjs, which rejects a null data_type it has
    // no annotation for. Anything calling this executor without that deriver
    // must make the same check.
    data_view_fields: await resolve_pg_field_types({
      fields: projected_fields,
      allow_unresolved: true
    }),
    data_view_query_string: query_string
  }
}

export { GeneratedSqlExecutionError }
