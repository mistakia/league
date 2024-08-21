import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, sum, groupBy } from '#libs-shared'
import { isMain, getLeague } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('generate-scoring-format-player-seasonlogs')
debug.enable('generate-scoring-format-player-seasonlogs')

const generate_scoring_format_player_seasonlogs = async ({
  year = constants.season.year,
  scoring_format_hash,
  dry = false
}) => {
  if (!scoring_format_hash) {
    throw new Error('scoring_format_hash required')
  }
  log(
    `generating player seasonlogs for scoring_format ${scoring_format_hash} in ${year}`
  )

  // get scoring format player gamelogs for season
  const gamelogs = await db('scoring_format_player_gamelogs')
    .select('scoring_format_player_gamelogs.*', 'player.pos')
    .join('player', 'player.pid', 'scoring_format_player_gamelogs.pid')
    .join(
      'nfl_games',
      'scoring_format_player_gamelogs.esbid',
      'nfl_games.esbid'
    )
    .where({ year, seas_type: 'REG', scoring_format_hash })

  log(`loaded ${gamelogs.length} gamelogs`)

  const inserts = []

  const pids = [...new Set(gamelogs.map((g) => g.pid))]
  for (const pid of pids) {
    // get gamelogs for pid
    const player_gamelogs = gamelogs.filter((g) => g.pid === pid)
    const pos = player_gamelogs[0].pos

    const games = player_gamelogs.length
    const points = sum(player_gamelogs.map((g) => g.points))

    // process / create inserts
    inserts.push({
      pid,
      year,
      scoring_format_hash,
      pos,
      points,
      points_per_game: points / games,
      games
    })
  }

  const seasons_by_pos = groupBy(inserts, 'pos')
  const sorted_by_points_by_pos = {}
  for (const pos in seasons_by_pos) {
    sorted_by_points_by_pos[pos] = seasons_by_pos[pos]
      .map((i) => i.points)
      .sort((a, b) => b - a)
  }

  const sorted_by_points = inserts.map((i) => i.points).sort((a, b) => b - a)

  for (const insert of inserts) {
    insert.points_rnk = sorted_by_points.indexOf(insert.points) + 1
    insert.points_pos_rnk =
      sorted_by_points_by_pos[insert.pos].indexOf(insert.points) + 1

    delete insert.pos
  }

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

  // save inserts
  if (inserts.length) {
    const pids = inserts.map((p) => p.pid)
    const deleted_count = await db('scoring_format_player_seasonlogs')
      .where({ scoring_format_hash, year })
      .whereNotIn('pid', pids)
      .del()
    log(`Deleted ${deleted_count} excess player seasonlogs`)

    log(`updated ${inserts.length} player regular seasons`)
    await db('scoring_format_player_seasonlogs')
      .insert(inserts)
      .onConflict(['pid', 'year', 'scoring_format_hash'])
      .merge()
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
      const results = await db('scoring_format_player_gamelogs')
        .join(
          'nfl_games',
          'nfl_games.esbid',
          'scoring_format_player_gamelogs.esbid'
        )
        .select('nfl_games.year')
        .where('nfl_games.seas_type', 'REG')
        .where(
          'scoring_format_player_gamelogs.scoring_format_hash',
          scoring_format_hash
        )
        .groupBy('nfl_games.year')
        .orderBy('nfl_games.year', 'asc')

      let years = results.map((r) => r.year)
      if (argv.start) {
        years = years.filter((year) => year >= argv.start)
      }

      log(`generating player seasonlogs for ${years.length} years`)

      for (const year of years) {
        await generate_scoring_format_player_seasonlogs({
          year,
          scoring_format_hash
        })
      }
    } else {
      await generate_scoring_format_player_seasonlogs({
        year: argv.year,
        scoring_format_hash,
        dry: argv.dry
      })
    }
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default generate_scoring_format_player_seasonlogs
