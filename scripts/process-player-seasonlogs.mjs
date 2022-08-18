import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#common'
import { isMain } from '#utils'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('process-player-seasonlogs')
debug.enable('process-player-seasonlogs')

const processPlayerSeasonlogs = async ({
  seas = constants.season.year,
  seas_type = 'REG'
} = {}) => {
  // get league player gamelogs for season
  const gamelogs = await db('gamelogs')
    .select('gamelogs.*', 'player.pos')
    .join('player', 'player.pid', 'gamelogs.pid')
    .join('nfl_games', 'gamelogs.esbid', 'nfl_games.esbid')
    .where({ seas, seas_type })

  const inserts = []

  const pids = [...new Set(gamelogs.map((g) => g.pid))]
  for (const pid of pids) {
    // get gamelogs for pid
    const player_gamelogs = gamelogs.filter((g) => g.pid === pid)
    const pos = player_gamelogs[0].pos

    const season_stats = constants.createStats()
    for (const gamelog of player_gamelogs) {
      for (const stat in season_stats) {
        season_stats[stat] += gamelog[stat]
      }
    }

    inserts.push({
      pid,
      year: seas,
      seas_type,
      pos,
      ...season_stats
    })
  }

  if (inserts.length) {
    log(`updating ${inserts.length} player seasonlogs for ${seas} ${seas_type}`)
    await db('player_seasonlogs').insert(inserts).onConflict().merge()
  }
}

const main = async () => {
  let error
  try {
    if (argv.all) {
      const results = await db('gamelogs')
        .join('nfl_games', 'nfl_games.esbid', '=', 'gamelogs.esbid')
        .select('nfl_games.seas')
        .where('nfl_games.seas_type', 'REG')
        .groupBy('nfl_games.seas')
        .orderBy('nfl_games.seas', 'asc')

      let years = results.map((r) => r.seas)
      if (argv.start) {
        years = years.filter((year) => year >= argv.start)
      }

      for (const year of years) {
        await processPlayerSeasonlogs({ seas: year })
      }
    } else {
      await processPlayerSeasonlogs({ seas: argv.seas })
    }
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

export default processPlayerSeasonlogs
