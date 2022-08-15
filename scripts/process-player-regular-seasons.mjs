import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { sum, groupBy } from '#common'
import { isMain } from '#utils'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('process-player-regular-seasons')
debug.enable('process-player-regular-seasons')

const processSeasons = async ({ seas, lid = 1 }) => {
  // get league player gamelogs for season
  const gamelogs = await db('league_player_gamelogs')
    .select('league_player_gamelogs.*', 'player.pos')
    .join('player', 'player.pid', 'league_player_gamelogs.pid')
    .join('nfl_games', 'league_player_gamelogs.esbid', 'nfl_games.esbid')
    .where({ seas, seas_type: 'REG', lid })

  const inserts = []

  const pids = [...new Set(gamelogs.map((g) => g.pid))]
  for (const pid of pids) {
    // get gamelogs for pid
    const player_gamelogs = gamelogs.filter((g) => g.pid === pid)
    const pos = player_gamelogs[0].pos

    // process / create inserts
    inserts.push({
      pid,
      seas,
      lid,
      pos,
      games: player_gamelogs.length,
      points: sum(player_gamelogs.map((g) => g.points)),
      points_added: sum(player_gamelogs.map((g) => g.points_added))
    })
  }

  const seasons_by_pos = groupBy(inserts, 'pos')
  for (const pos in seasons_by_pos) {
    seasons_by_pos[pos] = seasons_by_pos[pos]
      .map((i) => i.points_added)
      .sort((a, b) => b - a)
  }

  for (const insert of inserts) {
    insert.pos_rnk = seasons_by_pos[insert.pos].indexOf(insert.points_added) + 1
    delete insert.pos
  }

  // save inserts
  if (inserts.length) {
    log(`updated ${inserts.length} player regular seasons`)
    await db('league_player_regular_seasons')
      .insert(inserts)
      .onConflict()
      .merge()
  }
}

const main = async () => {
  let error
  try {
    const lid = argv.lid || 1
    if (argv.all) {
      const results = await db('league_player_gamelogs')
        .join(
          'nfl_games',
          'nfl_games.esbid',
          '=',
          'league_player_gamelogs.esbid'
        )
        .select('nfl_games.seas')
        .where('nfl_games.seas_type', 'REG')
        .where('league_player_gamelogs.lid', lid)
        .groupBy('nfl_games.seas')
        .orderBy('nfl_games.seas', 'asc')

      let years = results.map((r) => r.seas)
      if (argv.start) {
        years = years.filter((year) => year >= argv.start)
      }

      for (const year of years) {
        await processSeasons({ seas: year, lid })
      }
    } else {
      await processSeasons({ seas: argv.seas, lid })
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

export default processSeasons
