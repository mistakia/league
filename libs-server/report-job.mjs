import { execFile } from 'child_process'
import { promisify } from 'util'
import { accessSync, constants } from 'fs'
import { join } from 'path'

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
//
// PROBE THE CANDIDATES rather than hardcoding one. The single `/root/...` path
// this replaced is why a league job scheduled on base-storage reported nowhere:
// that host runs jobs as `user`, whose base lives at ~/bin/base, and /root is
// not merely the wrong path there but unreadable — so the spawn ENOENTs, the
// catch logs to a cron stderr nobody reads, and the run silently never reaches
// the ledger. It worked on the league host only because that one happens to run
// as root. `accessSync` is the right probe precisely because it fails the same
// way for "absent" and "unreadable", which are the same fact for a spawn.
const BASE_CLI_CANDIDATES = [
  process.env.BASE_CLI_PATH,
  '/root/.base/bin/base',
  process.env.HOME && join(process.env.HOME, '.base/bin/base'),
  process.env.HOME && join(process.env.HOME, 'bin/base')
].filter(Boolean)

const resolve_base_cli = () => {
  for (const candidate of BASE_CLI_CANDIDATES) {
    try {
      accessSync(candidate, constants.X_OK)
      return candidate
    } catch {
      // Not present, or not executable by this uid. Either way, unusable.
    }
  }
  return null
}

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
// the job maps to a runs-primitive source (job_id) AND a base CLI is actually
// runnable; that signal auto-resolves on the next successful run. The emit-only
// log_error twin from report_error carries no dedup-to-resolution and never
// auto-clears, so emitting it alongside a resolvable twin leaves a
// permanently-open signal after a self-healing transient (e.g. the single-proxy
// pinnacle degradation) recovers and the pipeline_failure twin auto-resolves.
// Emit the log_error twin only when no resolvable failure will carry the
// outcome — i.e. an unmapped job_type or no runnable CLI, where the log_error is
// the sole escalation channel.
//
// The second condition used to be BASE_API_URL, which was wrong in the one
// direction that costs the most: absent BASE_API_URL does not mean "unreportable",
// it means "this host IS the writer". base's own job-wrapper deliberately STRIPS
// BASE_API_URL where a local base-api UDS exists, so `base run report` writes
// over that socket instead. Gating on the variable therefore made every league
// job on the writer host return before reporting — the failure did not even
// reach the log_error fallback, because the same variable suppressed that too.
// Transport selection belongs to `base run report`; this only decides whether
// there is a CLI to hand it to.
export const should_emit_log_error = ({ job_success, job_id, base_cli }) =>
  !job_success && !(job_id && base_cli)

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

  const job_report_timestamp = new Date()

  // The jobs-table row is local audit bookkeeping. Retry it through a fresh
  // pooled connection on a transient blip, but if it still fails, DO NOT throw:
  // the import's real outcome (already decided above) must reach the runs
  // primitive below regardless. A single stale-pool blip on this write must not
  // fail an otherwise-successful ~18-min import and page a pipeline_failure.
  try {
    await with_connection_retry(() =>
      db('jobs').insert({
        type: job_type,
        is_successful: job_success,
        reason: job_reason,
        run_at: job_report_timestamp
      })
    )
  } catch (err) {
    console.error(
      `report_job: jobs-table audit insert failed after retries; the import outcome is still reported to the runs primitive below: ${err.message}`
    )
  }

  const job_id = job_type_to_id[job_type]
  const base_cli = resolve_base_cli()

  if (should_emit_log_error({ job_success, job_id, base_cli })) {
    await report_error({ job_type, message: job_reason })
  }

  if (!job_id || !base_cli) {
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

  // Forward this job's cadence so the staleness sweep can compute a next
  // expected fire for it instead of falling back to the flat 3-day window. A
  // weekly or seasonal source under the flat window is effectively unmonitored:
  // it reads as stale for most of its own normal cycle.
  //
  // Until 2026-07-29 this was impossible from here -- league ran a compiled base
  // CLI predating the --schedule flag, so the cadence for league's sources had
  // to be declared writer-side in user-base config/runs-source-cadence.json
  // instead. The fleet is now uniformly on 2026.07.29, which accepts the flag.
  //
  // Cadence is taken from the environment, not inferred: the crontab is the
  // source of truth for WHEN a job runs, so the crontab line is what states it.
  // Nothing is sent when JOB_SCHEDULE is unset, which makes this safe to deploy
  // ahead of any crontab carrying it.
  //
  // NOTE for whoever adds JOB_SCHEDULE to the league crontabs: a source with
  // SEVERAL crontab lines must declare the LOOSEST of them on every one of its
  // lines, not each line's own expression. The ledger keeps one cadence per
  // source, so per-line values let whichever line ran last set the window --
  // and a too-tight window false-flags the source. That is the rule the
  // writer-side registry encodes in its authoring_rules, and it does not
  // survive a naive mechanical edit.
  // No --timezone: `base run report` resolves the reporting host's own zone as
  // of base 2026.08.03, which league now runs. It resolves one only for a cron
  // EXPRESSION, where a wall-clock time is meaningless without a zone; an
  // `every` interval is measured from the last actual run and is zone-
  // independent, and the sweep now reads a missing zone there for meaning. This
  // file used to attach a zone to every cadence, which was wrong for `every`.
  const schedule_args = []
  if (process.env.JOB_SCHEDULE) {
    schedule_args.push(
      '--schedule',
      process.env.JOB_SCHEDULE,
      '--schedule-type',
      process.env.JOB_SCHEDULE_TYPE || 'expr'
    )
  }

  try {
    await exec_file(base_cli, [...args, ...schedule_args], { timeout: 5000 })
  } catch (err) {
    // Cadence flags must never be able to break reporting. yargs .strict()
    // rejects an unknown flag with rc=1, which is how the --schedule rollout
    // killed all 31 cron:database: ledger rows for 39 hours (bulletin #48). If
    // this CLI is ever rolled back below the flag, degrade to the report that
    // always worked rather than losing the row: losing cadence costs a source
    // its precise window, losing the report costs the row entirely.
    if (schedule_args.length && /unknown argument/i.test(err.message || '')) {
      console.error('run report rejected cadence flags; retrying without them')
      try {
        await exec_file(base_cli, args, { timeout: 5000 })
        return
      } catch (retry_err) {
        console.error(`run report failed: ${retry_err.message}`)
        return
      }
    }
    console.error(`run report failed: ${err.message}`)
  }
}
