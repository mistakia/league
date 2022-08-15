import debug from 'debug'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
import generateSeasonDates from './generate-season-dates.mjs'
import { groupBy, Season } from '#common'
import { isMain } from '#utils'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('migrate-data')
debug.enable('migrate-data')

const migrateData = async () => {
  // get transactions for league and set week
  const transactions = await db('transactions')
  const transactions_by_year = groupBy(transactions, 'year')
  for (const year in transactions_by_year) {
    const season_dates = await generateSeasonDates({ year })
    const year_transactions = transactions_by_year[year]
    for (const { uid, timestamp } of year_transactions) {
      const season = new Season({ ...season_dates, now: timestamp })
      const week = season.week
      await db('transactions').update({ week }).where({ uid })
    }
  }
}

const main = async () => {
  let error
  try {
    await migrateData()
  } catch (err) {
    error = err
    log(error)
  }

  /* await db('jobs').insert({
   *   type: constants.jobs.EXAMPLE,
   *   succ: error ? 0 : 1,
   *   reason: error ? error.message : null,
   *   timestamp: Math.round(Date.now() / 1000)
   * })
   */
  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default migrateData
