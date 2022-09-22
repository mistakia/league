import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#common'
import { isMain, getLeague } from '#utils'
import calculateValue from './calculate-vor.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('process-gamelogs')
debug.enable('process-gamelogs')

const processGamelogs = async ({
  lid = 1,
  year = constants.season.year,
  week = constants.season.week
} = {}) => {
  const league = await getLeague(lid)
  const result = await calculateValue({ league, year, week })
  const inserts = []
  for (const pid in result.players) {
    const item = result.players[pid]
    inserts.push({
      pid,
      esbid: item.games[0].esbid,
      lid,
      pos_rnk: item.pos_rnk,
      points: item.points,
      points_added: item.vor
    })
  }

  if (inserts.length) {
    log(
      `Updating ${inserts.length} player gamelogs for league ${lid} in week ${week} ${year}`
    )
    await db('league_player_gamelogs').insert(inserts).onConflict().merge()
  }
}

const main = async () => {
  let error
  try {
    if (argv.all) {
      const results = await db('gamelogs')
        .join('nfl_games', 'nfl_games.esbid', '=', 'gamelogs.esbid')
        .select('gamelogs.year')
        .where('nfl_games.seas_type', 'REG')
        .groupBy('gamelogs.year')
        .orderBy('gamelogs.year', 'asc')

      let years = results.map((r) => r.year)
      if (argv.start) {
        years = years.filter((year) => year >= argv.start)
      }

      for (const year of years) {
        const weeks = await db('gamelogs')
          .join('nfl_games', 'nfl_games.esbid', '=', 'gamelogs.esbid')
          .select('gamelogs.week')
          .where('nfl_games.seas_type', 'REG')
          .where('gamelogs.year', year)
          .groupBy('gamelogs.week')
          .orderBy('gamelogs.week', 'asc')
        for (const { week } of weeks) {
          await processGamelogs({ year, week })
        }
      }
    } else {
      await processGamelogs({ year: argv.year, week: argv.week })
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

export default processGamelogs
