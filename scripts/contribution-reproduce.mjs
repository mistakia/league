// Contribution reproduction — the CONFIRM half of the confirm-then-distill
// substrate. Turns a bug report's captured table_state into an executed query
// and an observed result, so an agent can compare what the data view actually
// returns against what the submitter said it returned.
//
// Production is the microscope, not the artifact. What ships is the fixture the
// DISTILL step extracts afterwards; this script only establishes that the
// reported behaviour is real and reproducible.
//
// WHERE IT RUNS AND AS WHOM. Two connections, deliberately:
//
//   - the MAIN pool reads the one submission row by id. contribution_submissions
//     is excluded from every scoped reader role on purpose, so this read cannot
//     go through the sandbox.
//   - the CONTRIBUTION sandbox pool executes the reproduction query, as
//     league_contribution_reader, inside the shared read-only envelope. That
//     role cannot read public.config, cannot read any other submitter's report,
//     and holds no write grant anywhere.
//
// NOT league_reader: it is a member of pg_read_all_data, so no per-table REVOKE
// narrows it. An agent acting on an ANONYMOUS report holds this credential.
//
// NO STATEMENT GUARD ON THIS PATH, and that is not an oversight. The SQL is
// built by this repo's own query builder from a structured table_state; the
// untrusted value is the table_state, which the data-view request schema
// validates. validate-generated-sql.mjs guards the OTHER tier, whose caller
// writes the statement text, and its alias contract is one that registry SQL
// cannot satisfy -- measured 2026-08-31, all 280 stored fixtures fail it.
//
// WHAT CONFIRMING DOES NOT ESTABLISH. get_data_view_results_query silently
// DROPS a column_id it does not recognize and builds a valid query without it
// (measured 2026-08-31). So a report captured before a column was renamed
// reproduces against a query that no longer asks the reported question, and
// lands on `reproduced` or `no_rows` rather than on anything saying the
// table_state is stale. An outcome from this script is evidence about the data,
// never evidence that the captured request is still well-formed. Closing that
// needs the builder to report dropped columns.
//
// Usage:
//   NODE_ENV=production node scripts/contribution-reproduce.mjs --submission-id <uuid>
//   NODE_ENV=production node scripts/contribution-reproduce.mjs --table-state <path.json>
//   ... --sample-rows <n>   rows to include in the report (default 5)
//   ... --timeout <ms>      statement timeout, clamped by the envelope
//   ... --json              machine-readable report on stdout

import fs from 'fs'

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import is_main from '#libs-server/is-main.mjs'
import { get_data_view_results_query } from '#libs-server'
import { get_sandbox_db } from '#db/sandbox-pool.mjs'
import { run_sandboxed_read } from '#libs-server/sandboxed-read.mjs'

// The outcome vocabulary IS the deliverable of this step. Every branch below
// resolves to exactly one of these, and the distinction that matters most is
// allowlist_gap versus no_rows: both are "the query returned nothing useful",
// and only one of them means the report is not a defect.
export const REPRODUCTION_OUTCOMES = {
  reproduced: 'the query ran and returned rows to compare against the report',
  no_rows: 'the query ran and returned nothing',
  allowlist_gap: 'the query names a relation the reproduction role cannot read',
  timed_out: 'the query exceeded the sandbox statement timeout',
  generation_failed: 'the captured table_state did not produce a query',
  execution_error: 'the query failed for some other reason'
}

// Postgres SQLSTATEs this script must tell apart. Read off error.code, never
// matched against a message string.
const INSUFFICIENT_PRIVILEGE = '42501'
const QUERY_CANCELED = '57014'
const UNDEFINED_TABLE = '42P01'

/**
 * Classify a failed execution.
 *
 * THE FALSE NEGATIVE THIS EXISTS TO PREVENT. A data view reaching a relation
 * outside league_contribution_reader's enumerated allowlist fails with 42501.
 * Reported as "could not reproduce", that reads as "the submitter was wrong"
 * and the report is closed -- a wrong answer in the direction that looks like
 * success, and one nobody would think to re-check. It is a gap in the grant
 * list and it is fixed by reviewing a line in
 * db/tools/generate-reader-role-grants.mjs, not by dismissing a bug.
 *
 * @param {any} error
 * @returns {string} a key of REPRODUCTION_OUTCOMES
 */
export const classify_execution_error = (error) => {
  const code = error && (error.code || (error.cause && error.cause.code))
  if (code === INSUFFICIENT_PRIVILEGE) return 'allowlist_gap'
  if (code === QUERY_CANCELED) return 'timed_out'
  // An undefined relation on this path means the same thing operationally: the
  // query names something the reproduction cannot reach. Kept distinct from a
  // privilege denial in the detail, folded together in the outcome, because the
  // remedy is the same review of the same list.
  if (code === UNDEFINED_TABLE) return 'allowlist_gap'
  return 'execution_error'
}

/**
 * Read a submission's captured table_state from the MAIN pool.
 *
 * @param {object} opts
 * @param {string} opts.submission_id
 * @param {object} [opts.database] - test seam
 */
