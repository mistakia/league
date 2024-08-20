import debug from 'debug'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone.js'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
// import { constants } from '#libs-shared'
import { isMain, getGameDayAbbreviation } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

dayjs.extend(timezone)

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('process-nfl-games')
debug.enable('process-nfl-games')

const processNflGames = async () => {
  const games = await db('nfl_games')
  const updates = []
  for (const {
    date,
    time_est,
    v,
    h,
    week,
    year,
    seas_type,
    week_type
  } of games) {
    if (date && time_est) {
      const datetime = dayjs.tz(
        `${date} ${time_est}`,
        'YYYY/MM/DD HH:mm:ss',
        'America/New_York'
      )

      const update = {
        v,
        h,
        week,
        year,
        seas_type,
        timestamp: datetime.unix()
      }

      if (week_type) {
        update.day = getGameDayAbbreviation({
          seas_type,
          date,
          time_est,
          week_type
        })
      }

      updates.push(update)
    }
  }

  if (updates.length) {
    log(`updating ${updates.length} nfl games`)
    await db('nfl_games').insert(updates).onConflict('esbid').merge()
  } else {
    log('No games to update')
  }
}

const main = async () => {
  let error
  try {
    await processNflGames()
  } catch (err) {
    error = err
    log(error)
  }

  /* await db('jobs').insert({
   *   type: job_types.EXAMPLE,
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

export default processNflGames
