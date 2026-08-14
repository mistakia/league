/*
  The runner for the registered data checks.

  It iterates db/checks/registry.mjs, grades each check through the shared
  classifier in libs-server/data-check.mjs, and carries every finding out on a
  self-closing signal with a pinned dedup key. The design rules are canonical in
  user:guideline/software/design-data-checks.md.

  ## The exit code carries DETECTOR HEALTH only

  A finding is never a red run. A red run means a check could not be trusted to
  answer: it threw, its gradeable population collapsed below its declared floor,
  or its finding failed to reach the signal queue. Collapsing the two would make
  a true finding and a broken monitor the same row in the runs ledger, and the
  failure is asymmetric -- a detector reporting healthy through a real problem
  escalates nothing, while a detector that cannot run at least says so.

  This is the disposition the cluster-gate runner does NOT share, which is why
  these live beside `db/gates/` rather than inside it: there a finding fails the
  whole run, and one runner cannot hold both rules.

  ## Dedup keys

  Two conditions per check, each with its own pinned key so one can close while
  the other stands:

    log_error:<service>:data-check-findings-<check_id>
    log_error:<service>:data-check-ungradeable-<check_id>

  They ride `log_error` with a `fingerprint_override` rather than a `data_check`
  signal kind, which is the convention the retired route-share coverage audit
  already used with its two pinned fingerprints. A dedicated kind would mean a
  KIND_REGISTRY arm, a signal-kind entity and its own triage treatment, and it
  buys nothing until this earns one.

  Pinning is what makes the pair work at all: the message text carries counts
  that move every run, so a computed fingerprint would open a fresh row per run
  and none of them could ever be closed by the resolve arm.

  A check REMOVED from the registry takes its two keys' only closers with it.
  Resolve both by hand in the same change, or any row open at deletion becomes
  permanently un-closeable.

  ## What each condition means

  FINDINGS -- graded rows below the threshold that no parked entry suppresses,
  OR parked entries that suppressed nothing. The second belongs on this key
  rather than in a log line for the reason the guideline gives: a parked item
  must resurface when it stops applying, and a console line on a cron job
  reaches nobody. The payload separates them.

  UN-GRADEABLE -- the scan did not reach its corpus. Coverage collapse must be
  as loud as a finding, so it is BOTH: the signal names which check and how far
  it fell, and the throw makes the run red. An emptied predicate reports zero
  findings and reads exactly like a clean sweep otherwise.

  Two detectors answer that one question, so they share one key. The gradeable
  population can fall below `min_gradeable_units`, which is the whole story for
  a check whose row count tracks its coverage. It does NOT track coverage on a
  check that emits a fixed-size result set -- one sentinel row per child table,
  or one aggregate row -- where the row count is a constant and only the
  DENOMINATOR moves. Those declare `min_denominator`, read against the smallest
  graded population so a collapsed sub-population cannot hide behind a healthy
  sibling.

  ## A failed emit is detector ill-health

  Both `create_logger().error` and `resolve_signal` return null on every failure
  mode and never throw -- unreachable API, missing machine key, unregistered
  slug. A finding can therefore fail to reach the queue on a leaf host while the
  run still exits 0, which is the mute-oracle shape this whole system exists to
  avoid. Every emit and every resolve is inspected, and a failure turns the run
  red.

  The resolve arm needs one more check than the emit arm, because null is not
  its only failure. `resolve_signal` returns null only when it could not POST;
  a resolve that REACHED the route and closed nothing comes back TRUTHY as
  `{ resolved: false, reason }`. Exactly one reason is benign -- the route
  answers a clean run that had nothing open with `no_open_signal` -- and the
  rest (`missing_dedup_key`, `update_failed`, `writer_unreachable`) leave a row
  open that the run believed it had closed.
*/

import debug from 'debug'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { is_main, report_job, resolve_signal } from '#libs-server'
import { classify_check_rows, load_parked } from '#libs-server/data-check.mjs'
import { create_logger } from '#libs-shared/log.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'
import registry from '#db/checks/registry.mjs'

const log = debug('run-data-checks')
if (!process.env.DEBUG) {
  debug.enable('run-data-checks')
}

const SERVICE = 'league-host'

