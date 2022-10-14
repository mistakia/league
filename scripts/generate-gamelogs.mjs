import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, calculateStatsFromPlays, groupBy } from '#common'
import { isMain, get_plays_query } from '#utils'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('generate-gamelogs')
debug.enable('generate-gamelogs')

const generate_gamelogs = async ({
  week = constants.season.week,
  year = constants.season.year
} = {}) => {
  log(`loading plays for ${year} week ${week}`)
  let query = get_plays_query(db)
  query = query
    .select('nfl_games.esbid', 'nfl_plays.def')
    .where('nfl_games.week', week)
    .where('nfl_games.year', year)
    .where('nfl_games.seas_type', 'REG')

  const all_plays = await query
  log(`loaded ${all_plays.length} plays`)

  const gamelogs = []

  const plays_by_esbid = groupBy(all_plays, 'esbid')
  for (const esbid in plays_by_esbid) {
    const plays = plays_by_esbid[esbid]
    log(`esbid ${esbid} has ${plays.length} plays`)
    const { players, teams } = calculateStatsFromPlays(plays)
    log(teams)

    // generate gamelogs
    // -- esbid
    // -- pid
    // -- pos
    // -- tm
    // -- opp
  }

  // generate splits
  // - all
  // - neutral
  // - leading
  // - trailing
  // - blitz
  // - zone
  // - man

  // generate team offense gamelogs
  // generate team defense gamelogs
  // generate team defense allowed over offense average gamelogs
}

const main = async () => {
  let error
  try {
    await generate_gamelogs({ week: argv.week, year: argv.year })
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

export default generate_gamelogs
