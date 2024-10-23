import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main, getLeague } from '#libs-server'
import handle_season_args_for_script from '#libs-server/handle-season-args-for-script.mjs'
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
    let league_format_hash = argv.league_format_hash

    if (!league_format_hash) {
      const lid = argv.lid || 1
      const league = await getLeague({ lid })
      league_format_hash = league.league_format_hash
    }

    if (!league_format_hash) {
      throw new Error('league_format_hash is required')
    }

    await handle_season_args_for_script({
      argv,
      script_name: 'generate-league-format-player-logs',
      script_function: generate_league_format_player_gamelogs,
      year_query: ({ seas_type = 'REG' }) =>
        db('player_gamelogs')
          .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
          .select('nfl_games.year')
          .where('nfl_games.seas_type', seas_type)
          .groupBy('nfl_games.year')
          .orderBy('nfl_games.year', 'asc'),
      week_query: ({ year, seas_type = 'REG' }) =>
        db('player_gamelogs')
          .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
          .select('nfl_games.week')
          .where('nfl_games.seas_type', seas_type)
          .where('nfl_games.year', year)
          .groupBy('nfl_games.week')
          .orderBy('nfl_games.week', 'asc'),
      script_args: { league_format_hash },
      post_year_function: async ({ year, league_format_hash }) => {
        await generate_league_format_player_seasonlogs({
          year,
          league_format_hash
        })
      },
      post_all_function: async ({ league_format_hash }) => {
        await generate_league_format_player_careerlogs({ league_format_hash })
      }
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