export const load_captured_table_state = async ({
  submission_id,
  database = db
}) => {
  const row = await database('contribution_submissions')
    .select('submission_id', 'captured_context', 'purged_at')
    .where({ submission_id })
    .first()

  if (!row) throw new Error(`no submission ${submission_id}`)
  // A purged submission has had its body and context cleared by the retention
  // routine. Reproducing from one is not merely empty, it is wrong: the row
  // still carries a status that would be updated from a result built on
  // nothing.
  if (row.purged_at) {
    throw new Error(
      `submission ${submission_id} was purged at ${row.purged_at}`
    )
  }

  const captured = row.captured_context || {}
  const table_state = captured.table_state || captured.data_view || null
  if (!table_state) {
    throw new Error(
      `submission ${submission_id} carries no table_state in captured_context; ` +
        'only a data-view or plays report can be reproduced this way'
    )
  }
  return table_state
}

/**
 * Confirm one report against production.
 *
 * @param {object} opts
 * @param {object} opts.table_state - the captured data-view request
 * @param {number} [opts.sample_rows]
 * @param {number|null} [opts.timeout]
 * @param {object} [opts.sandbox_db] - test seam for the contribution pool
 */
export const reproduce_from_table_state = async ({
  table_state,
  sample_rows = 5,
  timeout = null,
  sandbox_db = null
}) => {
  let query_string
  try {
    const { query } = await get_data_view_results_query(table_state)
    query_string = query.toString()
  } catch (error) {
    return {
      outcome: 'generation_failed',
      detail: error && error.message ? error.message : String(error),
      query_string: null
    }
  }

  const pool = sandbox_db || get_sandbox_db('contribution')
  const started_at = Date.now()

  let rows
  try {
    ;({ rows } = await run_sandboxed_read({ pool, query_string, timeout }))
  } catch (error) {
    return {
      outcome: classify_execution_error(error),
      detail: `${(error && (error.code || (error.cause && error.cause.code))) || 'unknown'}: ${error && error.message}`,
      query_string,
      duration_milliseconds: Date.now() - started_at
    }
  }

  return {
    outcome: rows.length ? 'reproduced' : 'no_rows',
    detail: null,
    query_string,
    duration_milliseconds: Date.now() - started_at,
    row_count: rows.length,
    sample: rows.slice(0, Math.max(0, sample_rows))
  }
}

// Resolves only once the bytes have actually left, so process.exit() cannot
// truncate them.
const write_stdout = (text) =>
  new Promise((resolve) => {
    if (process.stdout.write(text)) resolve()
    else process.stdout.once('drain', resolve)
  })

const main = async () => {
  const argv = yargs(hideBin(process.argv))
    .option('submission-id', { type: 'string' })
    .option('table-state', {
      type: 'string',
      description: 'path to a JSON file holding a captured table_state'
    })
    .option('sample-rows', { type: 'number', default: 5 })
    .option('timeout', { type: 'number', default: null })
    .option('json', { type: 'boolean', default: false })
    .strict()
    .parseSync()

  if (!argv['submission-id'] && !argv['table-state']) {
    throw new Error('one of --submission-id or --table-state is required')
  }
  if (argv['submission-id'] && argv['table-state']) {
    throw new Error('--submission-id and --table-state are mutually exclusive')
  }

  const table_state = argv['table-state']
    ? JSON.parse(fs.readFileSync(argv['table-state'], 'utf8'))
    : await load_captured_table_state({ submission_id: argv['submission-id'] })

  const result = await reproduce_from_table_state({
    table_state,
    sample_rows: argv['sample-rows'],
    timeout: argv.timeout
  })

  // console, not debug: this IS the audit trail of what was run against
  // production and what came back, and it must not depend on namespace
  // resolution.
  if (argv.json) {
    // Awaited, not console.log'd. stdout to a PIPE is async in node, and the
    // process.exit() below does not wait for it to drain -- measured
    // 2026-08-31, a 500-row report was truncated at 65526 bytes mid-string
    // when piped, which is the JSON oracle silently losing its tail. Same
    // dance scripts/data-view-regression-build-sql.mjs does, for this reason.
    await write_stdout(JSON.stringify(result, null, 2) + '\n')
  } else {
    console.log(
      `outcome:  ${result.outcome} -- ${REPRODUCTION_OUTCOMES[result.outcome]}`
    )
    if (result.detail) console.log(`detail:   ${result.detail}`)
    if (result.duration_milliseconds !== undefined) {
      console.log(`duration: ${result.duration_milliseconds}ms`)
    }
    if (result.row_count !== undefined) {
      console.log(`rows:     ${result.row_count}`)
      for (const row of result.sample) console.log(`  ${JSON.stringify(row)}`)
    }
  }

  // The outcome on stdout is the oracle; the exit code is a separate signal so
  // a caller that reads only one of them still cannot mistake an allowlist gap
  // for a clean non-reproduction.
  if (result.outcome === 'reproduced' || result.outcome === 'no_rows') return 0
  return 2
}

if (is_main(import.meta.url)) {
  main()
    .then(async (code) => {
      await db.destroy()
      process.exit(code)
    })
    .catch(async (error) => {
      process.stderr.write(
        `fatal: ${error && error.stack ? error.stack : error}\n`
      )
      await db.destroy()
      process.exit(1)
    })
}
