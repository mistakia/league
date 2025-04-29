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

  for (const { parent_table, partition_prefix } of PARTITIONED_TABLES) {
    const partition_table = `${partition_prefix}${year}`

    if (existing_tables.includes(partition_table)) {
      log(`Partition table ${partition_table} already exists, skipping`)
      continue
    }

    log(`Creating partition table ${partition_table} for year ${year}`)

    if (dry_run) {
      log(`[DRY RUN] Would create partition table ${partition_table}`)
      continue
    }

    try {
      // Create the new partition
      await db.raw(`
        CREATE TABLE public.${partition_table} PARTITION OF public.${parent_table}
        FOR VALUES FROM (${year}) TO (${year + 1});
      `)

      log(`Successfully created partition table ${partition_table}`)
    } catch (error) {
      log(`Error creating partition table ${partition_table}: ${error.message}`)
      log(`Failed SQL: 
        CREATE TABLE public.${partition_table} PARTITION OF public.${parent_table}
        FOR VALUES FROM (${year}) TO (${year + 1});
      `)
      throw error
    }
  }

  log('Partition creation process completed')
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
