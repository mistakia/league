import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, calculatePoints, groupBy } from '#libs-shared'
import { isMain, batch_insert } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('process-projections-for-scoring-format')
debug.enable('process-projections-for-scoring-format')

const process_scoring_format_year = async ({
  year,
  scoring_format_hash,
  player_rows
}) => {
  const league_scoring_format = await db('league_scoring_formats')
    .where({ scoring_format_hash })
    .first()

  const points_inserts = []

  for (const player_row of player_rows) {
    let week = 0
    for (; week <= constants.season.nflFinalWeek; week++) {
      const projection = player_row.projection[week]

      if (!projection) {
        continue
      }

      points_inserts.push({
        pid: player_row.pid,
        year,
        scoring_format_hash,
        week,
        ...calculatePoints({
          stats: projection,
          position: player_row.pos,
          league: league_scoring_format
        })
      })
    }

    // points_inserts.push({
    //   pid: player_row.pid,
    //   year,
    //   scoring_format_hash,
    //   week: 'ros',
    //   ...calculatePoints({
    //     stats: player_row.projection.ros,
    //     position: player_row.pos,
    //     league: league_scoring_format
    //   })
    // })
  }

  if (points_inserts.length) {
    await db('scoring_format_player_projection_points')
      .del()
      .where({ scoring_format_hash, year })
    await batch_insert({
      items: points_inserts,
      save: (items) =>
        db('scoring_format_player_projection_points').insert(items),
      batch_size: 100
    })
    log(
      `processed and saved ${points_inserts.length} player points for year ${year}`
    )
  }
}

const process_projections_for_scoring_format = async ({
  year,
  scoring_format_hash,
  all = false
}) => {
  let years
  if (year) {
    years = [year]
  } else if (all) {
    const projection_years = await db('projections_index')
      .distinct('year')
      .orderBy('year', 'desc')
    years = projection_years.map((row) => row.year)
  }

  // Remove constants.season.year from years if present
  years = years.filter((year) => year !== constants.season.year)

  if (!years.length) {
    throw new Error('No years to process')
  }

  for (const process_year of years) {
    // Get averaged projections for the given year
    const projections = await db('projections_index').where({
      year: process_year,
      sourceid: constants.sources.AVERAGE // Assuming this is 18
    })

    const projections_by_pid = groupBy(projections, 'pid')
    const projection_pids = Object.keys(projections_by_pid)

    // Get players based on the projections that exist
    const players = await db('player').whereIn('pid', projection_pids)

    // Construct player_rows
    const player_rows = players.map((player) => {
      const player_projections = projections_by_pid[player.pid] || []
      const projection = {}

      for (const proj of player_projections) {
        const { week, ...stats } = proj
        projection[week] = stats
      }

      return {
        ...player,
        projection
      }
    })

    await process_scoring_format_year({
      year: process_year,
      scoring_format_hash,
      player_rows
    })
  }
}

const main = async () => {
  let error
  try {
    const scoring_format_hash = argv.scoring_format_hash
    const year = argv.year ? Number(argv.year) : null
    const all = argv.all

    if (!scoring_format_hash) {
      throw new Error('Scoring format hash is required')
    }

    await process_projections_for_scoring_format({
      year,
      scoring_format_hash,
      all
    })
  } catch (err) {
    error = err
    log(error)
  }

  // await db('jobs').insert({
  //   type: job_types.PROCESS_PROJECTIONS_FOR_SCORING_FORMAT,
  //   succ: error ? 0 : 1,
  //   reason: error ? error.message : null,
  //   timestamp: Math.round(Date.now() / 1000)
  // })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default process_projections_for_scoring_format
