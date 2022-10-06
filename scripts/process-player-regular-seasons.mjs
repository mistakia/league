import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { sum, groupBy, constants } from '#common'
import { isMain, getAcquisitionTransaction } from '#utils'
import generateSeasonDates from './generate-season-dates.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('process-player-regular-seasons')
debug.enable('process-player-regular-seasons')

const processSeasons = async ({ year = constants.season.year, lid = 1 }) => {
  log(`generating player seasonlogs for leagueId ${lid} in ${year}`)

  const season_dates = await generateSeasonDates({ year })

  // get league player gamelogs for season
  const gamelogs = await db('league_player_gamelogs')
    .select('league_player_gamelogs.*', 'player.pos')
    .join('player', 'player.pid', 'league_player_gamelogs.pid')
    .join('nfl_games', 'league_player_gamelogs.esbid', 'nfl_games.esbid')
    .where({ seas: year, seas_type: 'REG', lid })

  log(`loaded ${gamelogs.length} gamelogs`)

  const inserts = []

  const pids = [...new Set(gamelogs.map((g) => g.pid))]
  for (const pid of pids) {
    // get gamelogs for pid
    const player_gamelogs = gamelogs.filter((g) => g.pid === pid)
    const pos = player_gamelogs[0].pos

    // get start team
    const rosters_start = await db('rosters_players')
      .join('rosters', 'rosters.uid', 'rosters_players.rid')
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
      .join('rosters', 'rosters.uid', 'rosters_players.rid')
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

    const games = player_gamelogs.length
    const points = sum(player_gamelogs.map((g) => g.points))
    const points_added = sum(player_gamelogs.map((g) => g.points_added))

    // process / create inserts
    inserts.push({
      pid,
      year,
      lid,
      pos,
      games,
      points,
      points_per_game: points / games,
      points_added,
      points_added_per_game: points_added / games,
      startable_games: player_gamelogs.filter((p) => p.points_added > 0).length,
      salary,
      start_tid,
      start_acquisition_type,
      end_tid,
      end_acquisition_type
    })
  }

  const seasons_by_pos = groupBy(inserts, 'pos')
  const sorted_by_points_by_pos = {}
  const sorted_by_points_added_by_pos = {}
  for (const pos in seasons_by_pos) {
    sorted_by_points_added_by_pos[pos] = seasons_by_pos[pos]
      .map((i) => i.points_added)
      .sort((a, b) => b - a)
    sorted_by_points_by_pos[pos] = seasons_by_pos[pos]
      .map((i) => i.points)
      .sort((a, b) => b - a)
  }

  const sorted_by_points = inserts.map((i) => i.points).sort((a, b) => b - a)
  const sorted_by_points_added = inserts
    .map((i) => i.points)
    .sort((a, b) => b - a)

  for (const insert of inserts) {
    insert.points_rnk = sorted_by_points.indexOf(insert.points) + 1
    insert.points_pos_rnk =
      sorted_by_points_by_pos[insert.pos].indexOf(insert.points) + 1

    insert.points_added_rnk =
      sorted_by_points_added.indexOf(insert.points_added) + 1
    insert.points_added_pos_rnk =
      sorted_by_points_added_by_pos[insert.pos].indexOf(insert.points_added) + 1

    delete insert.pos
  }

  // save inserts
  if (inserts.length) {
    // TODO - delete excess league player seasonlogs

    log(`updated ${inserts.length} player regular seasons`)
    await db('league_player_regular_seasonlogs')
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

      log(`generating player seasonlogs for ${years.length} years`)

      for (const year of years) {
        await processSeasons({ year, lid })
      }
    } else {
      await processSeasons({ year: argv.year, lid })
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
