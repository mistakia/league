import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { calculatePoints, fit_linear_regression } from '#libs-shared'
import {
  current_season,
  external_data_sources,
  fantasy_positions
} from '#constants'
import { is_main } from '#libs-server'

const log = debug('fit-projection-calibration')
debug.enable('fit-projection-calibration')

const initialize_cli = () => yargs(hideBin(process.argv)).argv

// Fit `realized ~ intercept + slope x projected` per position, so the value
// pipeline can put a regressed-to-the-mean forecast back on the realized scale
// before deriving baselines and prices from it.
//
// Diagnose projection quality BY REGRESSION, never by comparing the projected
// curve against the realized curve at the same rank: realized order statistics
// are inflated at the top and deflated in the middle by luck, so that
// comparison makes every position look under-spread and it inverts the reading
// at QB.
//
// Projections are re-scored here with calculatePoints rather than read out of
// scoring_format_player_projection_points, because that cache only covers the
// last two seasons while projections_index reaches back to 2020 -- and because
// scoring the raw stats with the same function the pipeline uses is what makes
// the fitted coefficients apply to the numbers the pipeline actually sees.

// Roughly how deep into each position a 10-to-12 team league rosters. Fitting
// past this depth would fit mostly on players no one drafts, whose projections
// cluster near zero and whose realized outcomes are almost all zero -- that
// pins the line through the origin and reports a flattering r that says nothing
// about the ordering the board is used for.
const FIT_DEPTH_BY_POSITION = {
  QB: 32,
  RB: 60,
  WR: 72,
  TE: 24,
  DST: 32,
  K: 32
}

const DEFAULT_FIT_YEARS = 6

const fit_season_period = async ({ scoring_format, years }) => {
  const pairs_by_position = {}
  for (const position of fantasy_positions) pairs_by_position[position] = []

  for (const year of years) {
    const projections = await db('projections_index').where({
      sourceid: external_data_sources.AVERAGE,
      week: 0,
      season_year: year,
      season_type: 'REG'
    })
    if (!projections.length) continue

    const pids = projections.map((row) => row.pid)
    const players = await db('player').whereIn('pid', pids)
    const position_by_pid = Object.fromEntries(
      players.map((row) => [row.pid, row.primary_position])
    )

    const realized = await db('scoring_format_player_seasonlogs')
      .where({ scoring_format_id: scoring_format.id, year })
      .whereIn('pid', pids)
    const realized_by_pid = Object.fromEntries(
      realized.map((row) => [row.pid, Number(row.points)])
    )

    const year_pairs = {}
    for (const projection of projections) {
      const position = position_by_pid[projection.pid]
      if (!fantasy_positions.includes(position)) continue

      const { week, ...stats } = projection
      const { total } = calculatePoints({
        stats,
        position,
        league: scoring_format,
        use_projected_stats: true
      })
      if (!(total > 0)) continue

      // A player carrying a season projection and no seasonlog played zero
      // snaps. Dropping him would fit on survivors only, which reads the
      // injury attrition a season projection is supposed to price in as if it
      // never happened, and biases the slope up.
      const outcome = realized_by_pid[projection.pid] ?? 0
      if (!year_pairs[position]) year_pairs[position] = []
      year_pairs[position].push([total, outcome])
    }

    for (const [position, pairs] of Object.entries(year_pairs)) {
      pairs.sort((a, b) => b[0] - a[0])
      pairs_by_position[position].push(
        ...pairs.slice(0, FIT_DEPTH_BY_POSITION[position] ?? pairs.length)
      )
    }
  }

  return pairs_by_position
}

