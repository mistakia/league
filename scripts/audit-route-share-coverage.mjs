import debug from 'debug'

import db from '#db'
import {
  is_main,
  report_job,
  recompute_route_share,
  resolve_signal
} from '#libs-server'
import { create_logger } from '#libs-shared/log.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'

const log = debug('audit-route-share-coverage')
debug.enable('audit-route-share-coverage')

const SERVICE = 'league-host'

const signal_log = create_logger('audit-route-share-coverage', {
  service: SERVICE
})

// Stable dedup keys. The message text carries counts that move every run, so a
// computed fingerprint would open a fresh signal per run and none of them could
// ever be closed; pinning the fingerprint is what makes the resolve arm below
// able to reach the row this run's emit would open.
const UNFILLED_FINGERPRINT = 'route-share-unfilled'
const NFLFASTR_COVERAGE_FINGERPRINT = 'nflfastr-dropback-coverage'
const dedup_key_for = (fingerprint) => `log_error:${SERVICE}:${fingerprint}`

// nflfastR publishes regular season and postseason only -- every PRE week in
// the corpus is 0.0% enriched, across every season back to 1999, which is the
// feed's shape and not a gap. Grading PRE would put ~100 permanently-red weeks
// in front of the one that is real.
const GRADED_SEASON_TYPES = ['REG', 'POST']
const FIRST_NFLFASTR_SEASON = 1999

// Weeks below this fraction of plays carrying is_qb_dropback are reported.
// Calibrated on the GAP, not on the worst reading: across 533 graded weeks the
// median is 95.4% and the 1st percentile is 85.7%, while the one real defect
// (2021 REG week 15) sits at 42.5%. 80% is six points under the healthy floor
// and thirty-seven above the defect.
const COVERAGE_FLOOR = 0.8

// A week with fewer plays than this is a scheduling artifact (a PRE week 0
// stub, a partial import in flight) rather than a gradeable population.
const MIN_PLAYS_PER_WEEK = 100

// The corpus is 533 graded weeks and grows by ~22 a season. A floor well under
// that catches the failure this whole check is otherwise blind to: a predicate
// change that empties the scan reports zero findings and reads exactly like a
// clean sweep. Coverage collapse is detector failure, not a pass.
const MIN_GRADED_WEEKS = 400

// Known-bad weeks, excluded from the finding so a standing backlog does not
// fire every Sunday and train the operator to ignore this check. REMOVE AN
// ENTRY WHEN IT IS REPAIRED -- a stale entry silently re-admits the gap.
//
// 2021 REG week 15, the COVID-rescheduling week, was the only entry and is
// REPAIRED as of b567eb179. nflfastR's old_game_id disagreed with our esbid on
// 9 of that week's 16 games; the importer now resolves a feed game by matchup
// rather than trusting that id, the nine games were re-imported, and the week
// sits at 96-98% enrichment against ~97% for the rest of the corpus. Leaving
// the entry in place would have suppressed a genuine regression there forever.
const KNOWN_COVERAGE_GAPS = []

const is_known_gap = ({ known_gaps, season_year, week, season_type }) =>
  known_gaps.some(
    (gap) =>
      gap.season_year === season_year &&
      gap.week === week &&
      gap.season_type === season_type
  )

/**
 * Rows carrying routes but no route_share that COULD be filled right now.
 *
 * Graded by running the healer itself in dry mode rather than by a second
 * query written to match it. A detector must baseline against the same
 * reference its healer mutates; re-deriving the selector here would let the
 * two drift apart, and the drift would present as a finding nobody can
 * reproduce with the repair command this check names.
 *
 * The rows the healer SKIPS are deliberately not this check's finding: they
 * are the upstream dropback gap, which the coverage check below owns. Counting
 * them here would report one condition twice and leave this key permanently
 * open.
 */
const check_unfilled_route_share = async () => {
  const result = await recompute_route_share({ dry_run: true })

  console.log(
    `route_share: ${result.candidates} rows carry routes with no share -- ${result.updated} fillable now, ${result.skipped_missing_dropbacks} skipped (game has no dropback data), ${result.skipped_invalid_dropbacks} skipped (dropbacks below routes)`
  )

  return result
}

/**
 * Grade per-week enrichment rows against the floor. Pure, and exported so the
 * classification can be specced without a database -- the query below supplies
 * the rows and nothing else decides a verdict.
 *
 * `known_gaps` is injected rather than read from the module constant so the
 * exclusion BEHAVIOR stays specced when the roster is empty, which is its
 * healthy steady state. Coupling those specs to the live roster made emptying
 * it on repair (98ee04c1f) turn the suite red on a commit that changed data,
 * not behavior.
 */
export const classify_week_coverage = ({
  rows,
  known_gaps = KNOWN_COVERAGE_GAPS
}) => {
  const graded = rows
    .map((row) => ({
      season_year: row.season_year,
      week: row.week,
      season_type: row.season_type,
      plays: parseInt(row.plays, 10),
      enriched_plays: parseInt(row.enriched_plays, 10)
    }))
    .filter((row) => row.plays >= MIN_PLAYS_PER_WEEK)
    .map((row) => ({ ...row, coverage: row.enriched_plays / row.plays }))

  const below_floor = graded.filter((row) => row.coverage < COVERAGE_FLOOR)

  return {
    weeks_graded: graded.length,
    below_floor: below_floor.filter(
      (row) => !is_known_gap({ ...row, known_gaps })
    ),
    known_gaps_below_floor: below_floor.filter((row) =>
      is_known_gap({ ...row, known_gaps })
    )
  }
}

