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

// Re-derive scoring_format_player_projection_points for one (scoring_format,
// year) slice entirely from the authoritative projections_index /
// ros_projections AVERAGE rows. This is the SINGLE source-of-truth path shared
// by the 30-min process-projections cron and the ad-hoc / reconciliation
// backfill, so the precomputed cache can never silently drift from
// projections_index: delete the whole (format, year) slice and reinsert every
// numeric REG week plus the rest-of-season row, scored by calculatePoints (the
// exact arithmetic the in-query data-view scorer mirrors). Settled weeks are
// re-read from projections_index each run, so the cache tracks the frozen
// as-of-gametime projection instead of freezing at whenever-it-was-last-current.
// See task projected-points-in-query-scoring-source-selection.
export const process_scoring_format_year = async ({
  year,
  scoring_format_id
}) => {
  const league_scoring_format = await db('league_scoring_formats')
    .where({ id: scoring_format_id })
    .first()

  const projections = await db('projections_index').where({
    season_year: year,
    sourceid: external_data_sources.AVERAGE,
    season_type: 'REG'
  })
  const ros_projections = await db('ros_projections').where({
    season_year: year,
    sourceid: external_data_sources.AVERAGE
  })

  const projections_by_pid = groupBy(projections, 'pid')
  const ros_by_pid = groupBy(ros_projections, 'pid')
  const pids = Array.from(
    new Set([...Object.keys(projections_by_pid), ...Object.keys(ros_by_pid)])
  )

  if (!pids.length) {
    return 0
  }

  const players = await db('player').whereIn('pid', pids)
  const players_by_pid = groupBy(players, 'pid')

  const points_inserts = []
  for (const pid of pids) {
    const player = (players_by_pid[pid] || [])[0]
    if (!player) {
      continue
    }

    for (const proj of projections_by_pid[pid] || []) {
      const { week, ...stats } = proj
      points_inserts.push({
        pid,
        year,
        scoring_format_id,
        week,
        ...calculatePoints({
          stats,
          position: player.primary_position,
          league: league_scoring_format,
          use_projected_stats: true
        })
      })
    }

    const ros_row = (ros_by_pid[pid] || [])[0]
    if (ros_row) {
      points_inserts.push({
        pid,
        year,
        scoring_format_id,
        week: 'ros',
        ...calculatePoints({
          stats: ros_row,
          position: player.primary_position,
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
      `re-derived ${points_inserts.length} ${scoring_format_id} points for year ${year}`
    )
  }

  return points_inserts.length
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
    // --all reconciles PAST years only. The current year is owned by the 30-min
    // process-projections cron (which re-derives it in full every run via the
    // shared process_scoring_format_year), so excluding it here avoids a
    // concurrent del+reinsert race on the same (format, year) slice. Pass an
    // explicit --year to force a single year.
    const projection_years = await db('projections_index')
      .distinct('season_year')
      .orderBy('season_year', 'desc')
    years = projection_years
      .map((row) => row.season_year)
      .filter((y) => y !== current_season.year)
  }

  if (!years || !years.length) {
    throw new Error('No years to process')
  }

  for (const process_year of years) {
    await process_scoring_format_year({
      year: process_year,
      scoring_format_id
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