const fit_week_period = async ({ scoring_format, years }) => {
  const pairs_by_position = {}
  for (const position of fantasy_positions) pairs_by_position[position] = []

  for (const year of years) {
    const projections = await db('projections_index')
      .where({
        sourceid: external_data_sources.AVERAGE,
        season_year: year,
        season_type: 'REG'
      })
      .whereBetween('week', [1, current_season.nflFinalWeek])
    if (!projections.length) continue

    const pids = Array.from(new Set(projections.map((row) => row.pid)))
    const players = await db('player').whereIn('pid', pids)
    const position_by_pid = Object.fromEntries(
      players.map((row) => [row.pid, row.primary_position])
    )

    const realized = await db('scoring_format_player_gamelogs')
      .join(
        'nfl_games',
        'nfl_games.esbid',
        'scoring_format_player_gamelogs.esbid'
      )
      .where(
        'scoring_format_player_gamelogs.scoring_format_id',
        scoring_format.id
      )
      .where('nfl_games.season_year', year)
      .where('nfl_games.season_type', 'REG')
      .whereIn('scoring_format_player_gamelogs.pid', pids)
      .select(
        'scoring_format_player_gamelogs.pid',
        'scoring_format_player_gamelogs.points',
        'nfl_games.week'
      )
    const realized_by_key = {}
    for (const row of realized) {
      realized_by_key[`${row.pid}:${row.week}`] = Number(row.points)
    }

    const week_pairs = {}
    for (const projection of projections) {
      const position = position_by_pid[projection.pid]
      if (!fantasy_positions.includes(position)) continue

      const { week, ...stats } = projection
      const { total } = calculatePoints({
        stats,
        position,
        league: scoring_format,
        use_projected_stats: true
      })
      if (!(total > 0)) continue

      // Unlike the season fit, a missing gamelog is EXCLUDED rather than scored
      // as zero. A weekly projection is consumed to choose among players who are
      // playing that week -- a bye or an inactive is not a bad projection, and
      // scoring those weeks as zero would collapse every weekly slope.
      const outcome = realized_by_key[`${projection.pid}:${week}`]
      if (outcome === undefined) continue

      const key = `${position}:${week}`
      if (!week_pairs[key]) week_pairs[key] = []
      week_pairs[key].push([total, outcome])
    }

    // Depth is applied per week, since the rosterable population is a per-week
    // question on the weekly board.
    for (const [key, pairs] of Object.entries(week_pairs)) {
      const position = key.split(':')[0]
      pairs.sort((a, b) => b[0] - a[0])
      pairs_by_position[position].push(
        ...pairs.slice(0, FIT_DEPTH_BY_POSITION[position] ?? pairs.length)
      )
    }
  }

  return pairs_by_position
}

export const fit_projection_calibration = async ({
  scoring_format_id,
  fit_years = DEFAULT_FIT_YEARS
}) => {
  const scoring_format = await db('league_scoring_formats')
    .where({ id: scoring_format_id })
    .first()
  if (!scoring_format) {
    throw new Error(`scoring format ${scoring_format_id} not found`)
  }

  // Completed seasons only -- the current season has no realized outcome yet.
  const years = []
  for (
    let year = current_season.year - fit_years;
    year < current_season.year;
    year++
  ) {
    years.push(year)
  }

  const periods = {
    season: await fit_season_period({ scoring_format, years }),
    week: await fit_week_period({ scoring_format, years })
  }

  const rows = []
  for (const [period, pairs_by_position] of Object.entries(periods)) {
    for (const position of fantasy_positions) {
      const fit = fit_linear_regression(pairs_by_position[position] || [])
      if (!fit) {
        log(`${scoring_format_id} ${period} ${position}: not enough data`)
        continue
      }
      rows.push({
        scoring_format_id,
        period,
        position,
        n: fit.n,
        slope: Number(fit.slope.toFixed(4)),
        intercept: Number(fit.intercept.toFixed(3)),
        r: Number(fit.r.toFixed(4)),
        mean_projected: Number(fit.mean_projected.toFixed(3)),
        mean_realized: Number(fit.mean_realized.toFixed(3)),
        fit_years
      })
    }
  }

  return rows
}

const main = async () => {
  const argv = initialize_cli()
  const fit_years = argv.fit_years ? Number(argv.fit_years) : DEFAULT_FIT_YEARS

  let scoring_format_ids
  if (argv.scoring_format_id) {
    scoring_format_ids = [argv.scoring_format_id]
  } else {
    const rows = await db('league_scoring_formats').select('id')
    scoring_format_ids = rows.map((row) => row.id)
  }

  const all_rows = []
  for (const scoring_format_id of scoring_format_ids) {
    try {
      const rows = await fit_projection_calibration({
        scoring_format_id,
        fit_years
      })
      all_rows.push(...rows)
      for (const row of rows) {
        log(
          `${row.scoring_format_id} ${row.period.padEnd(6)} ${row.position.padEnd(4)} ` +
            `n=${String(row.n).padStart(5)} slope=${row.slope.toFixed(3).padStart(6)} ` +
            `intercept=${row.intercept.toFixed(2).padStart(7)} r=${row.r.toFixed(3).padStart(6)}`
        )
      }
    } catch (err) {
      log(`${scoring_format_id} failed: ${err.message}`)
    }
  }

  if (argv.save && all_rows.length) {
    await db('scoring_format_projection_calibration')
      .insert(all_rows)
      .onConflict(['scoring_format_id', 'period', 'position'])
      .merge()
    log(`saved ${all_rows.length} calibration rows`)
  } else {
    log(`dry run (${all_rows.length} rows) — pass --save to persist`)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default fit_projection_calibration
