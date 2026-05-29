import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { calculatePoints, groupBy } from '#libs-shared'
import { current_season, external_data_sources } from '#constants'
import { is_main, batch_insert } from '#libs-server'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('process-projections-for-scoring-format')
debug.enable('process-projections-for-scoring-format')

const process_scoring_format_year = async ({
  year,
  scoring_format_id,
  player_rows
}) => {
  const league_scoring_format = await db('league_scoring_formats')
    .where({ id: scoring_format_id })
    .first()

  const points_inserts = []

  for (const player_row of player_rows) {
    let week = 0
    for (; week <= current_season.nflFinalWeek; week++) {
      const projection = player_row.projection[week]

      if (!projection) {
        continue
      }

      points_inserts.push({
        pid: player_row.pid,
        year,
        scoring_format_id,
        week,
        ...calculatePoints({
          stats: projection,
          position: player_row.pos,
          league: league_scoring_format,
          use_projected_stats: true
        })
      })
    }
  }

  if (points_inserts.length) {
    await db('scoring_format_player_projection_points')
      .del()
      .where({ scoring_format_id, year })
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
  scoring_format_id,
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

  if (!years.length) {
    throw new Error('No years to process')
  }

  for (const process_year of years) {
    const projections = await db('projections_index').where({
      year: process_year,
      sourceid: external_data_sources.AVERAGE,
      seas_type: 'REG'
    })

    const projections_by_pid = groupBy(projections, 'pid')
    const projection_pids = Object.keys(projections_by_pid)

    const players = await db('player').whereIn('pid', projection_pids)

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
      scoring_format_id,
      player_rows
    })
  }
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const scoring_format_id = argv.scoring_format_id
    const year = argv.year ? Number(argv.year) : null
    const all = argv.all

    if (!scoring_format_id) {
      throw new Error('scoring_format_id is required')
    }

    await process_projections_for_scoring_format({
      year,
      scoring_format_id,
      all
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

export default process_projections_for_scoring_format
