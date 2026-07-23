import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import {
  calculateBaselines,
  calculateValues,
  calculatePrices,
  getRosterSize,
  groupBy
} from '#libs-shared'
import { current_season, external_data_sources } from '#constants'
import { is_main, batch_insert, get_league_format } from '#libs-server'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('process-projections-for-league-format')
debug.enable('process-projections-for-league-format')

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
  player_rows
}) => {
  const league_format_id = league_format.id
  const pricing_model = league_format.pricing_model || 'auction'
  log(
    `processing league format ${league_format_id} for year ${year} (${pricing_model})`
  )

  const { num_teams, cap, min_bid } = league_format
  const league_roster_size = getRosterSize(league_format)
  const league_total_salary_cap =
    num_teams * cap - num_teams * league_roster_size * min_bid

  const baselines = {}
  let week = 0

  const final_week_result = await db('nfl_games')
    .where({ season_year: year, season_type: 'REG' })
    .max('week as final_week')
    .first()

  const final_week = final_week_result
    ? final_week_result.final_week
    : current_season.nflFinalWeek

  for (; week <= final_week; week++) {
    const baseline = calculateBaselines({
      players: player_rows,
      league: league_format,
      week
    })
    baselines[week] = baseline

    const total_pts_added = calculateValues({
      players: player_rows,
      baselines: baseline,
      week,
      league: league_format
    })

    if (pricing_model === 'auction') {
      calculatePrices({
        cap: league_total_salary_cap,
        total_pts_added,
        players: player_rows,
        week
      })
    }
  }

  const value_inserts = []
  for (const player_row of player_rows) {
    for (const [week, pts_added] of Object.entries(player_row.pts_added)) {
      const params = {
        pid: player_row.pid,
        year,
        league_format_id,
        week,
        pts_added,
        market_salary:
          pricing_model === 'auction' ? player_row.market_salary[week] : null
      }

      value_inserts.push(params)
    }
  }

  if (value_inserts.length) {
    await db('league_format_player_projection_values')
      .del()
      .where({ league_format_id, year })
    await batch_insert({
      items: value_inserts,
      save: (items) =>
        db('league_format_player_projection_values').insert(items),
      batch_size: 100
    })
    log(
      `processed and saved ${value_inserts.length} player values for year ${year}`
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
      .distinct('year')
      .orderBy('year', 'desc')
    years = projection_years.map((row) => row.year)
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
      sourceid: external_data_sources.AVERAGE,
      season_type: 'REG'
    })

    const projections_by_pid = groupBy(projections, 'pid')
    const projection_pids = Object.keys(projections_by_pid)

    const players = await db('player').whereIn('pid', projection_pids)

    const scoring_format_points = await db(
      'scoring_format_player_projection_points'
    )
      .where({
        year: process_year,
        scoring_format_id: league_format.scoring_format_id
      })
      .whereIn('pid', projection_pids)

    const points_by_pid = groupBy(scoring_format_points, 'pid')

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

      return {
        ...player,
        projection,
        points
      }
    })

    await process_league_format_year({
      year: process_year,
      league_format,
      player_rows
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

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default process_projections_for_league_format
