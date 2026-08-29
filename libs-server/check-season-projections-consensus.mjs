import db from '#db'
import { external_data_sources } from '#constants'

// Output oracle for the SEASON-LONG consensus that process-projections computes
// and for the valuation board that hangs off it.
//
// The failure it watches is the 2026-08-04 one, and the reason it exists is that
// nothing could see that failure while it was happening. The week floor stepped
// from 0 to 1, every season-long source row fell out of the read, the consensus
// was computed over an empty source set and written all-NULL, and market_salary
// priced at $0 on 22 of 23 league formats. Every script exited 0.
//
// THREE THINGS ABOUT THE SHAPE OF THIS CHECK, each of which a simpler version
// gets wrong:
//
// 1. A ROW-COUNT ORACLE ALONE IS BLIND TO IT. The consensus stayed fully
//    populated through the incident -- the rows were there, their values were
//    null. So the row-count limbs below are the backstop, not the oracle, and
//    the valuation limb is the one that would actually have fired.
//
// 2. league_available_pts_added CANNOT BE QUERIED. The plan this check was
//    written from asked for a non-zero assertion on it. It is a local variable
//    in process-projections.mjs and is never persisted, so there is nothing to
//    read. It is the denominator of league_adjusted_rate, and a zero there
//    forces projected_positive_salary_at_available_cap to `Math.round(NaN) || 0`
//    for every player -- which lands, persisted, as market_salary_positive. So
//    the two limbs COLLAPSE: a healthy market_salary_positive population is a
//    faithful proxy for a non-zero league_available_pts_added, and it is the
//    only one of the two anything can observe.
//
// 3. AN AGGREGATE market_salary COUNT WOULD HAVE MISSED THE INCIDENT. It priced
//    at $0 on 22 of 23 formats -- the twenty-third kept a healthy population, so
//    "some format somewhere has a positive salary" was TRUE throughout. The limb
//    is therefore a SHARE OF FORMATS, not a total.
//
// The baseline for the ratchet limb is read from season_projections_index itself
// before the upsert rather than from a state store: it is durable across deploys
// and restarts with no new table, and `jobs` carries only
// (job_id, type, is_successful, reason, run_at) with nowhere to put it.
//
// Returns a message on shortfall and null when healthy -- the contract
// process-projections' check_oracle composes, so a shortfall changes the run's
// VERDICT (report_job failure plus a pipeline_failure signal) and not just its
// log.

// Well under the ~1,300 consensus rows a healthy 2026 carries and far above the
// zero the incident would produce. Absolute rather than relative because a
// relative-only check permits monotonic decay to zero and passes vacuously on
// the first run of a new season.
const DEFAULT_CONSENSUS_FLOOR = 250

// A halving between consecutive runs is not legitimate churn. Deliberately
// loose: this limb exists to catch a cliff, and the absolute floor above is what
// catches a drift.
const DEFAULT_MAX_SHRINK_FRACTION = 0.5

// Measured on production 2026-08-29: 23 of 25 league formats carry a positive
// market_salary_positive population, and the two that do not (draftkings_classic
// and one unnamed format) are legitimately unpriced. The incident shape is 1 of
// 23. Half separates those two by a wide margin in both directions, which a
// tighter threshold would not.
const DEFAULT_MARKET_SALARY_FORMAT_SHARE_FLOOR = 0.5

/**
 * Count the AVERAGE consensus rows already present for a season. Call this
 * BEFORE the consensus upsert -- afterwards it measures the run's own output
 * and the ratchet compares a number against itself.
 */
export const read_season_consensus_baseline = async ({ season_year }) => {
  const [row] = await db('season_projections_index')
    .where({ season_year, source_id: external_data_sources.AVERAGE })
    .count('* as cnt')

  return { season_year, consensus_row_count: Number(row?.cnt || 0) }
}

export default async function check_season_projections_consensus({
  season_year,
  baseline = null,
  consensus_floor = DEFAULT_CONSENSUS_FLOOR,
  max_shrink_fraction = DEFAULT_MAX_SHRINK_FRACTION,
  market_salary_format_share_floor = DEFAULT_MARKET_SALARY_FORMAT_SHARE_FLOOR
}) {
  // The one legitimate emptiness. A season nobody has published a projection for
  // yet has no consensus to compute and no board to price, so every limb below
  // would fire on a correct run. Stated as the absence of SOURCE rows rather
  // than as a calendar condition: it is the actual precondition, it becomes
  // false the moment the first importer lands, and it cannot silence the check
  // during a season that has sources.
  const [source_row] = await db('season_projections_index')
    .where({ season_year })
    .whereNot({ source_id: external_data_sources.AVERAGE })
    .count('* as cnt')
  const source_row_count = Number(source_row?.cnt || 0)
  if (!source_row_count) return null

  const shortfalls = []

  const { consensus_row_count } = await read_season_consensus_baseline({
    season_year
  })

  if (consensus_row_count < consensus_floor) {
    shortfalls.push(
      `season consensus row-count shortfall (season_year=${season_year}): ` +
        `${consensus_row_count} AVERAGE rows against ${source_row_count} source ` +
        `rows (floor=${consensus_floor})`
    )
  }

  // Skipped when the baseline is zero rather than treated as a 100% shrink: the
  // first run of a new season_year legitimately starts from nothing, and the
  // absolute floor above already covers that case without this limb having to
  // guess.
  if (baseline && baseline.consensus_row_count > 0) {
    const floor_from_baseline = Math.floor(
      baseline.consensus_row_count * (1 - max_shrink_fraction)
    )
    if (consensus_row_count < floor_from_baseline) {
      shortfalls.push(
        `season consensus shrank past its ratchet (season_year=${season_year}): ` +
          `${baseline.consensus_row_count} rows before the run, ` +
          `${consensus_row_count} after (floor=${floor_from_baseline})`
      )
    }
  }

  const [valuation] = await db('league_format_player_season_projection_values')
    .where({ season_year })
    .select(
      db.raw('count(distinct league_format_id) as formats_present'),
      db.raw(
        'count(distinct case when market_salary_positive > 0 then league_format_id end) as formats_with_positive'
      )
    )

  const formats_present = Number(valuation?.formats_present || 0)
  const formats_with_positive = Number(valuation?.formats_with_positive || 0)

  if (formats_present > 0) {
    const share = formats_with_positive / formats_present
    if (share < market_salary_format_share_floor) {
      shortfalls.push(
        `season market_salary population collapsed (season_year=${season_year}): ` +
          `${formats_with_positive} of ${formats_present} league formats carry a ` +
          `positive market_salary_positive (floor=${market_salary_format_share_floor})`
      )
    }
  } else {
    shortfalls.push(
      `no season valuation board written (season_year=${season_year}): ` +
        `league_format_player_season_projection_values holds zero rows while ` +
        `${source_row_count} season source rows exist`
    )
  }

  return shortfalls.length ? shortfalls.join('; ') : null
}
