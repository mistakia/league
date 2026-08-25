import debug from 'debug'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone.js'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main } from '#libs-server'
import { getGameDayAbbreviation } from '#libs-shared'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'
// import { job_types } from '#libs-shared/job-.mjs'

dayjs.extend(timezone)

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('process-nfl-games')
enable_debug_namespaces('process-nfl-games')

const processNflGames = async () => {
  const games = await db('nfl_games')
  const updates = []
  for (const {
    date,
    time_eastern,
    away_nfl_team,
    home_nfl_team,
    week,
    season_year,
    season_type,
    week_type
  } of games) {
    if (date && time_eastern) {
      const datetime = dayjs.tz(
        `${date} ${time_eastern}`,
        'YYYY/MM/DD HH:mm:ss',
        'America/New_York'
      )

      const update = {
        away_nfl_team,
        home_nfl_team,
        week,
        season_year,
        season_type,
        kickoff_at: datetime.toDate()
      }

      if (week_type) {
        update.day = getGameDayAbbreviation({
          season_type,
          date,
          time_eastern,
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

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default processNflGames
