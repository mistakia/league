import { execFile } from 'child_process'
import fs from 'fs'
import { promisify } from 'util'

import db from '#db'

import report_error from './report-error.mjs'
import { resolve_base_cli } from './resolve-base-cli.mjs'
import { should_report_run_to_ledger } from './should-report-run-to-ledger.mjs'
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

// Retrievable evidence for a failure, per the signal-emission contract's
// `file:///var/log/<service>.log` form. The signal already carries the host in
// its own column, so the link is a path and nothing else.
//
// DERIVED FROM THIS PROCESS'S OWN STDOUT, not from a variable someone has to
// remember to set. Every league crontab line already ends in
// `>> /var/log/league/<name>.log 2>&1`, so the log path is a fact about the fd
// the kernel handed us, and /proc/self/fd/1 is where that fact is readable. An
// env var restating it would be a second copy of a value already on the line,
// free to drift from the redirect it duplicates -- and a forensic link that
// points at the wrong file is worse than none, because it is believed.
//
// This also gets the case the incident actually had: finalize_game runs INSIDE
// import-plays-nfl-v1, so its output lands in the CALLER's log
// (/var/log/league/import-plays-preseason.log) and nothing finalize-game knows
// about itself could name that file. The inherited fd does.
//
// Not every run is redirected. Under a tty or a pipe the link resolves to
// `pipe:[345995878]` or `/dev/pts/0` rather than a path, which is not evidence
// anyone can retrieve later, so anything not absolute is dropped. Both shapes
// verified on digitalocean-0.
export const resolve_log_forensic_link = ({
  read_link = (path) => fs.readlinkSync(path)
} = {}) => {
  try {
    const target = read_link('/proc/self/fd/1')
    // `pipe:[...]`, `socket:[...]`, `/dev/pts/0` and `/dev/null` are all
    // reachable here and none of them is retrievable evidence.
    if (!target.startsWith('/') || target.startsWith('/dev/')) return null
    return `file://${target}`
  } catch {
    // No procfs (macOS, a container without /proc) -- not an error, just no link.
    return null
  }
}

// `--reason` is an ARGV element, and argv is a fixed-size kernel budget shared
// by the whole command. A knex insert that fails renders every bind parameter
// into error.message, so a batch of a few thousand rows produces a megabytes-
// long reason and `base run report` dies with E2BIG -- the job's failure is
// then never recorded at all. That is strictly worse than the failure it was
// trying to report: the runs ledger keeps the last SUCCESS, the job reads as
// silent rather than failing, and it surfaces days later as a stale-run signal
// pointing at the wrong thing entirely.
//
// Both ends are kept because the two error dialects put their meaning at
// opposite ends: the application message leads, while postgres puts the part
// that names the defect ("column ... does not exist") after the parameter list.
const REASON_ARGV_LIMIT = 4000
const bound_reason_for_argv = (reason) => {
  if (reason.length <= REASON_ARGV_LIMIT) return reason
  const keep = Math.floor((REASON_ARGV_LIMIT - 80) / 2)
  return `${reason.slice(0, keep)}\n... [${reason.length - keep * 2} characters elided to fit the argv limit] ...\n${reason.slice(-keep)}`
}