/**
 * Fraction of each graded week's plays carrying is_qb_dropback.
 *
 * Reads week and season_type off nfl_plays rather than joining nfl_games: the
 * join is the expensive half and buys nothing, since the play carries both.
 */
const check_nflfastr_dropback_coverage = async () => {
  const rows = await db('nfl_plays')
    .select('season_year', 'week', 'season_type')
    .count('* as plays')
    .select(db.raw('count(is_qb_dropback) as enriched_plays'))
    .where('season_year', '>=', FIRST_NFLFASTR_SEASON)
    .whereIn('season_type', GRADED_SEASON_TYPES)
    .whereNotNull('week')
    .groupBy('season_year', 'week', 'season_type')

  return classify_week_coverage({ rows })
}

const audit_route_share_coverage = async () => {
  const unfilled = await check_unfilled_route_share()
  const coverage = await check_nflfastr_dropback_coverage()

  console.log(
    `nflfastr dropback coverage: ${coverage.weeks_graded} weeks graded (floor ${COVERAGE_FLOOR * 100}%), ${coverage.below_floor.length} below floor, ${coverage.known_gaps_below_floor.length} known gaps excluded`
  )

  // Coverage collapse is DETECTOR failure and must be as loud as a finding --
  // an emptied scan reports zero below floor and reads as a clean sweep.
  if (coverage.weeks_graded < MIN_GRADED_WEEKS) {
    throw new Error(
      `graded only ${coverage.weeks_graded} weeks (expected at least ${MIN_GRADED_WEEKS}); the coverage scan is not reaching its corpus, so its zero findings mean nothing`
    )
  }

  if (unfilled.updated > 0) {
    const emitted = signal_log.error(
      new Error(
        `${unfilled.updated} player_receiving_gamelogs rows carry routes and dropback data but no route_share. The recompute pass is not reaching them -- repair with: node scripts/recompute-route-share.mjs`
      ),
      {
        severity: 'medium',
        fingerprint_override: UNFILLED_FINGERPRINT,
        context: {
          candidates: unfilled.candidates,
          fillable: unfilled.updated,
          skipped_missing_dropbacks: unfilled.skipped_missing_dropbacks,
          skipped_invalid_dropbacks: unfilled.skipped_invalid_dropbacks
        }
      }
    )
    if (emitted?.promise) await emitted.promise
  } else {
    // Gated on the observed clean state, never on an in-process latch: this
    // script is a fresh process every run, so a latch could only ever strand
    // the open signal.
    await resolve_signal({
      dedup_key: dedup_key_for(UNFILLED_FINGERPRINT),
      resolution_note:
        '[Fix] every route_share with usable dropback data is populated'
    })
  }

  if (coverage.below_floor.length) {
    const summary = coverage.below_floor
      .map(
        (row) =>
          `${row.season_year} ${row.season_type} week ${row.week} at ${(row.coverage * 100).toFixed(1)}%`
      )
      .join('; ')

    const emitted = signal_log.error(
      new Error(
        `nflfastR play enrichment is below ${COVERAGE_FLOOR * 100}% for ${coverage.below_floor.length} week(s): ${summary}. is_qb_dropback comes from scripts/import-plays-nflfastr.mjs, whose own match-rate oracle is year-grained and cannot see a hole this size; every per-game rate that divides by team dropbacks is wrong for these weeks.`
      ),
      {
        severity: 'medium',
        fingerprint_override: NFLFASTR_COVERAGE_FINGERPRINT,
        context: {
          weeks_graded: coverage.weeks_graded,
          coverage_floor: COVERAGE_FLOOR,
          below_floor: coverage.below_floor,
          known_gaps_excluded: coverage.known_gaps_below_floor
        }
      }
    )
    if (emitted?.promise) await emitted.promise
  } else {
    await resolve_signal({
      dedup_key: dedup_key_for(NFLFASTR_COVERAGE_FINGERPRINT),
      resolution_note: `[Fix] every graded week is at or above ${COVERAGE_FLOOR * 100}% nflfastR enrichment`
    })
  }

  return { unfilled, coverage }
}

const main = async () => {
  let error
  try {
    await audit_route_share_coverage()
  } catch (err) {
    error = err
    log(error)
    console.error(`AUDIT ERROR: ${error.message}`)
  }

  await report_job({
    job_type: job_types.AUDIT_ROUTE_SHARE_COVERAGE,
    error
  })

  // The exit code carries DETECTOR health only. A finding travels as a
  // self-closing signal on its own dedup key, so a red row in the runs ledger
  // always means this check could not run -- never that the data it watches is
  // bad. Collapsing the two would make a true finding and a broken monitor the
  // same row.
  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default audit_route_share_coverage
