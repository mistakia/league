import debug from 'debug'
import dayjs from 'dayjs'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

// import db from '#db'
import { constants } from '#common'
import { isMain } from '#utils'

import process_play_stats from './process-play-stats.mjs'
import generate_league_player from './generate-league-player.mjs'
import generate_league_player_gamelogs from './generate-league-player-gamelogs.mjs'
import generate_league_player_regular_seasonlogs from './generate-league-player-regular-seasonlogs.mjs'
import generate_nfl_team_seasonlogs from './generate-nfl-team-seasonlogs.mjs'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('update-stats-weekly')
debug.enable('update-stats-weekly')

const update_stats_weekly = async () => {
  const day = dayjs().day()
  const week = Math.max(
    [2, 3].includes(day) ? constants.season.week - 1 : constants.season.week,
    1
  )
  const lid = 1

  log(`updating stats for week ${week} (lid: ${lid})`)

  // process play stats / generate player_gamelogs
  await process_play_stats({ week })

  await generate_league_player_gamelogs({ week, lid })
  await generate_league_player_regular_seasonlogs({ lid })

  // TODO generate player_seasonlogs

  await generate_league_player({ lid })
  await generate_nfl_team_seasonlogs()
}

const main = async () => {
  let error
  try {
    await update_stats_weekly()
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

export default update_stats_weekly
