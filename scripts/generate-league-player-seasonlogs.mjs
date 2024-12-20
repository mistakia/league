import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#libs-shared'
import { is_main, getAcquisitionTransaction, getLeague } from '#libs-server'
import generateSeasonDates from './generate-season-dates.mjs'
import handle_season_args_for_script from '#libs-server/handle-season-args-for-script.mjs'
// import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('generate-league-player-seasonlogs')
debug.enable('generate-league-player-seasonlogs')

const generate_league_player_seasonlogs = async ({
  year = constants.season.year,
  lid,
  league_format_hash
}) => {
  if (!lid) {
    throw new Error('lid required')
  }

  if (!league_format_hash) {
    throw new Error('league_format_hash required')
  }

  log(`generating player seasonlogs for leagueId ${lid} in ${year}`)

  const season_dates = await generateSeasonDates({ year })

  // get league player gamelogs for season
  const gamelogs = await db('league_format_player_gamelogs')
    .select('league_format_player_gamelogs.*', 'player.pos')
    .join('player', 'player.pid', 'league_format_player_gamelogs.pid')
    .join('nfl_games', 'league_format_player_gamelogs.esbid', 'nfl_games.esbid')
    .where({ year, seas_type: 'REG', league_format_hash })

  log(`loaded ${gamelogs.length} gamelogs`)

  const inserts = []

  const pids = [...new Set(gamelogs.map((g) => g.pid))]
  for (const pid of pids) {
    // get start team
    const rosters_start = await db('rosters_players')
      .where('lid', lid)
      .where('pid', pid)
      .where('year', year)
      .where('week', 0)
    const start_tid = rosters_start.length ? rosters_start[0].tid : null

    let salary = null
    if (start_tid) {
      const salary_query = await db('transactions')
        .where({ lid, pid, year, week: 0, tid: start_tid })
        .orderBy('timestamp', 'desc')
        .limit(1)

      salary = salary_query.length ? salary_query[0].value : 0
    }

    // get end team
    const rosters_end = await db('rosters_players')
      .where('lid', lid)
      .where('pid', pid)
      .where('year', year)
      .where('week', season_dates.finalWeek)
    const end_tid = rosters_end.length ? rosters_end[0].tid : null

    // get start team acquisition type
    let start_acquisition_type = null
    if (start_tid) {
      const acquisition_transaction = await getAcquisitionTransaction({
        lid,
        pid,
        tid: start_tid,
        year
      })

      if (acquisition_transaction) {
        start_acquisition_type = acquisition_transaction.type
      }
    }

    // get end team acquisition type
    let end_acquisition_type = null
    if (end_tid) {
      const acquisition_transaction = await getAcquisitionTransaction({
        lid,
        pid,
        tid: end_tid,
        year,
        week: season_dates.finalWeek
      })

      if (acquisition_transaction) {
        end_acquisition_type = acquisition_transaction.type
      }
    }

    // process / create inserts
    inserts.push({
      pid,
      year,
      lid,
      salary,
      start_tid,
      start_acquisition_type,
      end_tid,
      end_acquisition_type
    })
  }

  // save inserts
  if (inserts.length) {
    const pids = inserts.map((p) => p.pid)
    const deleted_count = await db('league_player_seasonlogs')
      .where({ lid, year })
      .whereNotIn('pid', pids)
      .del()
    log(`Deleted ${deleted_count} excess player seasonlogs`)

    log(`updated ${inserts.length} player regular seasons`)
    await db('league_player_seasonlogs')
      .insert(inserts)
      .onConflict(['pid', 'year', 'lid'])
      .merge()
  }
}

const main = async () => {
  let error
  try {
    const lid = argv.lid || 1
    const league = await getLeague({ lid })
    const { league_format_hash } = league

    await handle_season_args_for_script({
      argv,
      script_name: 'generate-league-player-seasonlogs',
      script_function: generate_league_player_seasonlogs,
      year_query: ({ seas_type = 'REG' }) =>
        db('league_format_player_gamelogs')
          .join(
            'nfl_games',
            'nfl_games.esbid',
            'league_format_player_gamelogs.esbid'
          )
          .select('nfl_games.year')
          .where('nfl_games.seas_type', seas_type)
          .where(
            'league_format_player_gamelogs.league_format_hash',
            league_format_hash
          )
          .groupBy('nfl_games.year')
          .orderBy('nfl_games.year', 'asc'),
      script_args: { lid, league_format_hash }
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

export default generate_league_player_seasonlogs
