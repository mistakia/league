import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import {
  calculate_projection_values,
  calculate_player_period_values,
  groupBy
} from '#libs-shared'
import {
  current_season,
  default_points_added,
  external_data_sources
} from '#constants'
import first_projection_week_to_recompute from '#libs-shared/first-projection-week-to-recompute.mjs'
import { season_aggregate_key } from '#libs-shared/calculate-distributional-baselines.mjs'
import {
  is_main,
  batch_insert,
  get_league_format,
  record_league_format_projection_value_history,
  build_league_format_period_inserts
} from '#libs-server'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('process-projections-for-league-format')
enable_debug_namespaces(
  'process-projections-for-league-format,record-league-format-projection-value-history'
)

// Resolve pricing_model from the table. league_formats.pricing_model is a
// regular column (added by the format-id migration); no derived-map lookup.
const resolve_pricing_model = async (league_format_id) => {
  const row = await db('league_formats')
    .select('pricing_model')
    .where({ id: league_format_id })
    .first()
  return row?.pricing_model || 'auction'
}

const process_league_format_year = async ({
  year,
  league_format,
  player_rows,
  source_point_row_count
}) => {
  const league_format_id = league_format.league_format_id
  const pricing_model = league_format.pricing_model || 'auction'
  log(
    `processing league format ${league_format_id} for year ${year} (${pricing_model})`
  )

  // Routed through the shared helper rather than a literal 0, so the backfill
  // and the hourly cron partition by the same rule. For a past year it returns
  // 0, which is what makes the season period write unconditionally here; for the
  // current year it returns current_season.week, so an in-season invocation
  // respects the same week-1 seal the cron does.
  const first_week = first_projection_week_to_recompute({ year })
  let week = first_week

  const final_week_result = await db('nfl_games')
    .where({ season_year: year, season_type: 'REG' })
    .max('week as final_week')
    .first()

  // `?? `, not a truthiness check on the RESULT. `.max()` always returns a row,
  // so `final_week_result` is truthy even for a year with no games and the
  // fallback could never fire -- `final_week` came back null, `week <= null`
  // coerced to `0 <= 0`, and the loop ran exactly ONCE at week 0. Every year
  // without nfl_games rows therefore got a season row and no weekly board at
  // all, silently, because a season row is a plausible-looking result.
  const final_week =
    final_week_result?.final_week ?? current_season.nflFinalWeek

  // Baselines are not persisted for a league FORMAT -- only process_league
  // writes league_baselines, and it computes its own.
  for (; week <= final_week; week++) {
    calculate_projection_values({
      players: player_rows,
      league: league_format,
      week
    })
  }

  // After the weekly loop, never inside it: both period nets are sums over the
  // weekly boards above.
  calculate_player_period_values({
    players: player_rows,
    league: league_format
  })

  const {
    weekly_value_inserts,
    season_value_inserts,
    rest_of_season_value_inserts
  } = build_league_format_period_inserts({
    player_rows,
    league_format_id,
    season_year: year,
    first_week
  })

  // Output oracle, asserted BEFORE the destructive rewrite below rather than
  // after it -- the write is delete-then-reinsert by (league_format_id, year),
  // so a run that computed nothing usable must abort while the stored values
  // are still intact.
  //
  // The invariant ties the output to its own input: every pts_added falling
  // back to the sentinel is CORRECT when no scoring-format points exist for
  // the year (historical years for a format whose scoring format has no rows
  // -- the majority of fully-sentinel years in production), and is a defect
  // when they do exist, because it means the points were read but did not
  // reach get_player_week_total. That is exactly the shape of the missing
  // `projected_points_total as total` alias this guards against. Both counts
  // are logged so a zero denominator is visible rather than inferred.
  //
  // Count only the WEEKLY rows. The period aggregates are sums that SKIP the
  // sentinel rather than carrying it, so they land at 0 -- a non-sentinel
  // value -- even on a run where every real week was sentinel. Counting them
  // defeats the check exactly when it is needed: a wiped year still shows the
  // period rows per player and the oracle stays quiet. The period split makes
  // that filter structural rather than a predicate on the week key.
  const real_value_count = weekly_value_inserts.filter(
    ({ projected_points_added }) =>
      projected_points_added !== default_points_added
  ).length
  log(
    `year ${year}: ${source_point_row_count} scoring-format point rows in, ` +
      `${weekly_value_inserts.length} weekly, ${season_value_inserts.length} season, ` +
      `${rest_of_season_value_inserts.length} rest of season, ${real_value_count} non-sentinel`
  )

  if (
    source_point_row_count > 0 &&
    weekly_value_inserts.length &&
    !real_value_count
  ) {
    throw new Error(
      `refusing to write league format ${league_format_id} year ${year}: ` +
        `${source_point_row_count} scoring-format point rows were read but all ` +
        `${weekly_value_inserts.length} computed weekly values are the ${default_points_added} sentinel. ` +
        'Existing values left untouched.'
    )
  }

  // Record the dated observations BEFORE the destructive rewrites below. The
  // current-state tables are delete-then-reinsert, so history has to be captured
  // from the computed values rather than read back afterwards.
  if (weekly_value_inserts.length || rest_of_season_value_inserts.length) {
    await record_league_format_projection_value_history({
      league_format_id,
      year,
      weekly_value_rows: weekly_value_inserts,
      rest_of_season_value_rows: rest_of_season_value_inserts
    })
  }

  if (weekly_value_inserts.length) {
    await db('league_format_player_projection_values')
      .del()
      .where({ league_format_id, season_year: year })
    await batch_insert({
      items: weekly_value_inserts,
      save: (items) =>
        db('league_format_player_projection_values').insert(items),
      batch_size: 100
    })
    log(
      `processed and saved ${weekly_value_inserts.length} weekly values for year ${year}`
    )
  }

  if (season_value_inserts.length) {
    await db('league_format_player_season_projection_values')
      .del()
      .where({ league_format_id, season_year: year })
    await batch_insert({
      items: season_value_inserts,
      save: (items) =>
        db('league_format_player_season_projection_values').insert(items),
      batch_size: 100
    })
    log(
      `processed and saved ${season_value_inserts.length} season values for year ${year}`
    )
  }

  if (rest_of_season_value_inserts.length) {
    await db('league_format_player_rest_of_season_projection_values')
      .del()
      .where({ league_format_id, season_year: year })
    await batch_insert({
      items: rest_of_season_value_inserts,
      save: (items) =>
        db('league_format_player_rest_of_season_projection_values').insert(
          items
        ),
      batch_size: 100
    })
    log(
      `processed and saved ${rest_of_season_value_inserts.length} rest of season values for year ${year}`
    )
  }
}

