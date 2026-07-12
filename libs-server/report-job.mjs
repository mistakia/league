import { execFile } from 'child_process'
import { promisify } from 'util'

import db from '#db'

import report_error from './report-error.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'

const exec_file = promisify(execFile)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// A long import (~18 min) can outlive the pooled connection reserved for its
// terminal audit write: the server closes it on idle timeout, or a transient
// network blip half-opens the socket. The subsequent `db('jobs').insert` then
// fails during connection acquisition — a KnexTimeoutError carrying
// `sql: undefined, bindings: undefined`, not a query error — or with a
// pg-level connection-reset code. This predicate classifies exactly that
// transient connection class so the retry below never masks a genuine query
// failure (constraint violation, bad column, etc.). See
// user:task/league/harden-report-job-terminal-jobs-insert.md (signal 120514).
const CONNECTION_ERROR_CODES = new Set([
  'ECONNRESET',
  'EPIPE',
  'ETIMEDOUT',
  'ENOTFOUND',
  'ECONNREFUSED',
  '08000', // connection_exception
  '08001', // sqlclient_unable_to_establish_sqlconnection
  '08003', // connection_does_not_exist
  '08004', // sqlserver_rejected_establishment_of_sqlconnection
  '08006', // connection_failure
  '08007', // transaction_resolution_unknown
  '57P01', // admin_shutdown
  '57P02', // crash_shutdown
  '57P03' // cannot_connect_now
])

const CONNECTION_ERROR_PATTERNS = [
  'connection terminated',
  'connection ended',
  'connection closed',
  'connection is not open',
  'server closed the connection',
  'socket hang up'
]

export const is_connection_error = (err) => {
  if (!err) return false
  // KnexTimeoutError: pool could not hand out a live connection in time.
  if (err.name === 'KnexTimeoutError') return true
  if (err.code && CONNECTION_ERROR_CODES.has(err.code)) return true
  const message = String(err.message || '').toLowerCase()
  return CONNECTION_ERROR_PATTERNS.some((pattern) => message.includes(pattern))
}

const CONNECTION_RETRY_ATTEMPTS = 3
const CONNECTION_RETRY_DELAY_MS = 1000

// Run a DB operation, retrying only on connection-class errors. Each retry
// re-issues the query, so knex re-acquires from the pool — tarn discards the
// connection that just errored, so the retry lands on a fresh one. Non-connection
// errors throw immediately (no masking); the bound caps a genuine outage.
export const with_connection_retry = async (
  operation,
  {
    attempts = CONNECTION_RETRY_ATTEMPTS,
    delay_ms = CONNECTION_RETRY_DELAY_MS
  } = {}
) => {
  let last_error
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation()
    } catch (err) {
      last_error = err
      if (!is_connection_error(err) || attempt === attempts) {
        throw err
      }
      console.error(
        `report_job: connection-class error on attempt ${attempt}/${attempts}, retrying in ${delay_ms}ms: ${err.message}`
      )
      await sleep(delay_ms)
    }
  }
  throw last_error
}

// Resolve base by absolute path, not bare `base` on PATH: the pm2 worker process
// env does not include ~/.base/bin, so a bare `base` spawn ENOENTs and every run
// report is silently lost. Mirrors report-run-outcome.mjs and the base
// job-wrapper.sh absolute-path resolution. See user:text/base/machine-token-auth.md.
const BASE_CLI = process.env.BASE_CLI_PATH || '/root/.base/bin/base'

const build_job_type_to_id = () => {
  const map = {}
  for (const [name, value] of Object.entries(job_types)) {
    if (value in map) {
      throw new Error(
        `duplicate job_type value ${value} for ${name} (conflicts with existing entry)`
      )
    }
    map[value] = `league-${name.toLowerCase().replace(/_/g, '-')}`
  }
  return map
}

const job_type_to_id = build_job_type_to_id()

// A resolvable pipeline_failure is emitted below via `base run report` only when
// the job maps to a runs-primitive source (job_id) AND the base API URL is
// configured; that signal auto-resolves on the next successful run. The
// emit-only log_error twin from report_error carries no dedup-to-resolution and
// never auto-clears, so emitting it alongside a resolvable twin leaves a
// permanently-open signal after a self-healing transient (e.g. the single-proxy
// pinnacle degradation) recovers and the pipeline_failure twin auto-resolves.
// Emit the log_error twin only when no resolvable failure will carry the
// outcome — i.e. an unmapped job_type or an unconfigured API URL, where the
// log_error is the sole escalation channel.
export const should_emit_log_error = ({ job_success, job_id, api_url }) =>
  !job_success && !(job_id && api_url)

export default async function report_job({
  job_type,
  job_success = true,
  job_reason = null,
  error = null
}) {
  if (!job_type) {
    throw new Error('job_type is required')
  }

  if (error) {
    job_reason = error.message
    job_success = false
  }

  const job_report_timestamp = Math.round(Date.now() / 1000)

  // The jobs-table row is local audit bookkeeping. Retry it through a fresh
  // pooled connection on a transient blip, but if it still fails, DO NOT throw:
  // the import's real outcome (already decided above) must reach the runs
  // primitive below regardless. A single stale-pool blip on this write must not
  // fail an otherwise-successful ~18-min import and page a pipeline_failure.
  try {
    await with_connection_retry(() =>
      db('jobs').insert({
        type: job_type,
        succ: job_success,
        reason: job_reason,
        timestamp: job_report_timestamp
      })
    )
  } catch (err) {
    console.error(
      `report_job: jobs-table audit insert failed after retries; the import outcome is still reported to the runs primitive below: ${err.message}`
    )
  }

  const job_id = job_type_to_id[job_type]
  const api_url = process.env.BASE_API_URL

  if (should_emit_log_error({ job_success, job_id, api_url })) {
    await report_error({ job_type, message: job_reason })
  }

  if (!job_id || !api_url) {
    return
  }

  const source = process.env.JOB_SCHEDULE_ENTITY_URI || `service:${job_id}`
  const outcome = job_success ? 'success' : 'failure'

  // Single canonical client: `base run report` owns transport + machine-token
  // auth + host identity. The local jobs-table insert and Slack error report
  // above are league-specific side effects and stay. No hand-rolled
  // sign-token+curl. See user:text/base/machine-token-auth.md.
  const args = [
    'run',
    'report',
    '--source',
    source,
    '--outcome',
    outcome,
    '--exit-code',
    job_success ? '0' : '1'
  ]
  if (job_reason) args.push('--reason', job_reason)

  try {
    await exec_file(BASE_CLI, args, { timeout: 5000 })
  } catch (err) {
    console.error(`run report failed: ${err.message}`)
  }
}
