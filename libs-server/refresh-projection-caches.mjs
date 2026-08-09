import debug from 'debug'

import { current_season } from '#constants'
import { find_stale_projection_formats } from './projection-cache-staleness.mjs'
import { process_scoring_format_year } from '#scripts/process-projections-for-scoring-format.mjs'
import process_projections_for_league_format from '#scripts/process-projections-for-league-format.mjs'

const log = debug('refresh-projection-caches')

const FORMAT_TIMEOUT_MS = 300_000

// A format whose rebuild leaves its slice STILL empty would be rediscovered on
// every pass forever. The staleness derivation already refuses to report a
// format with no source data, so reaching this cap means something worse --
// count the attempts and stop rather than burning a core on a hot loop. The
// counter is caller-supplied so the worker keeps one across passes while a test
// gets a fresh one.
export const MAX_ATTEMPTS_PER_FORMAT = 3

const with_timeout = (promise, timeout_ms, label) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${timeout_ms}ms`)),
      timeout_ms
    )
    promise
      .then((result) => {
        clearTimeout(timer)
        resolve(result)
      })
      .catch((error) => {
        clearTimeout(timer)
        reject(error)
      })
  })

// One pass over the derived stale set. Lives here rather than in the worker so
// a spec can drive it without importing a module whose scope installs process
// handlers and rewrites the debug namespace set.
//
// Returns what it did so the caller can decide whether the pass is worth
// reporting: a pass that found nothing is the steady state, and a worker
// polling every 20s must not put that in the runs ledger.
export const refresh_projection_caches = async ({
  db,
  year = current_season.year,
  attempts_by_format_id = new Map(),
  should_stop = () => false
}) => {
  const { scoring_format_ids, league_format_ids } =
    await find_stale_projection_formats({ db, year })

  const rebuilt = []
  const failures = []

  const is_exhausted = (format_id) =>
    (attempts_by_format_id.get(format_id) || 0) >= MAX_ATTEMPTS_PER_FORMAT
  const record_attempt = (format_id) =>
    attempts_by_format_id.set(
      format_id,
      (attempts_by_format_id.get(format_id) || 0) + 1
    )

  // Scoring first: league values are derived FROM scoring points, so rebuilding
  // scoring here makes the dependent league formats eligible on the NEXT pass
  // rather than racing them inside this one.
  for (const scoring_format_id of scoring_format_ids) {
    if (should_stop()) break
    if (is_exhausted(scoring_format_id)) continue
    record_attempt(scoring_format_id)
    try {
      await with_timeout(
        process_scoring_format_year({ year, scoring_format_id }),
        FORMAT_TIMEOUT_MS,
        `scoring_format=${scoring_format_id}`
      )
      rebuilt.push(`scoring:${scoring_format_id}`)
      log(`rebuilt scoring_format=${scoring_format_id} year=${year}`)
    } catch (err) {
      failures.push(`scoring:${scoring_format_id}: ${err.message}`)
      log(`scoring_format=${scoring_format_id} failed: ${err.message}`)
    }
  }

  for (const league_format_id of league_format_ids) {
    if (should_stop()) break
    if (is_exhausted(league_format_id)) continue
    record_attempt(league_format_id)
    try {
      await with_timeout(
        process_projections_for_league_format({ year, league_format_id }),
        FORMAT_TIMEOUT_MS,
        `league_format=${league_format_id}`
      )
      rebuilt.push(`league:${league_format_id}`)
      log(`rebuilt league_format=${league_format_id} year=${year}`)
    } catch (err) {
      failures.push(`league:${league_format_id}: ${err.message}`)
      log(`league_format=${league_format_id} failed: ${err.message}`)
    }
  }

  return { rebuilt, failures }
}

export default refresh_projection_caches
