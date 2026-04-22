import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main } from '#libs-server'
import {
  migrate_column_entry,
  RANKING_NAMES_MAP,
  SINGLE_WEEK_COLUMNS,
  MULTI_WEEK_COLUMNS
} from '#libs-shared/data-views-nfl-week-migration.mjs'

const log = debug('migrate-data-views-single-nfl-week')

const argv = yargs(hideBin(process.argv))
  .option('apply', {
    type: 'boolean',
    describe: 'Write changes to database (default is dry-run)',
    default: false
  })
  .option('verbose', {
    type: 'boolean',
    describe: 'Show detailed output for each view',
    default: false
  })
  .option('chunk-size', {
    type: 'number',
    describe: 'Rows to fetch per batch',
    default: 500
  }).argv

const is_target_column = (column_id) =>
  SINGLE_WEEK_COLUMNS.has(column_id) ||
  MULTI_WEEK_COLUMNS.has(column_id) ||
  Object.prototype.hasOwnProperty.call(RANKING_NAMES_MAP, column_id)

const migrate_entries = (entries) => {
  let changed = false
  if (!Array.isArray(entries)) return { changed, entries }

  const out = entries.map((entry) => {
    if (typeof entry === 'string') {
      if (!is_target_column(entry)) return entry
      const migrated = migrate_column_entry({ column_id: entry, params: {} })
      if (migrated.column_id !== entry) {
        changed = true
        return migrated.column_id
      }
      return entry
    }
    if (!entry || !entry.column_id) return entry
    if (!is_target_column(entry.column_id)) return entry
    const before_id = entry.column_id
    const before_params = JSON.stringify(entry.params || {})
    const migrated = migrate_column_entry({
      column_id: entry.column_id,
      params: entry.params || {}
    })
    if (
      migrated.column_id !== before_id ||
      JSON.stringify(migrated.params) !== before_params
    ) {
      changed = true
    }
    return {
      ...entry,
      column_id: migrated.column_id,
      params: migrated.params
    }
  })
  return { changed, entries: out }
}

const migrate_table_state = (table_state) => {
  if (!table_state || typeof table_state !== 'object') {
    return { changed: false, table_state }
  }
  let any_changed = false
  const next = { ...table_state }
  for (const key of ['columns', 'prefix_columns', 'where']) {
    if (Array.isArray(table_state[key])) {
      const { changed, entries } = migrate_entries(table_state[key])
      if (changed) {
        any_changed = true
        next[key] = entries
      }
    }
  }
  return { changed: any_changed, table_state: next }
}

const migrate_table = async ({ table, id_column, apply, verbose, chunk_size }) => {
  let last_id = null
  let total = 0
  let migrated_count = 0
  let skipped_count = 0

  while (true) {
    const query = db(table)
      .select(id_column, 'table_state')
      .orderBy(id_column, 'asc')
      .limit(chunk_size)
    if (last_id != null) query.where(id_column, '>', last_id)
    const views = await query
    if (!views.length) break

    const updates = []
    for (const view of views) {
      const id = view[id_column]
      last_id = id
      total++
      const { table_state } = view
      if (!table_state) {
        skipped_count++
        continue
      }
      const parsed =
        typeof table_state === 'string' ? JSON.parse(table_state) : table_state
      const { changed, table_state: new_state } = migrate_table_state(parsed)
      if (!changed) {
        skipped_count++
        continue
      }
      migrated_count++
      if (verbose) log(`  Migrating ${table}.${id_column}=${id}`)
      if (apply) updates.push({ id, new_state })
    }

    if (apply && updates.length) {
      await db.transaction(async (trx) => {
        for (const { id, new_state } of updates) {
          await trx(table)
            .where(id_column, id)
            .update({
              table_state: JSON.stringify(new_state),
              updated_at: new Date()
            })
        }
      })
    }
  }

  log(`${table}: total=${total} migrated=${migrated_count} skipped=${skipped_count}`)
}

const main = async () => {
  const apply = argv.apply
  const verbose = argv.verbose
  const chunk_size = argv.chunkSize
  log(`Starting single_nfl_week_id migration${apply ? '' : ' (DRY RUN)'}...`)

  await migrate_table({
    table: 'user_data_views',
    id_column: 'view_id',
    apply,
    verbose,
    chunk_size
  })
  await migrate_table({
    table: 'user_plays_views',
    id_column: 'view_id',
    apply,
    verbose,
    chunk_size
  })

  if (!apply) log('(DRY RUN - pass --apply to write)')
}

if (is_main(import.meta.url)) {
  try {
    await main()
  } catch (err) {
    console.error(err)
  }
  process.exit()
}

export default main
