import debug from 'debug'
import dayjs from 'dayjs'
import dayOfYear from 'dayjs/plugin/dayOfYear.js'

import db from '#db'
import {
  groupBy,
  Roster,
  getRosterSize,
  weightProjections,
  calculatePoints,
  calculateValues,
  calculatePrices,
  calculateBaselines,
  calculatePlayerValuesRestOfSeason
} from '#libs-shared'
import {
  current_season,
  external_data_sources,
  create_empty_projected_fantasy_stats
} from '#constants'
import {
  get_league_format,
  get_player_projections,
  getPlayers,
  getRoster,
  getLeague,
  get_player_transactions,
  is_main,
  batch_insert,
  report_job,
  simulation
} from '#libs-server'
import project_lineups from './project-lineups.mjs'
import calculateMatchupProjection from './calculate-matchup-projection.mjs'
import calculatePlayoffMatchupProjection from './calculate-playoff-matchup-projection.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'

dayjs.extend(dayOfYear)

const log = debug('process-projections')
debug.enable(
  'process-projections,project-lineups,simulation:*,calculate-matchup-projection'
)

const timestamp = Math.round(Date.now() / 1000)

/**
 * Run season forecast simulation and save results.
 * Uses the new player-level correlation simulation system.
 */
const run_season_forecast = async (lid) => {
  if (isNaN(lid)) {
    log('Skipping season forecast - invalid lid')
    return
  }

  const year = current_season.year
  let forecast_result

  try {
    // Get league to access wildcard_round and championship_round from seasons table
    const league = await getLeague({ lid, year })
    if (!league) {
      log(`League ${lid} not found, skipping forecast`)
      return
    }

    const wildcard_round = league.wildcard_round
    const championship_round = league.championship_round || []
    const championship_start_week =
      championship_round.length > 0 ? championship_round[0] : null

    if (current_season.week <= current_season.regularSeasonFinalWeek) {
      log(`Running season forecast for league ${lid}`)
      forecast_result = await simulation.simulate_season_forecast({
        league_id: lid,
        year
      })
    } else if (wildcard_round && current_season.week === wildcard_round) {
      log(
        `Running wildcard forecast for league ${lid} (week ${wildcard_round})`
      )
      forecast_result = await simulation.simulate_wildcard_forecast({
        league_id: lid,
        year
      })
    } else if (
      championship_start_week &&
      current_season.week >= championship_start_week &&
      current_season.week <= current_season.finalWeek
    ) {
      log(
        `Running championship forecast for league ${lid} (starting week ${championship_start_week})`
      )
      forecast_result = await simulation.simulate_championship_forecast({
        league_id: lid,
        year
      })
    } else {
      log('No forecast to run - season complete')
      return
    }

    // Save forecast results to database
    const forecastInserts = []
    for (const [tid, forecast] of Object.entries(forecast_result)) {
      forecastInserts.push({
        tid: Number(tid),
        lid,
        week: current_season.week,
        year,
        day: dayjs().dayOfYear(),
        playoff_odds: forecast.playoff_odds,
        division_odds: forecast.division_odds,
        bye_odds: forecast.bye_odds,
        championship_odds: forecast.championship_odds,
        timestamp
      })
    }

    if (forecastInserts.length) {
      await db('league_team_forecast')
        .insert(forecastInserts)
        .onConflict(['tid', 'year', 'week', 'day'])
        .merge()
      log(`Saved ${forecastInserts.length} team forecasts`)
    }
  } catch (err) {
    log(`Error running season forecast: ${err.message}`)
    console.error(err)
  }
}