const signal_log = create_logger('run-data-checks', { service: SERVICE })

const PARKED_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'db',
  'checks',
  'parked.json'
)

const findings_fingerprint = (check_id) => `data-check-findings-${check_id}`
const ungradeable_fingerprint = (check_id) =>
  `data-check-ungradeable-${check_id}`
const dedup_key_for = (fingerprint) => `log_error:${SERVICE}:${fingerprint}`

// Thrown when a check's gradeable population falls below its declared floor.
// Distinct from an arbitrary throw out of a check's query so the report can
// tell coverage collapse from a crashed detector -- both are ill-health, but
// they are different repairs.
class CoverageCollapseError extends Error {
  constructor(message) {
    super(message)
    this.name = 'CoverageCollapseError'
  }
}

/**
 * Emit one condition. Returns false when the signal did not reach the queue,
 * which the caller treats as detector ill-health rather than as success.
 */
const emit_condition = async ({ fingerprint, message, severity, context }) => {
  const emitted = signal_log.error(new Error(message), {
    severity,
    fingerprint_override: fingerprint,
    context
  })

  // null here means the logger declined before any transport: no
  // signals_api_url, no BASE_MACHINE_SLUG, no instance key, or a suppressed
  // fingerprint. All of them are a finding that never reached anyone.
  if (!emitted) {
    console.error(
      `EMIT FAILED ${fingerprint}: the logger declined to send (signals API url, machine slug or instance key unavailable)`
    )
    return false
  }

  const response = await emitted.promise
  if (!response || !response.ok) {
    console.error(
      `EMIT FAILED ${fingerprint}: signal POST did not succeed (${response ? response.status : 'no response'})`
    )
    return false
  }

  return true
}

// The one resolve outcome that is NOT a failure: the route answers a clean run
// with `{ resolved: false, reason: 'no_open_signal' }` when nothing was open,
// which is the ordinary case and must stay green. Every other reason the
// resolver emits -- `missing_dedup_key`, `update_failed`, `writer_unreachable`
// -- leaves a row open that this run believed it closed.
const BENIGN_RESOLVE_REASON = 'no_open_signal'

/**
 * Close one condition on the verifiably clean branch.
 *
 * Gated on the OBSERVED clean state by the caller, never on an in-process "did
 * I emit" latch: this is a fresh process every run, so a latch could only ever
 * strand the open signal. The route is a cheap no-op when nothing is open.
 *
 * Inspect the RESULT, not just the null. `resolve_signal` returns null only
 * when it could not POST at all; a resolve that REACHED the route and closed
 * nothing comes back truthy as `{ resolved: false, reason }`, so a null check
 * alone reports a stale open row as a successful close. That is the same blind
 * spot base's own resolvers carry a comment about -- it left signal #123654
 * open for seven hours with nothing in any log -- and it is exactly the
 * mute-oracle shape the emit arm of this file already guards against.
 */
const resolve_condition = async ({ fingerprint, resolution_note }) => {
  const result = await resolve_signal({
    dedup_key: dedup_key_for(fingerprint),
    resolution_note
  })

  if (!result) {
    console.error(
      `RESOLVE FAILED ${fingerprint}: the signals API did not answer, so a stale open row may survive a clean run`
    )
    return false
  }

  if (!result.resolved && result.reason !== BENIGN_RESOLVE_REASON) {
    console.error(
      `RESOLVE FAILED ${fingerprint}: the signals API answered but closed nothing (reason ${result.reason || 'unknown'}), so a stale open row survives a clean run`
    )
    return false
  }

  return true
}

const format_grain = ({ check, row }) =>
  check.grain
    .map((column) => `${column}=${JSON.stringify(row[column])}`)
    .join(' ')

/**
 * Sample findings SPREAD across the cohort rather than taken newest-first, so
 * the payload shows the shape of the population instead of one corner of it.
 */
const spread_sample = ({ rows, size }) => {
  if (rows.length <= size) return rows
  const step = rows.length / size
  return Array.from(
    { length: size },
    (_, index) => rows[Math.floor(index * step)]
  )
}

const SAMPLE_SIZE = 10