// The reason a wrapped job failed, stated on stderr in a form job-wrapper.sh
// can find by name rather than by position.
//
// job-wrapper.sh builds a run report's `--reason` from `tail -c 500` of the
// job's stderr, and BOTH halves of that are load-bearing here:
//
//   stderr -- ~190 scripts under scripts/ and private/scripts/ print their
//   caught error with `console.log(error)` or a debug `log(error)`, both of
//   which go to STDOUT, which the wrapper does not read. Fixing that script by
//   script is 190 edits that each re-open on the next copy-paste.
//
//   the TAIL -- and this is the half that makes a per-script fix insufficient
//   on its own. Every one of those scripts calls report_job AFTER logging its
//   error, and this function writes to stderr on the way through: two retry
//   lines plus the audit-insert line are 265 bytes before any err.message, so a
//   single KnexTimeoutError round (~106 bytes each) overflows the 500-byte
//   window and pushes the real error out of it. The chatter is a red herring by
//   construction -- the audit insert's failure is CAUGHT and non-fatal -- and it
//   wins the tail precisely when it is noisiest, which is during the database
//   outage that caused the failure being reported. That is what happened to
//   signals 128346 and 128347 on 2026-09-04: the reason field named a harmless
//   condition, the real failure was absent, and triage read the wrong cause
//   first.
//
// A named sentinel is immune to both. The wrapper greps for it and uses it in
// preference to the tail, so ordering and volume stop mattering, and every
// caller of report_job is fixed at once without touching any of them. Same
// contract shape as the REAUTH_REQUIRED sentinel the wrapper already reads.
//
// Single line, because the wrapper takes one line: real error messages are
// routinely multi-line (a postgres error puts the part naming the defect on a
// later line), and a raw newline here would truncate the reason at the first
// one and hide exactly that part.
const FAILURE_SENTINEL = 'JOB_FAILURE_REASON'
const SENTINEL_REASON_LIMIT = 1000
export const emit_failure_sentinel = (
  reason,
  { write = (line) => console.error(line) } = {}
) => {
  const collapsed = String(reason ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!collapsed) return null
  const bounded =
    collapsed.length <= SENTINEL_REASON_LIMIT
      ? collapsed
      : `${collapsed.slice(0, SENTINEL_REASON_LIMIT)} ... [truncated]`
  const line = `${FAILURE_SENTINEL}: ${bounded}`
  write(line)
  return line
}

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

  // Before anything below can write to stderr, so the sentinel is present even
  // if this function dies partway through.
  if (!job_success) {
    emit_failure_sentinel(job_reason)
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
      `report_job: jobs-table audit insert failed after retries; this does not affect where the import outcome is reported below: ${err.message}`
    )
  }

  const job_id = job_type_to_id[job_type]

  // Ahead of BOTH escalation channels: an ad-hoc run must not open a
  // pipeline_failure and must not fall through to the log_error twin either.
  // The jobs-table row above is local audit and still records the run, which is
  // what a hand-run invocation should leave behind. The operator who typed the
  // command is reading its stderr, so the error already has a reader.
  if (!should_report_run_to_ledger({ node_env: process.env.NODE_ENV })) {
    console.error(
      `report_job: NODE_ENV=${process.env.NODE_ENV || '(unset)'} is not production, so this run is not a declared pipeline execution; skipping the runs-ledger report for ${job_id || `job_type ${job_type}`}. Run under NODE_ENV=production if this was meant to be a real pipeline run.`
    )
    return
  }

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
  if (job_reason) args.push('--reason', bound_reason_for_argv(job_reason))

  const forensic_args = []
  const forensic_link = job_success ? null : resolve_log_forensic_link()
  if (forensic_link) {
    forensic_args.push('--forensic-link', forensic_link)
  }

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

  // Every ENRICHMENT flag degrades together. `--forensic-link` joins the cadence
  // flags here rather than going onto `args`, because the fallback below re-runs
  // `args` verbatim: a flag placed there would be re-sent by the very retry that
  // exists to drop it, and the row would be lost on any CLI that does not know
  // it -- turning a diagnosability nicety into the outage it was meant to fix.
  const optional_args = [...forensic_args, ...schedule_args]

  try {
    await exec_file(base_cli, [...args, ...optional_args], { timeout: 5000 })
  } catch (err) {
    // Enrichment flags must never be able to break reporting. yargs .strict()
    // rejects an unknown flag with rc=1, which is how the --schedule rollout
    // killed all 31 cron:database: ledger rows for 39 hours (bulletin #48). If
    // this CLI is ever rolled back below a flag, degrade to the report that
    // always worked rather than losing the row: losing cadence or a log pointer
    // costs context, losing the report costs the row entirely.
    if (optional_args.length && /unknown argument/i.test(err.message || '')) {
      console.error(
        'run report rejected enrichment flags; retrying without them'
      )
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
