import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#libs-shared'
import { is_main } from '#libs-server'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('populate-nfl-year-week-timestamp')
debug.enable('populate-nfl-year-week-timestamp')

const populate_nfl_year_week_timestamp = async ({
  year = constants.season.year
} = {}) => {
  log(`Refreshing nfl_year_week_timestamp materialized view`)

  // Check if NFL games data exists for the year
  const games_count = await db('nfl_games')
    .where({ year, seas_type: 'REG' })
    .count('* as count')
    .first()

  if (!games_count || games_count.count === '0') {
    log(`No NFL regular season games found for year ${year}`)
    return {
      success: false,
      error: 'No NFL games data found',
      year
    }
  }

  log(`Found ${games_count.count} regular season games for ${year}`)

  // Check current state before refresh
  const before_refresh = await db('nfl_year_week_timestamp')
    .where({ year })
    .count('* as count')
    .first()

  log(`Current records for ${year}: ${before_refresh?.count || 0}`)

  // Refresh the materialized view
  log(`Refreshing materialized view...`)
  await db.raw('REFRESH MATERIALIZED VIEW nfl_year_week_timestamp')

  // Check results after refresh
  const after_refresh = await db('nfl_year_week_timestamp')
    .where({ year })
    .orderBy('week')

  log(`After refresh: ${after_refresh.length} week records for ${year}`)

  // Validate results
  const expected_weeks = 18
  if (after_refresh.length < expected_weeks) {
    log(
      `Warning: Expected ${expected_weeks} weeks but found ${after_refresh.length}`
    )
  }

  return {
    success: true,
    year,
    weeks_found: after_refresh.length,
    weeks_expected: expected_weeks,
    games_found: parseInt(games_count.count),
    complete: after_refresh.length >= expected_weeks
  }
}

const main = async () => {
  let error
  try {
    const result = await populate_nfl_year_week_timestamp({ year: argv.year })
    log('Operation completed:', result)
  } catch (err) {
    error = err
    log('Error:', error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default populate_nfl_year_week_timestamp
