import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main, find_or_create_adp_format } from '#libs-server'
import { adp_format } from '#libs-shared'

// One-shot data migration: backfill adp_format_id on both ADP fact tables from
// the legacy adp_type enum via the libs-shared/adp-format.mjs decode map.
//
// Non-destructive: only fills rows where adp_format_id IS NULL, so it is
// idempotent and safe to re-run. The legacy adp_type columns/enum are dropped
// later in the gated finalize, after every consumer is repointed.
//
// Run order (gated, crons paused):
//   yarn db:exec db/adhoc/2026-06-10-adp-format-dimension.sql   # adds columns
//   NODE_ENV=production node scripts/migrate-adp-type-to-adp-format.mjs --dry
//   NODE_ENV=production node scripts/migrate-adp-type-to-adp-format.mjs

const { decode_adp_type } = adp_format

const log = debug('migrate-adp-type-to-adp-format')
debug.enable('migrate-adp-type-to-adp-format')

const argv = yargs(hideBin(process.argv)).option('dry', {
  type: 'boolean',
  default: false,
  describe: 'report per-table row counts without mutating'
}).argv

// Build a single scoped query for a (table, adp_type[, year]) slice that still
// needs backfill. year is omitted for the index (year is NOT NULL there and we
// do not batch it); for history it batches the 11.1M rows by year. year === null
// targets the history rows with a null year (the column is nullable).
const scoped = (table, { adp_type, year }) => {
  let q = db(table).where({ adp_type }).whereNull('adp_format_id')
  if (year !== undefined) {
    q = year === null ? q.whereNull('year') : q.where({ year })
  }
  return q
}

const distinct_values = async (table, column) =>
  (await db(table).distinct(column)).map((row) => row[column])

const resolve_format_ids = async ({ adp_types, dry_run }) => {
  const format_id_by_type = {}
  for (const adp_type of adp_types) {
    const tuple = decode_adp_type(adp_type)
    if (dry_run) {
      log(`[dry] would resolve adp_format for ${adp_type}: ${JSON.stringify(tuple)}`)
      format_id_by_type[adp_type] = null
    } else {
      format_id_by_type[adp_type] = await find_or_create_adp_format(db, tuple)
      log(`adp_format ${adp_type} -> ${format_id_by_type[adp_type]}`)
    }
  }
  return format_id_by_type
}

const migrate = async ({ dry_run }) => {
  const summary = {
    index_rows: 0,
    index_updated: 0,
    history_rows: 0,
    history_updated: 0
  }

  const index_types = await distinct_values('player_adp_index', 'adp_type')
  const history_types = await distinct_values('player_adp_history', 'adp_type')
  const all_types = [...new Set([...index_types, ...history_types])]
  log(
    `distinct adp_type -- index: ${index_types.length}, history: ${history_types.length}, union: ${all_types.length}`
  )

  const format_id_by_type = await resolve_format_ids({
    adp_types: all_types,
    dry_run
  })

  // player_adp_index: direct per-type update (~352K rows total).
  for (const adp_type of index_types) {
    const { n } = await scoped('player_adp_index', { adp_type })
      .clone()
      .count('* as n')
      .first()
    const count = Number(n)
    summary.index_rows += count
    if (dry_run) {
      log(`[dry] player_adp_index ${adp_type}: ${count} rows`)
      continue
    }
    const updated = await scoped('player_adp_index', { adp_type }).update({
      adp_format_id: format_id_by_type[adp_type]
    })
    summary.index_updated += updated
    log(`player_adp_index ${adp_type}: updated ${updated}`)
  }

  // player_adp_history: batch by year (~11.1M rows) to bound transaction size.
  const history_years = await distinct_values('player_adp_history', 'year')
  for (const year of history_years) {
    for (const adp_type of history_types) {
      const { n } = await scoped('player_adp_history', { adp_type, year })
        .clone()
        .count('* as n')
        .first()
      const count = Number(n)
      if (count === 0) continue
      summary.history_rows += count
      if (dry_run) {
        log(`[dry] player_adp_history year=${year} ${adp_type}: ${count} rows`)
        continue
      }
      const updated = await scoped('player_adp_history', {
        adp_type,
        year
      }).update({ adp_format_id: format_id_by_type[adp_type] })
      summary.history_updated += updated
      log(`player_adp_history year=${year} ${adp_type}: updated ${updated}`)
    }
  }

  return summary
}

const main = async () => {
  let error
  try {
    const summary = await migrate({ dry_run: argv.dry })
    log('=== SUMMARY ===')
    log(`dry_run: ${argv.dry}`)
    log(`player_adp_index rows needing backfill: ${summary.index_rows}`)
    log(`player_adp_index rows updated: ${summary.index_updated}`)
    log(`player_adp_history rows needing backfill: ${summary.history_rows}`)
    log(`player_adp_history rows updated: ${summary.history_updated}`)
  } catch (err) {
    error = err
    log(error)
  }

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default migrate
