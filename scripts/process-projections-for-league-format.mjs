import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import {
  calculateBaselines,
  calculateValues,
  calculatePrices,
  constants,
  getRosterSize,
  groupBy
} from '#libs-shared'
import { is_main, batch_insert, get_league_format } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('process-projections-for-league-format')
debug.enable('process-projections-for-league-format')

const process_league_format_year = async ({
  year,
  league_format,
  player_rows
}) => {
  const { league_format_hash } = league_format
  log(`processing league format ${league_format_hash} for year ${year}`)

  const { num_teams, cap, min_bid } = league_format
  const league_roster_size = getRosterSize(league_format)
  const league_total_salary_cap =
    num_teams * cap - num_teams * league_roster_size * min_bid

  const baselines = {}
  let week = 0

  // Get the final week for the given season
  const final_week_result = await db('nfl_games')
    .where({ year, seas_type: 'REG' })
    .max('week as final_week')
    .first()

  const final_week = final_week_result
    ? final_week_result.final_week
    : constants.season.nflFinalWeek

  for (; week <= final_week; week++) {
    // baselines
    const baseline = calculateBaselines({
      players: player_rows,
      league: league_format,
      week
    })
    baselines[week] = baseline

    // calculate values
    const total_pts_added = calculateValues({
      players: player_rows,
      baselines: baseline,
      week,
      league: league_format
    })
    calculatePrices({
      cap: league_total_salary_cap,
      total_pts_added,
      players: player_rows,
      week
    })
  }

  const value_inserts = []
  for (const player_row of player_rows) {
    for (const [week, pts_added] of Object.entries(player_row.pts_added)) {
      const params = {
        pid: player_row.pid,
        year,
        league_format_hash,
        week,
        pts_added,
        market_salary: player_row.market_salary[week]
      }

      value_inserts.push(params)
    }
  }

  if (value_inserts.length) {
    await db('league_format_player_projection_values')
      .del()
      .where({ league_format_hash, year })
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
  league_format_hash,
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

  const league_format = await get_league_format({ league_format_hash })
  if (!league_format) {
    throw new Error(`league format ${league_format_hash} not found`)
  }

  for (const process_year of years) {
    // Get averaged projections for the given year
    const projections = await db('projections_index').where({
      year: process_year,
      sourceid: constants.sources.AVERAGE
    })

    const projections_by_pid = groupBy(projections, 'pid')
    const projection_pids = Object.keys(projections_by_pid)

    // Get players based on the projections that exist
    const players = await db('player').whereIn('pid', projection_pids)

    // Get scoring format points for the given year and league format
    const scoring_format_points = await db(
      'scoring_format_player_projection_points'
    )
      .where({
        year: process_year,
        scoring_format_hash: league_format.scoring_format_hash
      })
      .whereIn('pid', projection_pids)

    const points_by_pid = groupBy(scoring_format_points, 'pid')

    // Construct player_rows
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

const main = async () => {
  let error
  try {
    const league_format_hash = argv.league_format_hash
    const year = argv.year ? Number(argv.year) : null
    const all = argv.all

    if (!league_format_hash) {
      throw new Error('League format hash is required')
    }

    await process_projections_for_league_format({
      year,
      league_format_hash,
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
