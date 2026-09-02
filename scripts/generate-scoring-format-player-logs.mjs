import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

import generate_scoring_format_player_gamelogs from './generate-scoring-format-player-gamelogs.mjs'
import generate_scoring_format_player_seasonlogs from './generate-scoring-format-player-seasonlogs.mjs'
import generate_scoring_format_player_careerlogs from './generate-scoring-format-player-careerlogs.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('generate-scoring-format-player-logs')
enable_debug_namespaces(
  'generate-scoring-format-player-logs,generate-scoring-format-player-gamelogs,generate-scoring-format-player-seasonlogs,generate-scoring-format-player-careerlogs'
)

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const scoring_format_id = argv.scoring_format_id

    if (!scoring_format_id) {
      throw new Error('scoring_format_id is required')
    }

    if (argv.all) {
      log('Generating all logs for scoring format', scoring_format_id)
      const results = await db('player_gamelogs')
        .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
        .select('nfl_games.season_year')
        .where('nfl_games.season_type', 'REG')
        .groupBy('nfl_games.season_year')
        .orderBy('nfl_games.season_year', 'asc')

      let years = results.map((r) => r.season_year)
      if (argv.start) {
        years = years.filter((season_year) => season_year >= argv.start)
      }

      for (const season_year of years) {
        log(
          `Generating all logs for scoring format ${scoring_format_id} for year ${season_year}`
        )
        const weeks = await db('player_gamelogs')
          .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
          .select('nfl_games.week')
          .where('nfl_games.season_type', 'REG')
          .where('nfl_games.season_year', season_year)
          .groupBy('nfl_games.week')
          .orderBy('nfl_games.week', 'asc')
        for (const { week } of weeks) {
          await generate_scoring_format_player_gamelogs({
            season_year,
            week,
            scoring_format_id
          })
        }
        await generate_scoring_format_player_seasonlogs({
          season_year,
          scoring_format_id
        })
      }

      await generate_scoring_format_player_careerlogs({ scoring_format_id })
    } else if (argv.year) {
      log(
        `Generating all logs for scoring format ${scoring_format_id} for year ${argv.year}`
      )
      const weeks = await db('player_gamelogs')
        .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
        .select('nfl_games.week')
        .where('nfl_games.season_type', 'REG')
        .where('nfl_games.season_year', argv.year)
        .groupBy('nfl_games.week')
        .orderBy('nfl_games.week', 'asc')
      for (const { week } of weeks) {
        await generate_scoring_format_player_gamelogs({
          season_year: argv.year,
          week,
          scoring_format_id
        })
      }
      await generate_scoring_format_player_seasonlogs({
        season_year: argv.year,
        scoring_format_id
      })
      await generate_scoring_format_player_careerlogs({ scoring_format_id })
    } else if (argv.week) {
      await generate_scoring_format_player_gamelogs({
        season_year: argv.year,
        week: argv.week,
        scoring_format_id
      })
      await generate_scoring_format_player_seasonlogs({
        season_year: argv.year,
        scoring_format_id
      })
      await generate_scoring_format_player_careerlogs({ scoring_format_id })
    } else {
      throw new Error('Missing one of --all, --year, or --week')
    }
  } catch (err) {
    error = err
    log(error)
  }

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}