const process_projections_for_league_format = async ({
  year,
  league_format_id,
  all = false
}) => {
  let years
  if (year) {
    years = [year]
  } else if (all) {
    const projection_years = await db('projections_index')
      .distinct('season_year')
      .orderBy('season_year', 'desc')
    years = projection_years.map((row) => row.season_year)
  }

  if (!years || !years.length) {
    throw new Error('No years to process')
  }

  const league_format = await get_league_format({ league_format_id })
  if (!league_format) {
    throw new Error(`league format ${league_format_id} not found`)
  }

  for (const process_year of years) {
    const projections = await db('projections_index').where({
      season_year: process_year,
      source_id: external_data_sources.AVERAGE,
      season_type: 'REG'
    })

    const projections_by_pid = groupBy(projections, 'pid')
    const projection_pids = Object.keys(projections_by_pid)

    const players = await db('player').whereIn('pid', projection_pids)

    // `projected_points_total as total` is load-bearing, not cosmetic:
    // get_player_week_total reads `.total` off each week's row, so an
    // unaliased select hands every player NaN -> the -999 sentinel, and the
    // writer below deletes by (league_format_id, year) before inserting.
    const scoring_format_points = await db(
      'scoring_format_player_projection_points'
    )
      .select('pid', 'week', 'projected_points_total as total')
      .where({
        season_year: process_year,
        scoring_format_id: league_format.scoring_format_id
      })
      .whereIn('pid', projection_pids)

    // The SEASON board lives in its own table since the period split, and it is
    // what the distributional model prices off. Loading only the weekly table
    // above leaves `points.season` absent, which is not an error anywhere -- the
    // model simply finds no player above replacement and writes a full board of
    // -999. Mirror get-players.mjs, which fills the same three keys from the
    // same three tables.
    const scoring_format_season_points = await db(
      'scoring_format_player_season_projection_points'
    )
      .select('pid', 'projected_points_total as total')
      .where({
        season_year: process_year,
        scoring_format_id: league_format.scoring_format_id
      })
      .whereIn('pid', projection_pids)

    const points_by_pid = groupBy(scoring_format_points, 'pid')
    const season_points_by_pid = groupBy(scoring_format_season_points, 'pid')

    const player_rows = players.map((player) => {
      const player_projections = projections_by_pid[player.pid] || []
      const projection = {}
      const points = {}

      for (const proj of player_projections) {
        const { week, ...stats } = proj
        projection[week] = stats
      }

      const player_points = points_by_pid[player.pid] || []
      for (const point of player_points) {
        points[point.week] = point
      }

      const season_point = (season_points_by_pid[player.pid] || [])[0]
      if (season_point) {
        points[season_aggregate_key] = season_point
      }

      return {
        ...player,
        projection,
        points
      }
    })

    await process_league_format_year({
      year: process_year,
      league_format,
      player_rows,
      source_point_row_count: scoring_format_points.length
    })
  }
}

export { resolve_pricing_model }

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const league_format_id = argv.league_format_id
    const year = argv.year ? Number(argv.year) : null
    const all = argv.all

    if (!league_format_id) {
      throw new Error('league_format_id is required')
    }

    if (all && !year) {
      const projection_years = await db('projections_index')
        .distinct('season_year')
        .orderBy('season_year', 'desc')
      const years = projection_years
        .map((row) => row.season_year)
        .filter((y) => y !== current_season.year)
      for (const process_year of years) {
        await process_projections_for_league_format({
          year: process_year,
          league_format_id
        })
      }
      return
    }

    await process_projections_for_league_format({
      year,
      league_format_id,
      all
    })
  } catch (err) {
    error = err
    log(error)
  }

  // Carry the outcome in the exit code. A bare process.exit() reports 0 even
  // after the catch above swallowed a throw, which would make the output
  // oracle unobservable to cron, to a wrapper, and to a backfill loop.
  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default process_projections_for_league_format
