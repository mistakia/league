// Output oracle for the PrizePicks props import.
//
// Until this existed the import declared success on "main() did not throw",
// which is the silent-no-op shape in user:guideline/surface-pipeline-failures.md
// and was not theoretical here. Between 2026-06-01 and 2026-09-01 the runs
// ledger recorded 87 runs of job_type 57 and ZERO failures, while
// prop_markets_index shows PrizePicks wrote no row at all until
// 2026-09-01 08:00. Roughly forty of those "successful" runs did nothing: the
// seasonal guard returned early, report_job saw no error, and a skip was
// written to the ledger as an import.
//
// So the first thing this oracle does is separate the three states the exit
// code collapsed into one.
//
//   OUT OF SEASON -- a legitimate skip. Passes, but says so, and says it in the
//     summary rather than by looking identical to a run that imported 4,094
//     markets. This is the TIME half: the same run that is correct in February
//     is a total failure in October, and only the calendar distinguishes them.
//   IN SEASON, NOTHING FETCHED -- a failure. The vendor is down, the pagination
//     walk broke, or auth lapsed. Previously silent.
//   IN SEASON, FETCHED AND WROTE -- graded on the two rates below.
//
// THE ESBID RESOLUTION RATE IS THE REASON THIS FILE EARNS ITS WEIGHT, and it is
// the SITUATION half. A market whose esbid does not resolve is written with a
// null, which removes it from the population
// prop-market-open-close-esbid-coherence can grade at all. Resolution breaking
// wholesale would therefore make that check quieter rather than louder -- the
// drifted count stops rising because nothing is gradeable, which reads exactly
// like the stamping fix working. Nothing else watches for that, and the
// coherence check cannot watch for it by construction.
//
// Calibrated on the 2025 season, 212 cycles of at least 50 rows, under the OLD
// pre-crosswalk resolution: median 0.9799, p05 0.9265, p01 0.8468, worst
// 0.2545, with 6 cycles below 0.90 and 1 below 0.50. Under the crosswalk landed
// in league aa5e43baa both post-fix cycles measured 2026-09-01 resolve at
// 100.00% (70 rows and 8,188 rows).
//
// The floor is deliberately LOOSE at 0.50 rather than tight near the observed
// 1.00, for a reason worth stating: the post-fix distribution is two readings,
// and a threshold set against two points is a guess wearing a measurement's
// clothes. 0.50 sits below every legitimate reading in the old season bar one
// and far above a wholesale break. Tighten it once a season of post-fix cycles
// exists to calibrate the gap against.
export const MINIMUM_ESBID_RESOLUTION_RATE = 0.5

// The crosswalk is the authority; the team-based match is the fallback that is
// correct on first observation and wrong on every later one, which is the
// mechanism that produced 9,160 drifted markets in the first place
// (user:task/league/stabilize-prop-market-esbid-stamping.md). A run resolving
// most of its markets through the fallback means the crosswalk has stopped
// answering, and that is the leading indicator of drift returning -- visible
// here one import cycle before settlement writes a single wrong grade.
//
// Not a hard failure. The fallback is a legitimate path for a genuinely new
// game id, and early in a week a burst of them is expected, so this reports
// rather than throws.
export const MAXIMUM_FALLBACK_RESOLUTION_RATE = 0.5

const format_rate = (rate) => `${(rate * 100).toFixed(1)}%`

export default function grade_prizepicks_import_run({
  // False when the seasonal window guard skipped the run. The calendar is an
  // input to the grade, not a reason to not grade.
  in_season = true,
  // True for --dry, which fetches but deliberately writes nothing. Graded on
  // the fetch alone; a write assertion would fail by design.
  dry_run = false,
  markets_fetched = 0,
  markets_formatted = 0,
  markets_with_esbid = 0,
  markets_resolved_by_crosswalk = 0,
  markets_resolved_by_fallback = 0,
  missing_market_types = 0,
  pages_fetched = 0
}) {
  if (!in_season) {
    return {
      passed: true,
      skipped: true,
      failures: [],
      summary:
        'oracle SKIP: outside the NFL season window, no import attempted -- ' +
        'this is a skip and not an import, recorded so the two are ' +
        'distinguishable in the runs ledger'
    }
  }

  const failures = []

  // The zero-coverage rule, and the one that actually catches a total break.
  // Kept separate from the rate below because a rate is undefined precisely
  // when the failure is total -- the same hole the charting oracle had.
  if (markets_fetched === 0) {
    failures.push(`no markets fetched across ${pages_fetched} page(s)`)
  } else if (markets_formatted === 0) {
    failures.push(`no markets formatted from ${markets_fetched} fetched`)
  } else {
    const esbid_rate = markets_with_esbid / markets_formatted

    if (markets_with_esbid === 0) {
      failures.push(
        `no market resolved an esbid across ${markets_formatted} formatted market(s)`
      )
    } else if (esbid_rate < MINIMUM_ESBID_RESOLUTION_RATE) {
      failures.push(
        `esbid resolution rate ${format_rate(esbid_rate)} below ${format_rate(MINIMUM_ESBID_RESOLUTION_RATE)} (${markets_with_esbid} of ${markets_formatted})`
      )
    }
  }

  const resolved = markets_resolved_by_crosswalk + markets_resolved_by_fallback
  const fallback_rate = resolved ? markets_resolved_by_fallback / resolved : 0
  const fallback_warning =
    resolved && fallback_rate > MAXIMUM_FALLBACK_RESOLUTION_RATE
      ? ` -- WARNING: ${format_rate(fallback_rate)} of resolutions used the team-based fallback rather than the crosswalk (${markets_resolved_by_fallback} of ${resolved}); the crosswalk may have stopped answering, which is how esbid drift returns`
      : ''

  const summary =
    `oracle ${failures.length ? 'FAIL' : 'PASS'}${dry_run ? ' (dry run)' : ''}: ` +
    `${markets_fetched} market(s) fetched over ${pages_fetched} page(s), ` +
    `${markets_formatted} formatted, ` +
    `${markets_with_esbid} with an esbid ` +
    `(${markets_resolved_by_crosswalk} crosswalk, ${markets_resolved_by_fallback} fallback), ` +
    `${missing_market_types} unmapped stat type(s)` +
    (failures.length ? ` -- ${failures.join('; ')}` : '') +
    fallback_warning

  return { passed: failures.length === 0, skipped: false, failures, summary }
}
