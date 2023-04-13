import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#common'
import { isMain, getLeague } from '#utils'
import calculateValue from './calculate-vor.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('generate-league-player-gamelogs')
debug.enable('generate-league-player-gamelogs')

const generate_league_player_gamelogs = async ({
  lid = 1,
  year = constants.season.year,
  week = constants.season.week
} = {}) => {
  const league = await getLeague({ lid })
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
    const pids = inserts.map((p) => p.pid)
    const deleted_count = await db('league_player_gamelogs')
      .leftJoin('nfl_games', 'league_player_gamelogs.esbid', 'nfl_games.esbid')
      .where('nfl_games.week', week)
      .where('nfl_games.year', year)
      .where('nfl_games.seas_type', 'REG')
      .whereNotIn('league_player_gamelogs.pid', pids)
      .del()
    log(
      `Deleted ${deleted_count} excess player gamelogs for league ${lid} in week ${week} ${year}`
    )

    await db('league_player_gamelogs').insert(inserts).onConflict().merge()
    log(
      `Updated ${inserts.length} player gamelogs for league ${lid} in week ${week} ${year}`
    )
  }
}

const main = async () => {
  let error
  try {
    if (argv.all) {
      const results = await db('player_gamelogs')
        .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
        .select('nfl_games.year')
        .where('nfl_games.seas_type', 'REG')
        .groupBy('nfl_games.year')
        .orderBy('nfl_games.year', 'asc')

      let years = results.map((r) => r.year)
      if (argv.start) {
        years = years.filter((year) => year >= argv.start)
      }

      for (const year of years) {
        const weeks = await db('player_gamelogs')
          .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
          .select('nfl_games.week')
          .where('nfl_games.seas_type', 'REG')
          .where('nfl_games.year', year)
          .groupBy('nfl_games.week')
          .orderBy('nfl_games.week', 'asc')
        for (const { week } of weeks) {
          await generate_league_player_gamelogs({ year, week })
        }
      }
    } else {
      await generate_league_player_gamelogs({
        year: argv.year,
        week: argv.week
      })
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

export default generate_league_player_gamelogs