/**
 * Why this check's scan should be treated as not having reached its corpus, or
 * null when it did. Two detectors for ONE condition, which is why they share
 * the un-gradeable dedup key rather than splitting it.
 *
 * The row-count floor alone is blind on a check whose result set is fixed by
 * construction. `gamelog-orphans` emits one sentinel row per child table
 * whether that table holds 137,900 rows or zero, so its gradeable count is
 * always at least 4 and `min_gradeable_units` can never fire — an emptied
 * table would report zero findings, pass the floor and RESOLVE the findings
 * key. `min_denominator` is what sees that, and it reads the SMALLEST scanned
 * population rather than the largest so one collapsed sub-population cannot
 * hide behind a healthy sibling.
 */
const collapse_reason = ({ check, graded, smallest_denominator }) => {
  if (graded < check.min_gradeable_units) {
    return `graded only ${graded} unit(s) against a floor of ${check.min_gradeable_units}`
  }

  if (
    check.min_denominator !== undefined &&
    smallest_denominator < check.min_denominator
  ) {
    return `scanned only ${smallest_denominator} row(s) in its smallest graded population, against a floor of ${check.min_denominator}`
  }

  return null
}

/**
 * Grade one check and carry its two conditions to the signal queue.
 *
 * Returns the classification plus whether every emit reached the queue. Throws
 * only on ill-health: a crash out of the check's own `rows`, or coverage
 * collapse below either declared floor.
 */
export const run_check = async ({ check, parked }) => {
  const rows = await check.rows()
  const result = classify_check_rows({ rows, check, parked })

  const graded = result.gradeable.length
  const ungradeable = result.ungradeable.length
  const denominators = result.gradeable.map((row) => row.denominator)
  const largest_denominator = denominators.length
    ? Math.max(...denominators)
    : 0
  const smallest_denominator = denominators.length
    ? Math.min(...denominators)
    : 0

  console.log(
    `${check.check_id}: ${graded} graded, ${ungradeable} un-gradeable, ${result.findings.length} findings, ${result.adjudicated.length} adjudicated, ${result.baselined.length} baselined, ${result.stale_parked.length} parked-but-suppressing-nothing (scanned population ${smallest_denominator}-${largest_denominator})`
  )

  // Both floors are checked BEFORE any grading verdict is emitted or resolved.
  // A collapsed scan reports zero findings, so resolving the findings key here
  // would close a real open signal on the strength of a detector that is not
  // reaching its corpus.
  const collapsed = collapse_reason({ check, graded, smallest_denominator })

  if (collapsed) {
    const message = `${check.check_id} ${collapsed} (${graded} graded, ${ungradeable} un-gradeable, scanned population ${smallest_denominator}-${largest_denominator}). The scan is not reaching its corpus, so its zero findings mean nothing.`

    const emit_ok = await emit_condition({
      fingerprint: ungradeable_fingerprint(check.check_id),
      message,
      severity: 'high',
      context: {
        check_id: check.check_id,
        gradeable_units: graded,
        min_gradeable_units: check.min_gradeable_units,
        ungradeable_units: ungradeable,
        smallest_denominator,
        largest_denominator,
        min_denominator: check.min_denominator ?? null,
        ungradeable_sample: spread_sample({
          rows: result.ungradeable,
          size: SAMPLE_SIZE
        })
      }
    })

    const error = new CoverageCollapseError(message)
    error.emit_ok = emit_ok
    throw error
  }

  let emits_ok = await resolve_condition({
    fingerprint: ungradeable_fingerprint(check.check_id),
    resolution_note: `[Fix] ${check.check_id} graded ${graded} unit(s), at or above its floor of ${check.min_gradeable_units}`
  })

  const findings = result.findings
  const stale = result.stale_parked

  if (findings.length || stale.length) {
    const summary = findings.length
      ? spread_sample({ rows: findings, size: SAMPLE_SIZE })
          .map(
            (row) =>
              `${format_grain({ check, row })} at ${row.numerator}/${row.denominator}`
          )
          .join('; ')
      : 'none'

    const message = [
      `${check.check_id}: ${findings.length} finding(s) over ${graded} graded unit(s)`,
      stale.length
        ? ` and ${stale.length} parked entr(ies) suppressing nothing`
        : '',
      `. ${check.invariant}`,
      findings.length ? ` Sample: ${summary}.` : '',
      ` Repair: ${check.repair_command}`
    ].join('')

    const emit_ok = await emit_condition({
      fingerprint: findings_fingerprint(check.check_id),
      message,
      severity: 'medium',
      context: {
        check_id: check.check_id,
        gradeable_units: graded,
        ungradeable_units: ungradeable,
        finding_count: findings.length,
        adjudicated_count: result.adjudicated.length,
        baselined_count: result.baselined.length,
        findings: spread_sample({ rows: findings, size: SAMPLE_SIZE }),
        // A parked entry that suppresses nothing rides this key deliberately:
        // it must RESURFACE when it stops applying, and a console line on a
        // cron job reaches nobody.
        parked_suppressing_nothing: stale,
        repair_command: check.repair_command
      }
    })

    emits_ok = emits_ok && emit_ok

    for (const row of findings) {
      console.log(
        `  FINDING ${check.check_id} ${format_grain({ check, row })} ${row.numerator}/${row.denominator}`
      )
    }
    for (const entry of stale) {
      console.log(
        `  PARKED-STALE ${check.check_id} ${JSON.stringify(entry.grain)} (${entry.disposition}) suppressed nothing this run`
      )
    }
  } else {
    const resolve_ok = await resolve_condition({
      fingerprint: findings_fingerprint(check.check_id),
      resolution_note: `[Fix] ${check.check_id} found nothing unsuppressed across ${graded} graded unit(s), and every parked entry still applies`
    })
    emits_ok = emits_ok && resolve_ok
  }

  // Debt is a number to watch shrinking; an adjudication is expected to be
  // stable. Report them apart even though they suppress identically.
  if (result.baselined.length) {
    console.log(
      `  BASELINED ${check.check_id}: ${result.baselined.length} known standing debt row(s) suppressed`
    )
  }

  return { result, emits_ok }
}

