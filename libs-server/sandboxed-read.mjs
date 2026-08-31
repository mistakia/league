// @ts-check

// The execution envelope every sandboxed read runs inside. Shared by the
// data-view generated-SQL tier (libs-server/data-views/generation/execute-generated-sql.mjs)
// and the contribution reproduction substrate (scripts/contribution-reproduce.mjs).
//
// It lives in ONE copy because each control below is load-bearing, each has a
// non-obvious reason to be exactly what it is, and every one of them fails in
// the direction that looks like success. A second copy would drift, and the
// drift would be silent.
//
// THE CONTROLS:
//
//   - `SET TRANSACTION READ ONLY`, issued as the FIRST statement in the
//     transaction, because Postgres refuses it once the transaction has done
//     any work. NOT `SET LOCAL default_transaction_read_only`, which is a
//     measured no-op for the statement it would guard: that setting applies
//     only at transaction start, so setting it inside a BEGIN leaves
//     transaction_read_only at `off` and a subsequent INSERT succeeds.
//
//   - `SET LOCAL statement_timeout`, clamped below the server's measured 30s
//     baseline so the sandbox's own timeout is what cancels a runaway
//     statement -- with a diagnosable error naming the sandbox -- rather than
//     the server-wide one.
//
//   - a plain `EXPLAIN` preflight. Plain EXPLAIN does not execute; EXPLAIN
//     ANALYZE does, on both a volatile side-effecting function and a CTE
//     containing an INSERT, so it is never used here. The preflight is what
//     makes a privilege denial surface before execution rather than midway
//     through it.
//
// WHAT IS DELIBERATELY NOT HERE. The statement guard
// (validate-generated-sql.mjs), the outer subquery wrap and the row cap are
// specific to untrusted agent-authored SQL, whose threat model is a caller that
// wrote the statement. A caller whose SQL is built by the repo's own query
// builder from structured input has a different threat model and must not be
// forced through the alias contract, which it was never written to satisfy.
//
// WHAT THE CALLER MUST STILL SUPPLY. This envelope bounds what a statement can
// DO; it does not bound what the connection can REACH. That is the pool's role
// and its enumerated GRANTs -- see db/sandbox-pool.mjs for why a separate
// login role rather than `SET ROLE` on the main pool.

// The measured server baseline is 30s.
export const MAX_STATEMENT_TIMEOUT_MS = 25000
export const DEFAULT_STATEMENT_TIMEOUT_MS = 20000

/**
 * Clamp a caller-supplied timeout into the sandbox's own band.
 *
 * @param {number|null|undefined} timeout
 * @returns {number}
 */
export const resolve_statement_timeout_ms = (timeout) =>
  Math.min(
    Number(timeout) || DEFAULT_STATEMENT_TIMEOUT_MS,
    MAX_STATEMENT_TIMEOUT_MS
  )

/**
 * Execute one statement inside the sandbox's read-only envelope.
 *
 * Returns the raw driver response rather than a shaped result, because the two
 * callers shape it differently and neither shape belongs to the envelope.
 *
 * @param {object} opts
 * @param {import('knex').Knex} opts.pool - a sandbox pool, never the main one
 * @param {string} opts.query_string
 * @param {Array<any>} [opts.bindings]
 * @param {number|null} [opts.timeout] - statement timeout in ms, clamped
 * @returns {Promise<{ rows: Array<object>, fields: Array<object> }>}
 */
export const run_sandboxed_read = async ({
  pool,
  query_string,
  bindings = [],
  timeout = null
}) => {
  const statement_timeout_ms = resolve_statement_timeout_ms(timeout)

  return pool.transaction(async (trx) => {
    // FIRST statement in the transaction, and it must be.
    await trx.raw('SET TRANSACTION READ ONLY')
    // Not parameterized because SET does not take a binding on the extended
    // protocol; the value is an integer this module computed, never
    // caller-supplied text.
    await trx.raw(`SET LOCAL statement_timeout = ${statement_timeout_ms}`)

    await trx.raw(`EXPLAIN ${query_string}`, bindings)

    // Filter VALUES are bound, never interpolated. Note what binding does NOT
    // buy: a statement with no filters carries an empty bindings array, and
    // `pg.query(sql, [])` stays on the SIMPLE protocol, which executes every
    // statement in the string -- measured with a positive control that dropped
    // the victim table. So the control against multi-statement injection is the
    // caller's own single-statement rule, never the protocol, and it cannot be
    // otherwise: a binding cannot be forced into arbitrary generated SQL.
    const response = await trx.raw(query_string, bindings)
    // Returned from inside the transaction rather than assigned to an outer
    // binding: knex resolves transaction() with the callback's value, and a
    // caller that read an outer `let` could not distinguish "the transaction
    // rolled back" from "the query returned nothing".
    return { rows: response.rows, fields: response.fields }
  })
}
