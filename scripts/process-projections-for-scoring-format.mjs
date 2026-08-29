import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { calculatePoints, groupBy } from '#libs-shared'
import { current_season, external_data_sources } from '#constants'
import { is_main, batch_insert } from '#libs-server'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('process-projections-for-scoring-format')
enable_debug_namespaces('process-projections-for-scoring-format')

// Re-derive the three scoring-format projected-points tables for one
// (scoring_format, year) slice entirely from the authoritative projections_index
// / season_projections_index / rest_of_season_projections AVERAGE rows. This is
// the SINGLE source-of-truth path shared
// by the 30-min process-projections cron and the ad-hoc / reconciliation
// backfill, so the precomputed cache can never silently drift from
// projections_index: delete each period's (format, year) slice and reinsert
// every numeric REG week, the season snapshot and the rest-of-season row, scored
// by calculatePoints (the exact arithmetic the in-query data-view scorer
// mirrors). Settled weeks are
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

  // `week >= 1` is load-bearing until Phase C deletes the week-0 rows, and it
  // stays afterwards as the statement that this read is the WEEKLY one. The
  // period split moved the season snapshot to its own table but left this read
  // unfloored, so every lingering `projections_index` week-0 row flowed into
  // weekly_points_inserts and tripped
  // `scoring_format_player_projection_points_week_is_fantasy_week` -- taking
  // out all nine scoring formats on the first run after deploy, hourly.
  const projections = await db('projections_index')
    .where({
      season_year: year,
      season_type: 'REG',
      source_id: external_data_sources.AVERAGE
    })
    .where('week', '>=', 1)
  // The season snapshot is READ, not derived from a week of the weekly set. It
  // used to come from `projections_index` week 0, which meant a period was being
  // recovered from a reserved week number; it now has its own table and its own
  // query, and no week predicate can reach it.
  const season_projections = await db('season_projections_index').where({
    season_year: year,
    source_id: external_data_sources.AVERAGE
  })
  const ros_projections = await db('rest_of_season_projections').where({
    season_year: year,
    source_id: external_data_sources.AVERAGE
  })

  const projections_by_pid = groupBy(projections, 'pid')
  const season_by_pid = groupBy(season_projections, 'pid')
  const ros_by_pid = groupBy(ros_projections, 'pid')
  const pids = Array.from(
    new Set([
      ...Object.keys(projections_by_pid),
      ...Object.keys(season_by_pid),
      ...Object.keys(ros_by_pid)
    ])
  )

  if (!pids.length) {
    return 0
  }

  const players = await db('player').whereIn('pid', pids)
  const players_by_pid = groupBy(players, 'pid')

  // One list per PERIOD. The single mixed list this replaces wrote the season
  // snapshot and the rest-of-season aggregate into the same `week` column as the
  // numeric weeks, which is the sentinel encoding the period tables remove.
  const weekly_points_inserts = []
  const season_points_inserts = []
  const rest_of_season_points_inserts = []

  const score = (stats, position) =>
    // Only the total is persisted. calculatePoints also returns a per-stat
    // breakdown of point contributions, but nothing reads it -- see
    // db/adhoc/2026-07-30-drop-dead-projection-contribution-columns.sql.
    calculatePoints({
      stats,
      position,
      league: league_scoring_format,
      use_projected_stats: true
    }).total

  for (const pid of pids) {
    const player = (players_by_pid[pid] || [])[0]
    if (!player) {
      continue
    }

    for (const proj of projections_by_pid[pid] || []) {
      const { week, ...stats } = proj
      weekly_points_inserts.push({
        pid,
        season_year: year,
        scoring_format_id,
        week,
        projected_points_total: score(stats, player.primary_position)
      })
    }

    // It seals on its own: process-projections stops recomputing the season
    // board once week 1 opens, so re-scoring it after that reproduces the same
    // frozen input.
    const season_row = (season_by_pid[pid] || [])[0]
    if (season_row) {
      season_points_inserts.push({
        pid,
        season_year: year,
        scoring_format_id,
        projected_points_total: score(season_row, player.primary_position)
      })
    }

    const rest_of_season_row = (ros_by_pid[pid] || [])[0]
    if (rest_of_season_row) {
      rest_of_season_points_inserts.push({
        pid,
        season_year: year,
        scoring_format_id,
        projected_points_total: score(
          rest_of_season_row,
          player.primary_position
        )
      })
    }
  }

  // Each period table is refreshed with the same delete-then-reinsert shape the
  // single table used, scoped to its own (format, year) slice, so a player
  // dropping out of the projection set leaves no stale row behind.
  //
  // ONE TRANSACTION per slice, because the unguarded form loses data rather
  // than failing. The delete committed on its own, so when the insert hit a
  // CHECK violation on 2026-08-29 the slice was left EMPTY -- seven of ten
  // active formats lost their whole 2026 weekly set, and the hourly cron
  // re-emptied it every run. A refresh that cannot complete must leave the
  // previous contents alone.
  const refresh = async ({ table, items, label }) => {
    if (!items.length) return
    await db.transaction(async (trx) => {
      await trx(table).del().where({ scoring_format_id, season_year: year })
      await batch_insert({
        items,
        save: (rows) => trx(table).insert(rows),
        batch_size: 100
      })
    })
    log(
      `re-derived ${items.length} ${scoring_format_id} ${label} points for year ${year}`
    )
  }

  await refresh({
    table: 'scoring_format_player_projection_points',
    items: weekly_points_inserts,
    label: 'weekly'
  })
  await refresh({
    table: 'scoring_format_player_season_projection_points',
    items: season_points_inserts,
    label: 'season'
  })
  await refresh({
    table: 'scoring_format_player_rest_of_season_projection_points',
    items: rest_of_season_points_inserts,
    label: 'rest of season'
  })

  return (
    weekly_points_inserts.length +
    season_points_inserts.length +
    rest_of_season_points_inserts.length
  )
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
