import { current_season, external_data_sources } from '#constants'
import { process_scoring_format_year } from '#scripts/process-projections-for-scoring-format.mjs'
import process_projections_for_league_format from '#scripts/process-projections-for-league-format.mjs'

// Which precomputed projection slices are missing for a season, and the pass
// that fills them.
//
// scoring_format_player_projection_points and
// league_format_player_projection_values are caches keyed on an OPAQUE format
// id. Format ids are find-or-create over the whole config tuple, so changing
// any scoring or roster setting does not update a row -- it resolves to a
// DIFFERENT id, and that id's slice is empty until something derives it. The
// emptiness IS the staleness signal, which is why nothing here needs a dirty
// flag, a queue table, or an enqueue call at the write site: the condition is
// derivable from the data at any time, by anyone, and it is equally true of a
// slice that was never built, one a failed run left empty, and one whose
// writer has not been deployed yet.
//
// Two guards keep the derivation from reporting work that cannot succeed,
// which matters because the caller is a loop: a format whose slice stays empty
// after a refill would otherwise be rediscovered on every pass forever.

const FORMAT_TIMEOUT_MS = 300_000

// A format whose rebuild THROWS keeps `failures` non-empty, which keeps the
// worker's did_work true, which pins its poll at the 20s active interval -- so
// an unrebuildable format would put a ledger failure row every 20 seconds for
// the life of the process. The cap is what drops the pass back to the idle
// interval. Note the consequence: once a format is exhausted it goes silent
// here until the process restarts, and the hourly process-projections cron is
// its only remaining cover. The counter is caller-supplied so the worker keeps
// one across passes while a test gets a fresh one.
export const MAX_ATTEMPTS_PER_FORMAT = 3

// A slice is legitimately empty when there is nothing to derive it FROM. The
// scoring cache is built from the AVERAGE rows in projections_index, so with
// no source rows for the year every scoring format is correctly empty and none
// of them is stale.
export const has_projection_source_for_year = async ({ db, year }) => {
  const row = await db('projections_index')
    .where({
      season_year: year,
      season_type: 'REG',
      sourceid: external_data_sources.AVERAGE
    })
    .first('pid')
  return Boolean(row)
}

// Scoring formats a season row references whose points slice is empty.
// Anchored on `seasons` rather than on league_scoring_formats: find-or-create
// leaves behind every intermediate config anyone ever saved, and a format no
// season references is not a cache anybody reads.
export const find_stale_scoring_format_ids = async ({ db, year }) => {
  if (!(await has_projection_source_for_year({ db, year }))) {
    return []
  }

  const rows = await db('seasons')
    .distinct('seasons.scoring_format_id')
    .where('seasons.season_year', year)
    .whereNotNull('seasons.scoring_format_id')
    .whereNotExists(function () {
      this.select(1)
        .from('scoring_format_player_projection_points')
        .whereRaw(
          'scoring_format_player_projection_points.scoring_format_id = seasons.scoring_format_id'
        )
        .andWhere('scoring_format_player_projection_points.season_year', year)
    })

  return rows.map((row) => row.scoring_format_id)
}

// League formats a season row references whose values slice is empty AND whose
// upstream scoring slice is populated. The upstream condition is what makes the
// two stages ordered rather than racing: league values are derived FROM scoring
// points, so a league format whose scoring format is itself still empty is not
// yet workable and must not be reported.
export const find_stale_league_format_ids = async ({ db, year }) => {
  const rows = await db('seasons')
    .distinct('seasons.league_format_id')
    .where('seasons.season_year', year)
    .whereNotNull('seasons.league_format_id')
    .whereExists(function () {
      this.select(1)
        .from('scoring_format_player_projection_points')
        .whereRaw(
          'scoring_format_player_projection_points.scoring_format_id = seasons.scoring_format_id'
        )
        .andWhere('scoring_format_player_projection_points.season_year', year)
    })
    .whereNotExists(function () {
      this.select(1)
        .from('league_format_player_projection_values')
        .whereRaw(
          'league_format_player_projection_values.league_format_id = seasons.league_format_id'
        )
        .andWhere('league_format_player_projection_values.season_year', year)
    })

  return rows.map((row) => row.league_format_id)
}

export const find_stale_projection_formats = async ({ db, year }) => {
  const scoring_format_ids = await find_stale_scoring_format_ids({ db, year })
  const league_format_ids = await find_stale_league_format_ids({ db, year })
  return { scoring_format_ids, league_format_ids }
}

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
      console.log(
        `[refresh-projection-caches] rebuilt scoring_format=${scoring_format_id} year=${year}`
      )
    } catch (err) {
      failures.push(`scoring:${scoring_format_id}: ${err.message}`)
      console.error(
        `[refresh-projection-caches] scoring_format=${scoring_format_id} failed: ${err.message}`
      )
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
      console.log(
        `[refresh-projection-caches] rebuilt league_format=${league_format_id} year=${year}`
      )
    } catch (err) {
      failures.push(`league:${league_format_id}: ${err.message}`)
      console.error(
        `[refresh-projection-caches] league_format=${league_format_id} failed: ${err.message}`
      )
    }
  }

  return { rebuilt, failures }
}

export default refresh_projection_caches
