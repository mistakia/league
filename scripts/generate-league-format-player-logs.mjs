import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { isMain } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

import generate_league_format_player_gamelogs from './generate-league-format-player-gamelogs.mjs'
import generate_league_format_player_seasonlogs from './generate-league-format-player-seasonlogs.mjs'
import generate_league_format_player_careerlogs from './generate-league-format-player-careerlogs.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('generate-league-format-player-logs')
debug.enable(
  'generate-league-format-player-logs,generate-league-format-player-gamelogs,generate-league-format-player-seasonlogs,generate-league-format-player-careerlogs'
)

const main = async () => {
  let error
  try {
    const league_format_hash = argv.league_format_hash

    if (!league_format_hash) {
      throw new Error('league_format_hash is required')
    }

    if (argv.all) {
      log('Generating all logs for league format', league_format_hash)
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
        log(
          `Generating all logs for league format ${league_format_hash} for year ${year}`
        )
        const weeks = await db('player_gamelogs')
          .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
          .select('nfl_games.week')
          .where('nfl_games.seas_type', 'REG')
          .where('nfl_games.year', year)
          .groupBy('nfl_games.week')
          .orderBy('nfl_games.week', 'asc')
        for (const { week } of weeks) {
          await generate_league_format_player_gamelogs({
            year,
            week,
            league_format_hash
          })
        }
        await generate_league_format_player_seasonlogs({
          year,
          league_format_hash
        })
      }

      await generate_league_format_player_careerlogs({ league_format_hash })
    } else if (argv.year) {
      log(
        `Generating all logs for league format ${league_format_hash} for year ${argv.year}`
      )
      const weeks = await db('player_gamelogs')
        .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
        .select('nfl_games.week')
        .where('nfl_games.seas_type', 'REG')
        .where('nfl_games.year', argv.year)
        .groupBy('nfl_games.week')
        .orderBy('nfl_games.week', 'asc')
      for (const { week } of weeks) {
        await generate_league_format_player_gamelogs({
          year: argv.year,
          week,
          league_format_hash
        })
      }
      await generate_league_format_player_seasonlogs({
        year: argv.year,
        league_format_hash
      })
      await generate_league_format_player_careerlogs({ league_format_hash })
    } else if (argv.week) {
      await generate_league_format_player_gamelogs({
        year: argv.year,
        week: argv.week,
        league_format_hash
      })
      await generate_league_format_player_seasonlogs({
        year: argv.year,
        league_format_hash
      })
      await generate_league_format_player_careerlogs({ league_format_hash })
    } else {
      throw new Error('Missing one of --all, --year, or --week')
    }
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