const process_average_projections = async ({ year, seas_type = 'REG' }) => {
  log(`processing projections for year ${year} and seas_type ${seas_type}`)
  const projections = await get_player_projections({ year, seas_type })
  log(`fetched ${projections.length} projections`)
  const projections_by_pid = groupBy(projections, 'pid')
  const projection_pids = Object.keys(projections_by_pid)

  const player_rows = await db('player').whereIn('pid', projection_pids)

  const projectionInserts = []
  const rosProjectionInserts = []

  for (const player_row of player_rows) {
    const projections = projections_by_pid[player_row.pid] || []
    player_row.projection = {}

    // For POST season, only process the current playoff week
    if (seas_type === 'POST') {
      const week = current_season.nfl_seas_week
      player_row.projection[week] = {}

      const projection = weightProjections({
        projections,
        week
      })

      player_row.projection[week] = projection
      projectionInserts.push({
        pid: player_row.pid,
        sourceid: external_data_sources.AVERAGE,
        seas_type,
        year: current_season.year,
        week,
        ...projection
      })
      continue
    }

    // Regular season processing
    let week = year === current_season.year ? current_season.week : 0
    for (; week <= current_season.nflFinalWeek; week++) {
      player_row.projection[week] = {}

      // average projection
      const projection = weightProjections({
        projections,
        week
      })

      player_row.projection[week] = projection
      projectionInserts.push({
        pid: player_row.pid,
        sourceid: external_data_sources.AVERAGE,
        seas_type,
        year: current_season.year,
        week,
        ...projection
      })
    }

    // Only calculate ROS projections for regular season
    if (seas_type === 'REG') {
      // calculate ros projection
      const ros = create_empty_projected_fantasy_stats()
      let proj_wks = 0
      for (const [week, projection] of Object.entries(player_row.projection)) {
        if (week && week !== '0' && week >= current_season.week) {
          proj_wks += 1
          for (const [key, value] of Object.entries(projection)) {
            ros[key] += value
          }
        }
      }

      player_row.proj_wks = proj_wks
      player_row.projection.ros = ros

      rosProjectionInserts.push({
        pid: player_row.pid,
        sourceid: external_data_sources.AVERAGE,
        year: current_season.year,
        timestamp: 0, // must be set at zero for unique key
        ...ros
      })
    }
  }

  if (projectionInserts.length) {
    log(`processing ${projectionInserts.length} projections`)

    const timestamp = 0 // must be set at zero for unique key
    await batch_insert({
      items: projectionInserts,
      save: (items) =>
        db('projections_index')
          .insert(items)
          .onConflict([
            'sourceid',
            'pid',
            'userid',
            'week',
            'year',
            'seas_type'
          ])
          .merge(),
      batch_size: 100
    })
    await batch_insert({
      items: projectionInserts.map((i) => ({ ...i, timestamp })),
      save: (items) =>
        db('projections')
          .insert(items)
          .onConflict([
            'sourceid',
            'pid',
            'userid',
            'timestamp',
            'week',
            'year',
            'seas_type'
          ])
          .merge(),
      batch_size: 100
    })
    log(`processed and saved ${projectionInserts.length} projections`)
  }

  if (rosProjectionInserts.length) {
    log(`processing ${rosProjectionInserts.length} ros projections`)

    await batch_insert({
      items: rosProjectionInserts,
      save: (items) =>
        db('ros_projections')
          .insert(items)
          .onConflict(['sourceid', 'pid', 'year'])
          .merge(),
      batch_size: 100
    })
    log(`processed and saved ${rosProjectionInserts.length} ros projections`)
  }

  return player_rows
}

const process_scoring_format = async ({
  year,
  scoring_format_hash,
  player_rows
}) => {
  const league_scoring_format = await db('league_scoring_formats')
    .where({ scoring_format_hash })
    .first()

  const points_inserts = []
  const current_week = year === current_season.year ? current_season.week : 0

  for (const player_row of player_rows) {
    for (let week = current_week; week <= current_season.nflFinalWeek; week++) {
      const projection = player_row.projection[week]

      points_inserts.push({
        pid: player_row.pid,
        year: current_season.year,
        scoring_format_hash,
        week,
        ...calculatePoints({
          stats: projection,
          position: player_row.pos,
          league: league_scoring_format,
          use_projected_stats: true
        })
      })
    }

    points_inserts.push({
      pid: player_row.pid,
      year: current_season.year,
      scoring_format_hash,
      week: 'ros',
      ...calculatePoints({
        stats: player_row.projection.ros,
        position: player_row.pos,
        league: league_scoring_format,
        use_projected_stats: true
      })
    })
  }

  if (points_inserts.length) {
    // Delete only current week, future weeks, and ROS projections
    await db('scoring_format_player_projection_points')
      .where({ scoring_format_hash, year })
      .where(function () {
        this.where('week', 'ros').orWhere(function () {
          this.whereNot('week', 'ros').andWhere(
            db.raw('CAST(week AS INTEGER) >= ?', [current_week])
          )
        })
      })
      .del()

    await batch_insert({
      items: points_inserts,
      save: (items) =>
        db('scoring_format_player_projection_points').insert(items),
      batch_size: 100
    })
    log(`processed and saved ${points_inserts.length} player points`)
  }
}

