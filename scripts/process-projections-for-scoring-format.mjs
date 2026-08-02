import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { calculatePoints, groupBy } from '#libs-shared'
import calculate_projection_dispersion from '#libs-shared/calculate-projection-dispersion.mjs'
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

  // Every source, not just the AVERAGE consensus. The consensus supplies
  // `total`; the individual sources supply the DISAGREEMENT between them, which
  // is the only forward-looking uncertainty estimate available at projection
  // time and which weightProjections discards when it averages. The valuation
  // needs both -- see the header of
  // libs-shared/calculate-projection-dispersion.mjs.
  const all_projections = await db('projections_index').where({
    season_year: year,
    season_type: 'REG'
  })
  const projections = all_projections.filter(
    (row) => row.sourceid === external_data_sources.AVERAGE
  )
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
  const position_by_pid = {}
  for (const player of players) {
    position_by_pid[player.pid] = player.primary_position
  }

  // Dispersion is measured per WEEK, because the sources disagree by different
  // amounts about a season than about a Sunday, and the source panel itself
  // differs by week -- 2025 carried 11 sources in-season and 8 at week 0, while
  // 2026 has 8 at week 0 and 3-4 for weeks 1+. Each week therefore gets its own
  // pass, and the module's position-median fallback covers the players a thin
  // week leaves under-covered.
  const source_totals_by_week = {}
  for (const row of all_projections) {
    if (row.sourceid === external_data_sources.AVERAGE) continue
    const position = position_by_pid[row.pid]
    if (!position) continue
    const { week, ...stats } = row
    const { total } = calculatePoints({
      stats,
      position,
      league: league_scoring_format,
      use_projected_stats: true
    })
    if (!(total > 0)) continue
    if (!source_totals_by_week[week]) source_totals_by_week[week] = {}
    if (!source_totals_by_week[week][row.pid])
      source_totals_by_week[week][row.pid] = []
    source_totals_by_week[week][row.pid].push(total)
  }

  const dispersion_by_week = {}
  for (const [week, source_totals_by_pid] of Object.entries(
    source_totals_by_week
  )) {
    // Seed every consensus player for the week, including those no individual
    // source covers at all -- without an entry the module cannot hand them the
    // position median and they would silently draw as certainties.
    for (const pid of pids) {
      if (!source_totals_by_pid[pid]) source_totals_by_pid[pid] = []
    }
    dispersion_by_week[week] = calculate_projection_dispersion({
      source_totals_by_pid,
      position_by_pid
    }).dispersion_by_pid
  }

  const points_inserts = []
  for (const pid of pids) {
    const player = (players_by_pid[pid] || [])[0]
    if (!player) {
      continue
    }

    for (const proj of projections_by_pid[pid] || []) {
      const { week, ...stats } = proj
      // Only `total` and `points_sd` are persisted. calculatePoints also returns
      // a per-stat breakdown of point contributions, but nothing reads it -- see
      // db/adhoc/2026-07-30-drop-dead-projection-contribution-columns.sql.
      const { total } = calculatePoints({
        stats,
        position: player.primary_position,
        league: league_scoring_format,
        use_projected_stats: true
      })
      const points_sd = (dispersion_by_week[week] || {})[pid]
      points_inserts.push({
        pid,
        year,
        scoring_format_id,
        week,
        total,
        // Null rather than 0 when the week has no dispersion for the player at
        // all. Zero would assert certainty, which is the one reading the data
        // does not support.
        points_sd: points_sd > 0 ? points_sd : null
      })
    }

    const ros_row = (ros_by_pid[pid] || [])[0]
    if (ros_row) {
      const { total } = calculatePoints({
        stats: ros_row,
        position: player.primary_position,
        league: league_scoring_format,
        use_projected_stats: true
      })
      points_inserts.push({
        pid,
        year,
        scoring_format_id,
        week: 'ros',
        total,
        // ros_projections carries only the AVERAGE consensus -- no individual
        // source publishes a rest-of-season line -- so there is no disagreement
        // to measure. Explicit rather than omitted, so every row in the batch
        // declares the same columns.
        points_sd: null
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
