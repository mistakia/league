import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#libs-shared'
import { is_main, batch_insert } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'
import handle_season_args_for_script from '#libs-server/handle-season-args-for-script.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('process-player-seasonlogs')
debug.enable('process-player-seasonlogs')

const processPlayerSeasonlogs = async ({
  year = constants.season.year,
  seas_type = 'REG'
} = {}) => {
  log(`Processing player seasonlogs for ${year}, ${seas_type}`)

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
    log(`updating ${inserts.length} player seasonlogs for ${year} ${seas_type}`)
    await batch_insert({
      items: inserts,
      save: async (batch) => {
        await db('player_seasonlogs')
          .insert(batch)
          .onConflict(['pid', 'year', 'seas_type'])
          .merge()
      },
      batch_size: 500
    })
  }

  log(`Processed player seasonlogs for ${year}, ${seas_type}`)
}

const main = async () => {
  let error
  try {
    await handle_season_args_for_script({
      argv,
      script_name: 'process-player-seasonlogs',
      script_function: processPlayerSeasonlogs,
      year_query: ({ seas_type = 'REG' }) =>
        db('player_gamelogs')
          .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
          .select('nfl_games.year')
          .where('nfl_games.seas_type', seas_type)
          .groupBy('nfl_games.year')
          .orderBy('nfl_games.year', 'asc'),
      seas_type: argv.seas_type || 'REG'
    })
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