const run_data_checks = async () => {
  const parked = load_parked({
    entries: JSON.parse(fs.readFileSync(PARKED_PATH, 'utf8')),
    checks_by_id: new Map(registry.map((check) => [check.check_id, check]))
  })

  const crashed = []
  const collapsed = []
  const emit_failures = []
  let total_findings = 0

  // Each check is isolated: one throwing check must not suppress the others,
  // or a single broken query silently turns the whole registry into a green
  // run over four checks that never executed.
  for (const check of registry) {
    try {
      const { result, emits_ok } = await run_check({ check, parked })
      total_findings += result.findings.length + result.stale_parked.length
      if (!emits_ok) emit_failures.push(check.check_id)
    } catch (err) {
      log(err)
      if (err instanceof CoverageCollapseError) {
        collapsed.push(check.check_id)
        if (!err.emit_ok) emit_failures.push(check.check_id)
        console.error(`COVERAGE COLLAPSE ${check.check_id}: ${err.message}`)
      } else {
        crashed.push(check.check_id)
        console.error(`CRASHED ${check.check_id}: ${err.message}`)
      }
    }
  }

  console.log(
    `run-data-checks: ${registry.length} checks, ${total_findings} finding(s), ${crashed.length} crashed, ${collapsed.length} below coverage floor, ${emit_failures.length} with a failed emit`
  )

  const unhealthy = [
    crashed.length ? `crashed: ${crashed.join(', ')}` : null,
    collapsed.length ? `below coverage floor: ${collapsed.join(', ')}` : null,
    emit_failures.length
      ? `emit did not reach the queue: ${[...new Set(emit_failures)].join(', ')}`
      : null
  ].filter(Boolean)

  return { total_findings, unhealthy }
}

const main = async () => {
  let error
  try {
    const { unhealthy } = await run_data_checks()
    if (unhealthy.length) {
      error = new Error(`detector ill-health -- ${unhealthy.join('; ')}`)
      console.error(`DETECTOR ILL-HEALTH: ${unhealthy.join('; ')}`)
    }
  } catch (err) {
    error = err
    log(error)
    console.error(`RUNNER ERROR: ${error.message}`)
  }

  await report_job({
    job_type: job_types.AUDIT_DATA_CHECKS,
    error
  })

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default run_data_checks
