/**
 * Generate Historical Injury Index
 *
 * Rebuilds the historical_injury_index table for one or more seasons.
 * Source-of-truth SQL lives in scripts/historical-injury-index-sql.mjs.
 *
 * Per-year rebuild semantics:
 *  - SELECTs the validated rebuild query bound to a single year.
 *  - Batch-UPSERTs into historical_injury_index with merge on
 *    (pid, year, week, esbid).
 *
 * Usage:
 *   node scripts/generate-historical-injury-index.mjs --year 2024
 *   node scripts/generate-historical-injury-index.mjs --start_year 2009 --end_year 2025
 *   node scripts/generate-historical-injury-index.mjs --year 2024 --dry_run
 */

import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { current_season } from '#constants'
import {
  is_main,
  report_job,
  batch_insert,
  throw_if_shortfall
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

import { rebuild_sql } from './historical-injury-index-sql.mjs'

const log = debug('generate-historical-injury-index')
debug.enable('generate-historical-injury-index')

const BATCH_SIZE = 500
const PARTITION_LOWER_BOUND = 2009
const ORACLE_DEVIATION_THRESHOLD = 0.05

const initialize_cli = () =>
  yargs(hideBin(process.argv))
    .option('year', { type: 'number' })
    .option('start_year', { type: 'number' })
    .option('end_year', { type: 'number' })
    .option('pid', { type: 'string' })
    .option('dry_run', { type: 'boolean', default: false }).argv

const get_existing_row_count = async ({ year }) => {
  const rows = await db('historical_injury_index')
    .where({ year })
    .count({ c: '*' })
  return Number(rows[0]?.c || 0)
}

const generate_for_year = async ({ year, pid, dry_run }) => {
  log(`processing year ${year}`)
  const prior_count = await get_existing_row_count({ year })
  log(`prior row count for year ${year}: ${prior_count}`)

  const select_result = await db.raw(rebuild_sql, {
    start_year: year,
    end_year: year
  })
  let rows = select_result.rows
  if (pid) rows = rows.filter((r) => r.pid === pid)
  log(`selected ${rows.length} rows from rebuild SQL for year ${year}`)

  if (!rows.length) {
    return {
      shortfall: `historical_injury_index year ${year}: rebuild SQL returned zero rows`,
      rows_written: 0
    }
  }

  const now = Math.round(Date.now() / 1000)
  // Dedupe on the PK -- the spine can emit two rows for the same
  // (pid, year, week, esbid) when a player's two team_spans both contain
  // the game (e.g. traded mid-season to the week's opponent). PostgreSQL
  // refuses to UPSERT a batch that touches the same row twice.
  const dedup = new Map()
  for (const r of rows) {
    dedup.set(`${r.pid}|${r.year}|${r.week}|${r.esbid}`, r)
  }
  const before_dedup = rows.length
  const deduped = Array.from(dedup.values())
  if (before_dedup !== deduped.length) {
    log(
      `deduped ${before_dedup - deduped.length} (pid,year,week,esbid) duplicates -> ${deduped.length} rows`
    )
  }
  const items = deduped.map((r) => ({
    ...r,
    inserted_at: now,
    updated_at: now
  }))

  if (dry_run) {
    log(`dry_run: would upsert ${items.length} rows for ${year}`)
    return { shortfall: null, rows_written: 0 }
  }

  await batch_insert({
    items,
    batch_size: BATCH_SIZE,
    save: async (batch) => {
      await db('historical_injury_index')
        .insert(batch)
        .onConflict(['pid', 'year', 'week', 'esbid'])
        .merge()
    }
  })
  log(`upserted ${items.length} rows for ${year}`)

  // Output oracle: distinct from process exit code. Compares the
  // post-rebuild row count against the prior count. First-run skip
  // (prior_count == 0) handles initial backfill and new-season early
  // weeks where no prior baseline exists.
  let oracle_shortfall = null
  if (!pid) {
    const post_count = await get_existing_row_count({ year })
    if (prior_count === 0) {
      log(
        `oracle: year ${year} first run; baseline established at ${post_count}`
      )
    } else {
      const deviation = Math.abs(post_count - prior_count) / prior_count
      log(
        `oracle: year ${year} prior=${prior_count} post=${post_count} deviation=${(deviation * 100).toFixed(2)}%`
      )
      if (deviation > ORACLE_DEVIATION_THRESHOLD) {
        oracle_shortfall = `historical_injury_index year ${year}: row count deviated ${(deviation * 100).toFixed(1)}% (prior=${prior_count}, post=${post_count}) -- exceeds ${ORACLE_DEVIATION_THRESHOLD * 100}% threshold`
      }
    }
  }

  return { shortfall: oracle_shortfall, rows_written: items.length }
}

const generate_historical_injury_index = async ({
  year,
  start_year,
  end_year,
  pid,
  dry_run = false
}) => {
  const years = []
  if (start_year && end_year) {
    if (start_year > end_year) {
      throw new Error(`start_year ${start_year} > end_year ${end_year}`)
    }
    if (start_year < PARTITION_LOWER_BOUND) {
      throw new Error(
        `start_year ${start_year} must be >= ${PARTITION_LOWER_BOUND} (partition lower bound)`
      )
    }
    for (let y = start_year; y <= end_year; y++) years.push(y)
  } else {
    const y = year || current_season.year
    if (y < PARTITION_LOWER_BOUND) {
      throw new Error(
        `year ${y} must be >= ${PARTITION_LOWER_BOUND} (partition lower bound)`
      )
    }
    years.push(y)
  }

  let total_written = 0
  const shortfalls = []
  for (const y of years) {
    const { shortfall, rows_written } = await generate_for_year({
      year: y,
      pid,
      dry_run
    })
    total_written += rows_written
    if (shortfall) shortfalls.push(shortfall)
  }

  log(`total rows upserted across ${years.length} year(s): ${total_written}`)
  return { shortfall: shortfalls.length ? shortfalls.join('; ') : null }
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const result = await generate_historical_injury_index({
      year: argv.year,
      start_year: argv.start_year,
      end_year: argv.end_year,
      pid: argv.pid,
      dry_run: argv.dry_run
    })
    throw_if_shortfall(result?.shortfall)
  } catch (err) {
    error = err
    log(err)
  }

  await report_job({
    job_type: job_types.GENERATE_HISTORICAL_INJURY_INDEX,
    error
  })

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default generate_historical_injury_index
