import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#libs-shared'
import { isMain, getLeague } from '#libs-server'
import calculate_points from './calculate-points.mjs'
// import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('generate-scoring-format-player-gamelogs')
debug.enable('generate-scoring-format-player-gamelogs')

const generate_scoring_format_player_gamelogs = async ({
  scoring_format_hash,
  year = constants.season.year,
  week = constants.season.week,
  dry = false
} = {}) => {
  if (!scoring_format_hash) {
    throw new Error('scoring_format_hash is required')
  }

  const result = await calculate_points({
    year,
    week,
    scoring_format_hash
  })

  const inserts = []
  for (const pid in result.players) {
    const player = result.players[pid]
    for (const game of player.games) {
      inserts.push({
        pid,
        esbid: game.esbid,
        scoring_format_hash,
        points: player.points,
        pos_rnk: player.pos_rnk
      })
    }
  }

  // Select 10 random inserts to display
  if (dry) {
    // Shuffle the inserts array to get random elements
    const shuffled_inserts = inserts.sort(() => 0.5 - Math.random())

    // Select 10 random inserts or all if less than 10
    const random_inserts = shuffled_inserts.slice(0, 10)

    log('10 Random Inserts:')
    for (const insert of random_inserts) {
      log(insert)
    }
    return
  }

  if (inserts.length) {
    const pids = [...new Set(inserts.map((p) => p.pid))]
    const deleted_count = await db('scoring_format_player_gamelogs')
      .leftJoin(
        'nfl_games',
        'scoring_format_player_gamelogs.esbid',
        'nfl_games.esbid'
      )
      .where('nfl_games.week', week)
      .where('nfl_games.year', year)
      .where('nfl_games.seas_type', 'REG')
      .where(
        'scoring_format_player_gamelogs.scoring_format_hash',
        scoring_format_hash
      )
      .whereNotIn('scoring_format_player_gamelogs.pid', pids)
      .del()
    log(
      `Deleted ${deleted_count} excess player gamelogs for scoring_format ${scoring_format_hash} in week ${week} ${year}`
    )
    await db('scoring_format_player_gamelogs')
      .insert(inserts)
      .onConflict(['pid', 'esbid', 'scoring_format_hash'])
      .merge()
    log(
      `Updated ${inserts.length} player gamelogs for scoring_format ${scoring_format_hash} in week ${week} ${year}`
    )
  }
}

const main = async () => {
  let error
  try {
    let scoring_format_hash = argv.scoring_format_hash

    if (!scoring_format_hash) {
      const lid = 1
      const league = await getLeague({ lid })
      scoring_format_hash = league.scoring_format_hash
    }

    if (!scoring_format_hash) {
      throw new Error('scoring_format_hash is required')
    }

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
        const weeks = await db('player_gamelogs')
          .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
          .select('nfl_games.week')
          .where('nfl_games.seas_type', 'REG')
          .where('nfl_games.year', year)
          .groupBy('nfl_games.week')
          .orderBy('nfl_games.week', 'asc')
        for (const { week } of weeks) {
          await generate_scoring_format_player_gamelogs({
            scoring_format_hash,
            year,
            week
          })
        }
      }
    } else {
      await generate_scoring_format_player_gamelogs({
        scoring_format_hash,
        year: argv.year,
        week: argv.week,
        dry: argv.dry
      })
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

export default generate_scoring_format_player_gamelogs
