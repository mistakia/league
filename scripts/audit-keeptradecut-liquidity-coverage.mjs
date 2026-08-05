import dayjs from 'dayjs'
import debug from 'debug'

import db from '#db'
import { is_main, report_job, throw_if_shortfall } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const log = debug('audit-keeptradecut-liquidity-coverage')

// Coverage oracle for keeptradecut_liquidity, which is collected once per
// calendar day and has no consumers -- so a silent multi-day collection loss
// has nothing downstream to surface it. The daily importer's own
// pipeline_failure auto-resolves on the following morning's successful run, so
// a day lost to a zeroed KTC payload clears the signal queue while the data gap
// persists; the gap is only visible to someone who thinks to count days.
//
// Paging on a SUSTAINED gap rather than on any gap. A single missing day is
// what the two recovery slots exist to absorb, and a detector that fires on
// every one of them would page on a condition already owned and trained the
// reader to dismiss it. Two consecutive missing days means recovery itself has
// stopped working, which is the condition with no other surface.
export const MAX_CONSECUTIVE_MISSING_DAYS = 2

// Trailing window for the reported measurement. Long enough to characterise the
// miss rate, short enough that a long-since-repaired stretch stops counting.
export const COVERAGE_WINDOW_DAYS = 30

const to_day = (value) => dayjs(value).format('YYYY-MM-DD')

// Pure: takes the observed days and the window, returns the finding. Kept free
// of DB and signal concerns so it is testable against a constructed corpus
// rather than against whatever production happens to hold today.
export const classify_liquidity_coverage = ({
  collected_days,
  window_start,
  window_end
}) => {
  const collected = new Set(collected_days)
  const expected_days = []
  let cursor = dayjs(window_start)
  const end = dayjs(window_end)
  while (!cursor.isAfter(end, 'day')) {
    expected_days.push(cursor.format('YYYY-MM-DD'))
    cursor = cursor.add(1, 'day')
  }

  const missing_days = expected_days.filter((day) => !collected.has(day))

  // Counted back from the most recent day in the window, which is the only end
  // a gap can be growing from.
  let current_gap_streak = 0
  for (let index = expected_days.length - 1; index >= 0; index--) {
    if (collected.has(expected_days[index])) break
    current_gap_streak++
  }

  return {
    expected_day_count: expected_days.length,
    collected_day_count: expected_days.length - missing_days.length,
    missing_days,
    current_gap_streak,
    // Reported always, paged on never: the baseline suppresses the signal, not
    // the measurement.
    trailing_miss_rate: expected_days.length
      ? missing_days.length / expected_days.length
      : null
  }
}

const find_coverage_window = async () => {
  // Evaluate through YESTERDAY. Today is still in flight -- both recovery slots
  // sit later in the day than this check -- so counting it would report a gap
  // that has not had its chances yet.
  const window_end = dayjs().subtract(1, 'day').startOf('day')
  const requested_start = window_end.subtract(COVERAGE_WINDOW_DAYS - 1, 'day')

  const first_row = await db('keeptradecut_liquidity')
    .min({ first_observed_at: 'observed_at' })
    .first()
  const first_observed_at = first_row?.first_observed_at

  // An oracle that cannot resolve its subject has found nothing to check, which
  // is not the same as finding nothing wrong.
  if (!first_observed_at) {
    return { window_start: null, window_end, first_observed_at: null }
  }

  // Never grade the window before collection began: days that predate the first
  // row are not gaps, and counting them would manufacture a permanent finding.
  const first_day = dayjs(first_observed_at).startOf('day')
  const window_start = first_day.isAfter(requested_start)
    ? first_day
    : requested_start

  return { window_start, window_end, first_observed_at }
}

const audit_keeptradecut_liquidity_coverage = async () => {
  const { window_start, window_end, first_observed_at } =
    await find_coverage_window()

  if (!first_observed_at) {
    return {
      shortfall:
        'domain: keeptradecut_liquidity holds no rows at all; nothing to grade coverage against'
    }
  }

  const rows = await db('keeptradecut_liquidity')
    .select('observed_at')
    .where('observed_at', '>=', window_start.toDate())
    .andWhere('observed_at', '<=', window_end.toDate())
    .groupBy('observed_at')

  const result = classify_liquidity_coverage({
    collected_days: rows.map((row) => to_day(row.observed_at)),
    window_start,
    window_end
  })

  log(
    `coverage ${to_day(window_start)}..${to_day(window_end)}: ${result.collected_day_count}/${result.expected_day_count} days collected, ${result.missing_days.length} missing (${(result.trailing_miss_rate * 100).toFixed(1)}%), current gap streak ${result.current_gap_streak}`
  )
  if (result.missing_days.length) {
    log(`missing days: ${result.missing_days.join(', ')}`)
  }

  const shortfalls = []
  if (result.current_gap_streak >= MAX_CONSECUTIVE_MISSING_DAYS) {
    shortfalls.push(
      `coverage: ${result.current_gap_streak} consecutive day(s) with no keeptradecut_liquidity rows through ${to_day(window_end)} (threshold ${MAX_CONSECUTIVE_MISSING_DAYS}); recovery slots are not filling the gap. Missing in window: ${result.missing_days.join(', ')}`
    )
  }

  return {
    shortfall: shortfalls.length ? shortfalls.join('; ') : null,
    ...result
  }
}

const main = async () => {
  // Inside main(), not at module scope: `debug.enable` REPLACES the enabled
  // namespace set, so a module-scope call in an importable script silently
  // clobbers whichever entry point imported it.
  if (!process.env.DEBUG) {
    debug.enable('audit-keeptradecut-liquidity-coverage')
  }

  let error
  try {
    const result = await audit_keeptradecut_liquidity_coverage()
    throw_if_shortfall(result?.shortfall)
  } catch (err) {
    error = err
    log(err)
  }

  // The finding is reported as this job's outcome rather than emitted as its
  // own signal: the runs oracle owns pipeline_failure for outcome conditions
  // and closes it on the next clean run, so the detector self-heals by
  // construction and cannot orphan a caller-keyed signal.
  await report_job({
    job_type: job_types.AUDIT_KEEPTRADECUT_LIQUIDITY_COVERAGE,
    error
  })

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default audit_keeptradecut_liquidity_coverage
