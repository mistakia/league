import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { isMain } from '#libs-server'

import generate_scoring_format_player_gamelogs from './generate-scoring-format-player-gamelogs.mjs'
import generate_scoring_format_player_seasonlogs from './generate-scoring-format-player-seasonlogs.mjs'
import generate_scoring_format_player_careerlogs from './generate-scoring-format-player-careerlogs.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('generate-scoring-format-player-logs')
debug.enable(
  'generate-scoring-format-player-logs,generate-scoring-format-player-gamelogs,generate-scoring-format-player-seasonlogs,generate-scoring-format-player-careerlogs'
)

const main = async () => {
  let error
  try {
    const scoring_format_hash = argv.scoring_format_hash

    if (!scoring_format_hash) {
      throw new Error('scoring_format_hash is required')
    }

    if (argv.all) {
      log('Generating all logs for scoring format', scoring_format_hash)
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
          `Generating all logs for scoring format ${scoring_format_hash} for year ${year}`
        )
        const weeks = await db('player_gamelogs')
          .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
          .select('nfl_games.week')
          .where('nfl_games.seas_type', 'REG')
          .where('nfl_games.year', year)
          .groupBy('nfl_games.week')
          .orderBy('nfl_games.week', 'asc')
        for (const { week } of weeks) {
          await generate_scoring_format_player_gamelogs({
            year,
            week,
            scoring_format_hash
          })
        }
        await generate_scoring_format_player_seasonlogs({
          year,
          scoring_format_hash
        })
      }

      await generate_scoring_format_player_careerlogs({ scoring_format_hash })
    } else if (argv.year) {
      log(
        `Generating all logs for scoring format ${scoring_format_hash} for year ${argv.year}`
      )
      const weeks = await db('player_gamelogs')
        .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
        .select('nfl_games.week')
        .where('nfl_games.seas_type', 'REG')
        .where('nfl_games.year', argv.year)
        .groupBy('nfl_games.week')
        .orderBy('nfl_games.week', 'asc')
      for (const { week } of weeks) {
        await generate_scoring_format_player_gamelogs({
          year: argv.year,
          week,
          scoring_format_hash
        })
      }
      await generate_scoring_format_player_seasonlogs({
        year: argv.year,
        scoring_format_hash
      })
      await generate_scoring_format_player_careerlogs({ scoring_format_hash })
    } else if (argv.week) {
      await generate_scoring_format_player_gamelogs({
        year: argv.year,
        week: argv.week,
        scoring_format_hash
      })
      await generate_scoring_format_player_seasonlogs({
        year: argv.year,
        scoring_format_hash
      })
      await generate_scoring_format_player_careerlogs({ scoring_format_hash })
    } else {
      throw new Error('Missing one of --all, --year, or --week')
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
