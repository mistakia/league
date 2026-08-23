import debug from 'debug'

import db from '#db'
import { current_season, is_regular_season } from '#constants'
import { is_main, report_job } from '#libs-server'
import { create_logger } from '#libs-shared/log.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'
import {
  named_scoring_formats,
  named_league_formats
} from '#libs-shared/named-format-catalog.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const log = debug('verify-format-data-coverage')
enable_debug_namespaces('verify-format-data-coverage')

const signal_log = create_logger('verify-format-data-coverage', {
  service: 'league-host'
})

// Every named catalog format is addressable by any API caller -- the default
// scoring format backs the synthetic lid=0 league that every league-less
// request resolves to -- so each one must carry derived data for every season
// the base gamelogs cover. A format that silently stops being generated does
// not surface as an error anywhere: the gamelog rows simply stop appearing.
const COVERAGE_TARGETS = [
  {
    table: 'scoring_format_player_gamelogs',
    format_id_column: 'scoring_format_id',
    format_ids: Object.keys(named_scoring_formats)
  },
  {
    table: 'league_format_player_gamelogs',
    format_id_column: 'league_format_id',
    format_ids: Object.keys(named_league_formats)
  }
]

/**
 * Seasons that every named format is expected to cover.
 *
 * Derived from the base `player_gamelogs` table -- the same source the
 * generators enumerate years from -- so the detector and the backfill that
 * fixes it read the same ground truth. The in-progress season is excluded:
 * mid-season there is a window between base gamelog generation and format
 * generation where a legitimate gap would look like a regression.
 */
const get_expected_season_years = async () => {
  const rows = await db('player_gamelogs')
    .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
    .where('nfl_games.season_type', 'REG')
    .groupBy('nfl_games.season_year')
    .orderBy('nfl_games.season_year', 'asc')
    .pluck('nfl_games.season_year')

  return is_regular_season
    ? rows.filter((season_year) => season_year !== current_season.year)
    : rows
}

const get_covered_season_years = async ({
  table,
  format_id_column,
  format_id
}) => {
  return db(table)
    .join('nfl_games', 'nfl_games.esbid', `${table}.esbid`)
    .where('nfl_games.season_type', 'REG')
    .where(`${table}.${format_id_column}`, format_id)
    .groupBy('nfl_games.season_year')
    .pluck('nfl_games.season_year')
}

/**
 * Find every named format missing derived data for an expected season.
 *
 * Pure detection -- no signal emission, no process exit -- so it can be
 * exercised directly from a test or an ad-hoc check.
 *
 * @returns {Promise<object>} expected_season_years, total_format_count, gaps
 */
export const find_format_data_coverage_gaps = async () => {
  const expected_season_years = await get_expected_season_years()

  // Oracle: assert we actually resolved something to check against. "Ran
  // without throwing" is otherwise indistinguishable from an empty expected
  // set (a renamed column, an empty join), which would make every format
  // trivially pass and leave the check permanently, silently green.
  if (!expected_season_years.length) {
    throw new Error(
      'no expected season years resolved from player_gamelogs; coverage check cannot assert anything'
    )
  }

  const total_format_count = COVERAGE_TARGETS.reduce(
    (count, target) => count + target.format_ids.length,
    0
  )
  if (!total_format_count) {
    throw new Error(
      'named format catalog resolved zero formats; coverage check cannot assert anything'
    )
  }

  log(
    `Checking ${total_format_count} named formats against seasons ${expected_season_years.join(', ')}`
  )

  // A format that carries data for some seasons but not others has regressed:
  // it was being generated and stopped. That is the actionable condition and
  // the one that silently blanks the UI.
  const gaps = []
  // A format with no data for any season has never been generated. Real, but a
  // pre-existing backlog rather than a regression, and backfilling one is a
  // multi-hour job -- so it is reported without driving the signal, which would
  // otherwise fire every week on the same known set and train the operator to
  // ignore it.
  const uncovered_format_ids = []

  for (const { table, format_id_column, format_ids } of COVERAGE_TARGETS) {
    for (const format_id of format_ids) {
      const covered_season_years = await get_covered_season_years({
        table,
        format_id_column,
        format_id
      })
      const covered = new Set(covered_season_years)
      const missing_season_years = expected_season_years.filter(
        (season_year) => !covered.has(season_year)
      )

      if (!missing_season_years.length) continue

      if (!covered.size) {
        uncovered_format_ids.push(`${table}/${format_id}`)
        log(`  NEVER GENERATED ${table} ${format_id}`)
        continue
      }

      gaps.push({ table, format_id, missing_season_years })
      log(
        `  REGRESSED ${table} ${format_id}: ${missing_season_years.join(', ')}`
      )
    }
  }

  return {
    expected_season_years,
    total_format_count,
    gaps,
    uncovered_format_ids
  }
}

const verify_format_data_coverage = async () => {
  const {
    expected_season_years,
    total_format_count,
    gaps,
    uncovered_format_ids
  } = await find_format_data_coverage_gaps()

  if (uncovered_format_ids.length) {
    log(
      `${uncovered_format_ids.length} named formats have never been generated (not signalled): ${uncovered_format_ids.join(', ')}`
    )
  }

  if (!gaps.length) {
    log(`All ${total_format_count} named formats free of coverage regressions`)
    return
  }

  const summary = gaps
    .map(
      ({ table, format_id, missing_season_years }) =>
        `${table}/${format_id} missing ${missing_season_years.join(',')}`
    )
    .join('; ')

  const backfill_format_ids = [...new Set(gaps.map((gap) => gap.format_id))]

  const emitted = signal_log.error(
    new Error(
      `Named format data coverage gaps (${gaps.length}): ${summary}. Backfill each with: node scripts/generate-format-data.mjs --format <id> (${backfill_format_ids.join(', ')})`
    ),
    {
      severity: 'high',
      context: {
        gap_count: gaps.length,
        expected_season_years,
        gaps,
        uncovered_format_ids
      }
    }
  )
  if (emitted?.promise) {
    await emitted.promise
  }

  throw new Error(`format data coverage incomplete: ${gaps.length} gaps`)
}

const main = async () => {
  let error
  try {
    await verify_format_data_coverage()
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.VERIFY_FORMAT_DATA_COVERAGE,
    error
  })

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default verify_format_data_coverage
