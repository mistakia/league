import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#libs-shared'
import { is_main } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('process-player-seasonlogs')
debug.enable('process-player-seasonlogs')

const processPlayerSeasonlogs = async ({
  year = constants.season.year,
  seas_type = 'REG'
} = {}) => {
  // get league player gamelogs for season
  const gamelogs = await db('player_gamelogs')
    .select('player_gamelogs.*', 'player.pos')
    .join('player', 'player.pid', 'player_gamelogs.pid')
    .join('nfl_games', 'player_gamelogs.esbid', 'nfl_games.esbid')
    .where('nfl_games.year', year)
    .where('nfl_games.seas_type', seas_type)

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
      year,
      seas_type,
      pos,
      ...season_stats
    })
  }

  if (inserts.length) {
    const pids = inserts.map((p) => p.pid)
    const deleted_count = await db('player_seasonlogs')
      .where({ year, seas_type })
      .whereNotIn('pid', pids)
      .del()
    log(`Deleted ${deleted_count} excess player seasonlogs`)

    log(`updating ${inserts.length} player seasonlogs for ${year} ${seas_type}`)
    await db('player_seasonlogs')
      .insert(inserts)
      .onConflict(['pid', 'year', 'seas_type'])
      .merge()
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
        await processPlayerSeasonlogs({ year })
      }
    } else {
      await processPlayerSeasonlogs({ year: argv.year })
    }
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default processPlayerSeasonlogs