const process_league_format = async ({
  projection_pids,
  year,
  league_format_hash
}) => {
  log(`processing league format ${league_format_hash}`)
  const league_format = await get_league_format({ league_format_hash })
  if (!league_format) {
    throw new Error(`league format ${league_format_hash} not found`)
  }

  const { num_teams, cap, min_bid } = league_format
  const league_roster_size = getRosterSize(league_format)
  const league_total_salary_cap =
    num_teams * cap - num_teams * league_roster_size * min_bid

  const player_rows = await getPlayers({
    pids: projection_pids,
    league_format_hash: league_format.league_format_hash,
    scoring_format_hash: league_format.scoring_format_hash
  })

  const baselines = {}
  let week = year === current_season.year ? current_season.week : 0
  for (; week <= current_season.nflFinalWeek; week++) {
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

  calculatePlayerValuesRestOfSeason({
    players: player_rows,
    league: league_format
  })

  const valueInserts = []
  for (const player_row of player_rows) {
    for (const [week, pts_added] of Object.entries(player_row.pts_added)) {
      const params = {
        pid: player_row.pid,
        year: current_season.year,
        league_format_hash,
        week,
        pts_added,
        market_salary: player_row.market_salary[week]
      }

      valueInserts.push(params)
    }
  }

  if (valueInserts.length) {
    await db('league_format_player_projection_values')
      .del()
      .where({ league_format_hash })
    await batch_insert({
      items: valueInserts,
      save: (items) =>
        db('league_format_player_projection_values').insert(items),
      batch_size: 100
    })
    log(`processed and saved ${valueInserts.length} player values`)
  }
}

const process_league = async ({ year, lid }) => {
  let week = year === current_season.year ? current_season.week : 0

  const league = await getLeague({ lid })
  const teams = await db('teams').where({ lid, year })
  const league_roster_size = getRosterSize(league)

  const { num_teams, cap, min_bid } = league
  const league_total_salary_cap =
    num_teams * cap - num_teams * league_roster_size * min_bid
  let league_available_salary_space = 0

  // initialize roster rows
  const rosterRows = []
  const rostered_pids = []

  // check to see if it is past the fantasy season
  if (week <= current_season.finalWeek) {
    for (const team of teams) {
      const rosterRow = await getRoster({ tid: team.uid, week })
      rosterRows.push(rosterRow)
      rosterRow.players.forEach((p) => rostered_pids.push(p.pid))
      const roster = new Roster({ roster: rosterRow, league })
      const team_available_salary_space =
        roster.availableCap - min_bid * roster.availableSpace
      if (team_available_salary_space > 0) {
        league_available_salary_space =
          league_available_salary_space + team_available_salary_space
      }

      team._roster_row = rosterRow
      team._roster = roster
    }
  }

  // get projections for current week
  const projections = await get_player_projections()

  const projections_by_pid = groupBy(projections, 'pid')
  const projection_pids = Object.keys(projections_by_pid)

  const player_rows = await getPlayers({
    pids: projection_pids.concat(rostered_pids),
    leagueId: lid,
    scoring_format_hash: league.scoring_format_hash
  })

  const transactions = await get_player_transactions({
    lid,
    pids: rostered_pids
  })

  // update player rows with current salary
  for (const tran of transactions) {
    const player_row = player_rows.find((p) => p.pid === tran.pid)
    player_row.value = tran.value
  }

  week = year === current_season.year ? current_season.week : 0

  const baselines = {}
  for (; week <= current_season.nflFinalWeek; week++) {
    // baselines
    const baseline = calculateBaselines({
      players: player_rows,
      league,
      rosterRows,
      week
    })
    baselines[week] = baseline

    // calculate values
    const total_pts_added = calculateValues({
      players: player_rows,
      baselines: baseline,
      week,
      league
    })
    calculatePrices({
      cap: league_total_salary_cap,
      total_pts_added,
      players: player_rows,
      week
    })
  }

  calculatePlayerValuesRestOfSeason({
    players: player_rows,
    rosterRows,
    league
  })

  let league_available_pts_added = 0
  for (const player_row of player_rows) {
    const is_available = !rostered_pids.includes(player_row.pid)
    if (is_available && player_row.pts_added[0] > 0) {
      league_available_pts_added =
        league_available_pts_added + player_row.pts_added[0]
    }
  }

  const valueInserts = []
  for (const player_row of player_rows) {
    if (!projection_pids.includes(player_row.pid)) {
      continue
    }

    const is_available = !rostered_pids.includes(player_row.pid)
    const league_adjusted_rate = is_available
      ? league_available_salary_space / league_available_pts_added
      : (league_available_salary_space + player_row.value) /
        (league_available_pts_added + Math.max(player_row.pts_added[0], 0))
    const market_salary_adj = Math.max(
      Math.round(league_adjusted_rate * player_row.pts_added[0]) || 0,
      0
    )
    player_row.market_salary_adj = market_salary_adj

    for (const [week, salary_adj_pts_added] of Object.entries(
      player_row.salary_adj_pts_added
    )) {
      const params = {
        pid: player_row.pid,
        year: current_season.year,
        lid,
        week,
        salary_adj_pts_added
      }

      if (week === '0') {
        params.market_salary_adj = market_salary_adj
      }
      valueInserts.push(params)
    }
  }

  const baselineInserts = []
  for (const [week, positions] of Object.entries(baselines)) {
    for (const [position, types] of Object.entries(positions)) {
      for (const [type, baseline] of Object.entries(types)) {
        if (!baseline) continue

        baselineInserts.push({
          lid,
          week,
          year: current_season.year,
          pos: position,
          pid: baseline.pid,
          type
        })
      }
    }
  }

  if (baselineInserts.length) {
    await batch_insert({
      items: baselineInserts,
      save: (items) =>
        db('league_baselines')
          .insert(items)
          .onConflict(['lid', 'week', 'pos', 'type'])
          .merge(),
      batch_size: 100
    })
    log(`saved ${baselineInserts.length} baselines`)
  }

  if (valueInserts.length) {
    await db('league_player_projection_values').del().where({ lid })
    await batch_insert({
      items: valueInserts,
      save: (items) =>
        db('league_player_projection_values')
          .insert(items)
          .onConflict(['pid', 'lid', 'week', 'year'])
          .merge(),
      batch_size: 100
    })
    log(`processed and saved ${valueInserts.length} player values`)
  }

  if (current_season.week <= current_season.finalWeek) {
    await project_lineups(lid)
    await calculateMatchupProjection({ lid })
    await calculatePlayoffMatchupProjection({ lid })
  }

  // Run season/playoff forecast simulation
  await run_season_forecast(lid)

  if (lid) {
    await db('leagues').update({ processed_at: timestamp }).where({ uid: lid })
  }
}

const run = async ({ year = current_season.year } = {}) => {
  const league_formats = {}
  const scoring_formats = {}
  const lids = [0, 1]
  const leagues_cache = {}

  const seas_type = current_season.nfl_seas_type === 'POST' ? 'POST' : 'REG'

  if (seas_type === 'POST') {
    await process_average_projections({ year, seas_type })
    return
  }

  const player_rows = await process_average_projections({ year })
  const projection_pids = player_rows.map((p) => p.pid)

  // register league and scoring formats to process
  for (const lid of lids) {
    const league = await getLeague({ lid, year })
    leagues_cache[lid] = league
    league_formats[league.league_format_hash] = true
    scoring_formats[league.scoring_format_hash] = true
  }

  // calculate player points for each scoring format
  for (const scoring_format_hash of Object.keys(scoring_formats)) {
    await process_scoring_format({ year, scoring_format_hash, player_rows })
  }

  // calculate player market values for each league format
  for (const league_format_hash of Object.keys(league_formats)) {
    await process_league_format({ year, league_format_hash, projection_pids })
  }

  // calculate league specific player values for each league
  for (const lid of lids) {
    const league = leagues_cache[lid]
    if (!league.hosted) {
      continue
    }

    await process_league({ year, lid })
  }
}

const main = async () => {
  debug.enable('process-projections,project-lineups,simulation:*')
  let error
  try {
    await run()
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.PROCESS_PROJECTIONS,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
