import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#libs-shared'
import { is_main, report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('create-season-partitions')
debug.enable('create-season-partitions')

const PARTITIONED_TABLES = [
  {
    parent_table: 'nfl_plays',
    partition_prefix: 'nfl_plays_year_'
  },
  {
    parent_table: 'player_gamelogs',
    partition_prefix: 'player_gamelogs_year_'
  },
  {
    parent_table: 'projections_index',
    // TODO change name format from `y` to `year_`
    partition_prefix: 'projections_index_y'
  },
  {
    parent_table: 'nfl_snaps',
    partition_prefix: 'nfl_snaps_year_'
  }
]

const create_season_partitions = async ({
  year = constants.season.year,
  dry_run = false
} = {}) => {
  log(`Checking for missing partitions for year ${year}`)

  // Get table existence info
  const table_exists_results = await db.raw(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
  `)

  const existing_tables = table_exists_results.rows.map((row) => row.table_name)
  const partition_creation_errors = []

  for (const { parent_table, partition_prefix } of PARTITIONED_TABLES) {
    const partition_table = `${partition_prefix}${year}`

    if (existing_tables.includes(partition_table)) {
      // Verify existing partition has correct configuration
      const partition_bounds_result = await db.raw(
        `
        SELECT pg_get_expr(c.relpartbound, c.oid) as bounds
        FROM pg_class c
        WHERE c.relname = ?
      `,
        [partition_table]
      )

      const partition_bounds = partition_bounds_result.rows[0]?.bounds
      const expected_year_start = `'${year}'`
      const expected_year_end = `'${year + 1}'`

      if (
        partition_bounds &&
        (!partition_bounds.includes(expected_year_start) ||
          !partition_bounds.includes(expected_year_end))
      ) {
        log(
          `WARNING: Partition ${partition_table} exists but has unexpected bounds: ${partition_bounds}`
        )
        log(
          `Expected bounds to include: FROM ${expected_year_start} TO ${expected_year_end}`
        )
      } else {
        log(
          `Partition table ${partition_table} already exists with correct configuration`
        )
      }
      continue
    }

    log(`Creating partition table ${partition_table} for year ${year}`)

    if (dry_run) {
      log(`[DRY RUN] Would create partition table ${partition_table}`)
      continue
    }

    try {
      // Wrap entire partition creation in a transaction for atomicity
      await db.transaction(async (trx) => {
        // Check if default partition exists and contains data for this year
        const default_partition_name = `${parent_table}_default`
        const has_default_partition = existing_tables.includes(
          default_partition_name
        )

        let moved_data_count = 0
        const temp_table_name = `temp_partition_data_${year}_${Date.now()}`

        if (has_default_partition) {
          // Check if default partition has data for this year
          const conflict_check_result = await trx.raw(
            `
            SELECT EXISTS(
              SELECT 1 FROM ONLY ${default_partition_name}
              WHERE year = ?
              LIMIT 1
            ) as has_conflict
          `,
            [year]
          )

          const has_conflict = conflict_check_result.rows[0]?.has_conflict

          if (has_conflict) {
            log(
              `Default partition ${default_partition_name} contains year ${year} data, moving it first`
            )

            // Move conflicting data to temporary table
            await trx.raw(
              `
              CREATE TEMP TABLE ${temp_table_name} AS
              SELECT * FROM ONLY ${default_partition_name} WHERE year = ?
            `,
              [year]
            )

            // Get count of moved rows for logging
            const count_result = await trx.raw(
              `SELECT COUNT(*) as count FROM ${temp_table_name}`
            )
            moved_data_count = parseInt(count_result.rows[0]?.count || 0)

            // Delete from default partition
            await trx.raw(
              `
              DELETE FROM ONLY ${default_partition_name} WHERE year = ?
            `,
              [year]
            )

            log(
              `Moved ${moved_data_count} rows from default partition to temporary table`
            )
          }
        }

        // Create the new partition
        await trx.raw(`
          CREATE TABLE public.${partition_table} PARTITION OF public.${parent_table}
          FOR VALUES FROM (${year}) TO (${year + 1});
        `)

        log(`Successfully created partition table ${partition_table}`)

        // If we moved data, restore it to the new partition via parent table
        if (moved_data_count > 0) {
          log(
            `Restoring ${moved_data_count} rows to new partition ${partition_table}`
          )

          await trx.raw(`
            INSERT INTO ${parent_table} SELECT * FROM ${temp_table_name}
          `)

          await trx.raw(`DROP TABLE ${temp_table_name}`)

          log(
            `Successfully restored ${moved_data_count} rows to partition ${partition_table}`
          )
        }
      })
    } catch (error) {
      const error_message = `Error creating partition table ${partition_table}: ${error.message}`
      log(error_message)
      log(`Failed SQL:
        CREATE TABLE public.${partition_table} PARTITION OF public.${parent_table}
        FOR VALUES FROM (${year}) TO (${year + 1});
      `)

      // Store error but continue processing other tables
      partition_creation_errors.push({
        partition_table,
        parent_table,
        error: error.message
      })
    }
  }

  if (partition_creation_errors.length > 0) {
    log('Partition creation completed with errors:')
    for (const error_info of partition_creation_errors) {
      log(
        `  - ${error_info.partition_table} (${error_info.parent_table}): ${error_info.error}`
      )
    }
  } else {
    log('Partition creation process completed successfully')
    log('REMINDER: Run `yarn export:schema` to update schema.postgres.sql')
  }

  return {
    success: partition_creation_errors.length === 0,
    errors: partition_creation_errors
  }
}

const main = async () => {
  let error
  try {
    const year = argv.year ? Number(argv.year) : constants.season.year
    const dry_run = argv.dry || false

    await create_season_partitions({ year, dry_run })
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.CREATE_SEASON_PARTITIONS,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default create_season_partitions
