import debug from 'debug'

import db from '#db'
import { current_season, external_data_sources } from '#constants'
import { is_main, report_job, emit_signal } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import { named_scoring_formats } from '#libs-shared/named-scoring-formats-generated.mjs'
import { named_league_formats } from '#libs-shared/named-league-formats-generated.mjs'

const log = debug('detect-projection-format-hash-drift')
debug.enable('detect-projection-format-hash-drift')

const SIGNAL_SOURCE =
  'user:scheduled-command/league/detect-projection-format-hash-drift.md'
const SIGNAL_DEDUP_FAILURE =
  'pipeline_failure:league:detect-projection-format-hash-drift'

// Scope to (lid, year) pairs with non-zero roster_asset_holding rows so
// dead-league hashes don't pollute the signal. `roster_asset_holding` has no
// year column; year is derived from period_start.
const where_active_lid_year = (qb) => {
  qb.whereExists(function () {
    this.select(db.raw(1))
      .from('roster_asset_holding')
      .whereRaw('roster_asset_holding.lid = seasons.lid')
      .whereRaw(
        'EXTRACT(YEAR FROM roster_asset_holding.period_start)::int = seasons.year'
      )
  })
}

const find_scoring_format_gaps = async () => {
  const rows = await db('seasons')
    .distinct('seasons.year', 'seasons.scoring_format_hash')
    .whereNotNull('seasons.scoring_format_hash')
    .whereNot('seasons.year', current_season.year)
    .whereExists(function () {
      this.select(db.raw(1))
        .from('projections_index')
        .whereRaw('projections_index.year = seasons.year')
        .where('projections_index.sourceid', external_data_sources.AVERAGE)
        .where('projections_index.seas_type', 'REG')
    })
    .whereNotExists(function () {
      this.select(db.raw(1))
        .from('scoring_format_player_projection_points')
        .whereRaw('scoring_format_player_projection_points.year = seasons.year')
        .whereRaw(
          'scoring_format_player_projection_points.scoring_format_hash = seasons.scoring_format_hash'
        )
    })
    .modify(where_active_lid_year)

  return rows
}

const find_league_format_gaps = async () => {
  const rows = await db('seasons')
    .distinct('seasons.year', 'seasons.league_format_hash')
    .innerJoin(
      'league_formats',
      'league_formats.league_format_hash',
      'seasons.league_format_hash'
    )
    .whereNotNull('seasons.league_format_hash')
    .whereNot('seasons.year', current_season.year)
    .whereExists(function () {
      this.select(db.raw(1))
        .from('projections_index')
        .whereRaw('projections_index.year = seasons.year')
        .where('projections_index.sourceid', external_data_sources.AVERAGE)
        .where('projections_index.seas_type', 'REG')
    })
    .whereExists(function () {
      this.select(db.raw(1))
        .from('scoring_format_player_projection_points')
        .whereRaw('scoring_format_player_projection_points.year = seasons.year')
        .whereRaw(
          'scoring_format_player_projection_points.scoring_format_hash = league_formats.scoring_format_hash'
        )
    })
    .whereNotExists(function () {
      this.select(db.raw(1))
        .from('league_format_player_projection_values')
        .whereRaw('league_format_player_projection_values.year = seasons.year')
        .whereRaw(
          'league_format_player_projection_values.league_format_hash = seasons.league_format_hash'
        )
    })
    .modify(where_active_lid_year)

  return rows
}

// Current-year coverage contract from scripts/process-projections.mjs: every
// named scoring/league format must have rows in the current year's
// projection tables. The historical scans above exclude current_season.year,
// so this catalog check is the only guard for the live coverage set.
const find_current_year_named_scoring_format_gaps = async () => {
  const hashes = Object.values(named_scoring_formats).map((f) => f.hash)
  if (!hashes.length) return []
  const present = await db('scoring_format_player_projection_points')
    .distinct('scoring_format_hash')
    .where('year', current_season.year)
    .whereIn('scoring_format_hash', hashes)
  const present_set = new Set(present.map((r) => r.scoring_format_hash))
  return hashes
    .filter((h) => !present_set.has(h))
    .map((scoring_format_hash) => ({
      year: current_season.year,
      scoring_format_hash
    }))
}

const find_current_year_named_league_format_gaps = async () => {
  const hashes = Object.values(named_league_formats).map((f) => f.hash)
  if (!hashes.length) return []
  const present = await db('league_format_player_projection_values')
    .distinct('league_format_hash')
    .where('year', current_season.year)
    .whereIn('league_format_hash', hashes)
  const present_set = new Set(present.map((r) => r.league_format_hash))
  return hashes
    .filter((h) => !present_set.has(h))
    .map((league_format_hash) => ({
      year: current_season.year,
      league_format_hash
    }))
}

const detect_projection_format_hash_drift = async () => {
  const scoring_gaps = [
    ...(await find_scoring_format_gaps()),
    ...(await find_current_year_named_scoring_format_gaps())
  ]
  log(`scoring-format gaps: ${scoring_gaps.length}`)
  for (const gap of scoring_gaps) {
    log(`  year=${gap.year} scoring_format_hash=${gap.scoring_format_hash}`)
  }

  const league_gaps = [
    ...(await find_league_format_gaps()),
    ...(await find_current_year_named_league_format_gaps())
  ]
  log(`league-format gaps: ${league_gaps.length}`)
  for (const gap of league_gaps) {
    log(`  year=${gap.year} league_format_hash=${gap.league_format_hash}`)
  }

  return { scoring_gaps, league_gaps }
}

const main = async () => {
  const start = Date.now()
  let error
  let result
  try {
    result = await detect_projection_format_hash_drift()
  } catch (err) {
    error = err
    log(error)
  }

  const scoring_count = result ? result.scoring_gaps.length : 0
  const league_count = result ? result.league_gaps.length : 0
  const total_gaps = scoring_count + league_count
  const job_reason = `scoring_gaps=${scoring_count} league_gaps=${league_count}`

  await report_job({
    job_type: job_types.DETECT_PROJECTION_FORMAT_HASH_DRIFT,
    job_success: !error && total_gaps === 0,
    job_reason,
    error,
    duration_ms: Date.now() - start
  })

  if (!error && total_gaps > 0) {
    await emit_signal({
      source: SIGNAL_SOURCE,
      kind: 'pipeline_failure',
      severity: 'medium',
      title: `projection-format-hash drift detected: ${job_reason}`,
      payload: {
        scoring_gaps: result.scoring_gaps,
        league_gaps: result.league_gaps
      },
      dedup_key: SIGNAL_DEDUP_FAILURE
    })
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default detect_projection_format_hash_drift
