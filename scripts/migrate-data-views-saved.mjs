#!/usr/bin/env node

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import debug from 'debug'

import db from '#db'
import { is_main } from '#libs-server'
import { migrate_table_state } from '#libs-shared/data-views-saved-view-migration.mjs'

const log = debug('migrate-data-views-saved')
debug.enable('migrate-data-views-saved')

const TABLES = [
  { name: 'user_data_views', pk: 'view_id' },
  { name: 'user_plays_views', pk: 'view_id' }
]

const run_migration_pass = async ({ executor, table, pk, apply }) => {
  const rows = await executor(table).select(pk, 'table_state')
  let scanned = 0
  let changed_count = 0
  let applied = 0
  for (const row of rows) {
    scanned += 1
    const original = row.table_state
    if (!original || typeof original !== 'object') continue
    const result = migrate_table_state(original)
    if (!result.changed) continue
    changed_count += 1
    log(`[${table}] ${pk}=${row[pk]} would migrate`)
    if (apply) {
      await executor(table)
        .where({ [pk]: row[pk] })
        .update({
          table_state: result.table_state,
          updated_at: db.fn.now()
        })
      applied += 1
    }
  }
  return { table, scanned, changed_count, applied }
}

const migrate_one = async ({ table, pk, apply }) => {
  if (!apply) {
    return run_migration_pass({ executor: db, table, pk, apply })
  }
  return db.transaction((trx) =>
    run_migration_pass({ executor: trx, table, pk, apply })
  )
}

const main = async () => {
  const argv = yargs(hideBin(process.argv))
    .option('apply', {
      type: 'boolean',
      default: false,
      describe: 'Persist migrations. Default is dry-run.'
    })
    .help().argv

  const apply = Boolean(argv.apply)
  log(`mode: ${apply ? 'APPLY' : 'dry-run'}`)

  const summaries = []
  for (const { name, pk } of TABLES) {
    const summary = await migrate_one({ table: name, pk, apply })
    summaries.push(summary)
    log(
      `[${summary.table}] scanned=${summary.scanned} changed=${summary.changed_count} applied=${summary.applied}`
    )
  }

  await db.destroy()

  console.log(JSON.stringify({ apply, summaries }, null, 2))
}

if (is_main(import.meta.url)) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
