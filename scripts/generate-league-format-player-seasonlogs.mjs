import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { sum, groupBy, constants } from '#common'
import { isMain, getLeague } from '#utils'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('generate-league-format-player-seasonslogs')
debug.enable('generate-league-format-player-seasonslogs')

const generate_league_format_player_seasonlogs = async ({
  year = constants.season.year,
  league_format_hash
}) => {
  if (!league_format_hash) {
    throw new Error('league_format_hash required')
  }

  log(
    `generating player seasonlogs for league_format ${league_format_hash} in ${year}`
  )

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
    // get gamelogs for pid
    const player_gamelogs = gamelogs.filter((g) => g.pid === pid)
    const pos = player_gamelogs[0].pos

    const games = player_gamelogs.length
    const points = sum(player_gamelogs.map((g) => g.points))
    const points_added = sum(player_gamelogs.map((g) => g.points_added))

    // process / create inserts
    inserts.push({
      pid,
      year,
      league_format_hash,
      pos,
      games,
      points,
      points_per_game: points / games,
      points_added,
      points_added_per_game: points_added / games,
      startable_games: player_gamelogs.filter((p) => p.points_added > 0).length
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
    .map((i) => i.points_added)
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
    const pids = inserts.map((p) => p.pid)
    const deleted_count = await db('league_format_player_seasonlogs')
      .where({ league_format_hash, year })
      .whereNotIn('pid', pids)
      .del()
    log(`Deleted ${deleted_count} excess player seasonlogs`)

    log(`updated ${inserts.length} player regular seasons`)
    await db('league_format_player_seasonlogs')
      .insert(inserts)
      .onConflict()
      .merge()
  }
}

const main = async () => {
  let error
  try {
    const lid = argv.lid || 1
    const league = await getLeague({ lid })
    const { league_format_hash } = league

    if (argv.all) {
      const results = await db('league_format_player_gamelogs')
        .join(
          'nfl_games',
          'nfl_games.esbid',
          'league_format_player_gamelogs.esbid'
        )
        .select('nfl_games.year')
        .where('nfl_games.seas_type', 'REG')
        .where(
          'league_format_player_gamelogs.league_format_hash',
          league_format_hash
        )
        .groupBy('nfl_games.year')
        .orderBy('nfl_games.year', 'asc')

      let years = results.map((r) => r.year)
      if (argv.start) {
        years = years.filter((year) => year >= argv.start)
      }

      log(`generating player seasonlogs for ${years.length} years`)

      for (const year of years) {
        await generate_league_format_player_seasonlogs({
          year,
          league_format_hash
        })
      }
    } else {
      await generate_league_format_player_seasonlogs({
        year: argv.year,
        league_format_hash
      })
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

export default generate_league_format_player_seasonlogs
