import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main } from '#libs-server'
import { format_nfl_week_identifier } from '#libs-shared/nfl-week-identifier.mjs'

const log = debug('migrate-data-views')

const argv = yargs(hideBin(process.argv))
  .option('dry-run', {
    type: 'boolean',
    describe: 'Preview changes without writing to database',
    default: false
  })
  .option('verbose', {
    type: 'boolean',
    describe: 'Show detailed output for each view',
    default: false
  }).argv

const convert_dynamic_value = (item) => {
  if (typeof item !== 'object' || item === null || !item.dynamic_type) {
    return null
  }

  switch (item.dynamic_type) {
    case 'last_n_weeks':
      return { dynamic_type: 'last_n_nfl_weeks', value: item.value }
    case 'current_week':
      return { dynamic_type: 'current_nfl_week' }
    default:
      return null
  }
}

const migrate_column_params = (params) => {
  if (!params || typeof params !== 'object') return { changed: false, params }

  const has_year = params.year !== undefined
  const has_week = params.week !== undefined

  // Season-level columns (year without week) are left unchanged
  if (has_year && !has_week) {
    return { changed: false, params }
  }

  // No year or week params -- nothing to migrate
  if (!has_year && !has_week) {
    return { changed: false, params }
  }

  // Both year and week present -- convert to nfl_week
  const new_params = { ...params }
  const nfl_week_values = []

  const year_values = Array.isArray(params.year) ? params.year : [params.year]
  const week_values = Array.isArray(params.week) ? params.week : [params.week]
  const seas_type = Array.isArray(params.seas_type)
    ? params.seas_type[0]
    : params.seas_type || 'REG'

  for (const y of year_values) {
    // Handle dynamic year values
    if (typeof y === 'object' && y !== null && y.dynamic_type) {
      // Dynamic years paired with weeks -- complex case, log for review
      log(`  Skipping dynamic year value: ${JSON.stringify(y)}`)
      return { changed: false, params }
    }

    for (const w of week_values) {
      // Handle dynamic week values
      if (typeof w === 'object' && w !== null && w.dynamic_type) {
        const converted = convert_dynamic_value(w)
        if (converted) {
          nfl_week_values.push(converted)
          continue
        }
      }

      const numeric_year = parseInt(y, 10)
      const numeric_week = parseInt(w, 10)
      if (!isNaN(numeric_year) && !isNaN(numeric_week)) {
        nfl_week_values.push(
          format_nfl_week_identifier({
            year: numeric_year,
            seas_type,
            week: numeric_week
          })
        )
      }
    }
  }

  if (!nfl_week_values.length) {
    return { changed: false, params }
  }

  new_params.nfl_week_id = nfl_week_values
  delete new_params.year
  delete new_params.week
  delete new_params.seas_type

  return { changed: true, params: new_params }
}

const migrate_table_state = (table_state) => {
  if (!table_state || typeof table_state !== 'object') {
    return { changed: false, table_state }
  }

  let any_changed = false

  // Migrate column params
  if (table_state.columns && Array.isArray(table_state.columns)) {
    for (const column of table_state.columns) {
      if (column.params) {
        const { changed, params } = migrate_column_params(column.params)
        if (changed) {
          column.params = params
          any_changed = true
        }
      }
    }
  }

  // Migrate where clause params
  if (table_state.where && Array.isArray(table_state.where)) {
    for (const where_item of table_state.where) {
      if (where_item.params) {
        const { changed, params } = migrate_column_params(where_item.params)
        if (changed) {
          where_item.params = params
          any_changed = true
        }
      }
    }
  }

  return { changed: any_changed, table_state }
}

const main = async () => {
  const dry_run = argv['dry-run']
  const verbose = argv.verbose

  log(`Starting migration${dry_run ? ' (DRY RUN)' : ''}...`)

  const views = await db('user_data_views').select(
    'view_id',
    'view_name',
    'table_state'
  )

  let migrated_count = 0
  let skipped_count = 0
  let season_level_count = 0

  for (const view of views) {
    const { view_id, view_name, table_state } = view

    if (!table_state) {
      skipped_count++
      continue
    }

    const parsed_state =
      typeof table_state === 'string' ? JSON.parse(table_state) : table_state

    const { changed, table_state: new_state } =
      migrate_table_state(parsed_state)

    if (!changed) {
      skipped_count++

      // Check for season-level columns (year without week)
      if (parsed_state.columns) {
        for (const col of parsed_state.columns) {
          if (col.params && col.params.year && !col.params.week) {
            season_level_count++
            if (verbose) {
              log(
                `  Season-level column in view "${view_name}" (${view_id}): year without week`
              )
            }
          }
        }
      }
      continue
    }

    migrated_count++
    if (verbose) {
      log(`  Migrating view "${view_name}" (${view_id})`)
    }

    if (!dry_run) {
      await db('user_data_views')
        .where('view_id', view_id)
        .update({
          table_state: JSON.stringify(new_state),
          updated_at: new Date()
        })
    }
  }

  log(`Migration complete:`)
  log(`  Total views: ${views.length}`)
  log(`  Migrated: ${migrated_count}`)
  log(`  Skipped (no changes): ${skipped_count}`)
  log(`  Season-level columns (left unchanged): ${season_level_count}`)
  if (dry_run) {
    log(`  (DRY RUN - no changes written)`)
  }
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
