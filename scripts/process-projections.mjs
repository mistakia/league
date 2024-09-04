import debug from 'debug'

import db from '#db'
import {
  constants,
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
  get_league_format,
  getProjections,
  getPlayers,
  getRoster,
  getLeague,
  getPlayerTransactions,
  is_main,
  batch_insert,
  report_job
} from '#libs-server'
import project_lineups from './project-lineups.mjs'
import simulate_season from './simulate-season.mjs'
import calculateMatchupProjection from './calculate-matchup-projection.mjs'
import calculatePlayoffMatchupProjection from './calculate-playoff-matchup-projection.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'

const log = debug('process-projections')
debug.enable(
  'process-projections,project-lineups,simulate-season,calculate-matchup-projection'
)

const timestamp = Math.round(Date.now() / 1000)

const process_average_projections = async ({ year }) => {
  // get projections for current week
  const projections = await getProjections({ year })

  const projections_by_pid = groupBy(projections, 'pid')
  const projection_pids = Object.keys(projections_by_pid)

  const player_rows = await db('player').whereIn('pid', projection_pids)

  const projectionInserts = []
  const rosProjectionInserts = []

  for (const player_row of player_rows) {
    const projections = projections_by_pid[player_row.pid] || []
    player_row.projection = {}

    let week = year === constants.season.year ? constants.season.week : 0
    for (; week <= constants.season.nflFinalWeek; week++) {
      player_row.projection[week] = {}

      // average projection
      const projection = weightProjections({
        projections,
        week
      })

      player_row.projection[week] = projection
      projectionInserts.push({
        pid: player_row.pid,
        sourceid: constants.sources.AVERAGE,
        year: constants.season.year,
        week,
        ...projection
      })
    }

    // calculate ros projection
    const ros = constants.createStats()
    let projWks = 0
    for (const [week, projection] of Object.entries(player_row.projection)) {
      if (week && week !== '0' && week >= constants.season.week) {
        projWks += 1
        for (const [key, value] of Object.entries(projection)) {
          ros[key] += value
        }
      }
    }

    player_row.projWks = projWks
    player_row.projection.ros = ros

    rosProjectionInserts.push({
      pid: player_row.pid,
      sourceid: constants.sources.AVERAGE,
      year: constants.season.year,
      timestamp: 0, // must be set at zero for unique key
      ...ros
    })
  }

  if (projectionInserts.length) {
    const timestamp = 0 // must be set at zero for unique key
    await batch_insert({
      items: projectionInserts,
      save: (items) =>
        db('projections_index')
          .insert(items)
          .onConflict(['sourceid', 'pid', 'userid', 'week', 'year'])
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
            'year'
          ])
          .merge(),
      batch_size: 100
    })
    log(`processed and saved ${projectionInserts.length} projections`)
  }

  if (rosProjectionInserts.length) {
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

  const pointsInserts = []

  for (const player_row of player_rows) {
    let week = year === constants.season.year ? constants.season.week : 0
    for (; week <= constants.season.nflFinalWeek; week++) {
      const projection = player_row.projection[week]

      pointsInserts.push({
        pid: player_row.pid,
        year: constants.season.year,
        scoring_format_hash,
        week,
        ...calculatePoints({
          stats: projection,
          position: player_row.pos,
          league: league_scoring_format
        })
      })
    }

    pointsInserts.push({
      pid: player_row.pid,
      year: constants.season.year,
      scoring_format_hash,
      week: 'ros',
      ...calculatePoints({
        stats: player_row.projection.ros,
        position: player_row.pos,
        league: league_scoring_format
      })
    })
  }

  if (pointsInserts.length) {
    await db('scoring_format_player_projection_points')
      .del()
      .where({ scoring_format_hash, year })
    await batch_insert({
      items: pointsInserts,
      save: (items) =>
        db('scoring_format_player_projection_points').insert(items),
      batch_size: 100
    })
    log(`processed and saved ${pointsInserts.length} player points`)
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
  let week = year === constants.season.year ? constants.season.week : 0
  for (; week <= constants.season.nflFinalWeek; week++) {
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
        year: constants.season.year,
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
  let week = year === constants.season.year ? constants.season.week : 0

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
  if (week <= constants.season.finalWeek) {
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
  const projections = await getProjections()

  const projections_by_pid = groupBy(projections, 'pid')
  const projection_pids = Object.keys(projections_by_pid)

  const player_rows = await getPlayers({
    pids: projection_pids.concat(rostered_pids),
    leagueId: lid,
    scoring_format_hash: league.scoring_format_hash
  })

  const transactions = await getPlayerTransactions({
    lid,
    pids: rostered_pids
  })

  // update player rows with current salary
  for (const tran of transactions) {
    const player_row = player_rows.find((p) => p.pid === tran.pid)
    player_row.value = tran.value
  }

  week = year === constants.season.year ? constants.season.week : 0

  const baselines = {}
  for (; week <= constants.season.nflFinalWeek; week++) {
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
        year: constants.season.year,
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
          year: constants.season.year,
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

  if (constants.season.week <= constants.season.finalWeek) {
    await project_lineups(lid)
    await calculateMatchupProjection({ lid })
    await calculatePlayoffMatchupProjection({ lid })
  }

  if (constants.season.week <= constants.season.regularSeasonFinalWeek) {
    await simulate_season(lid)
  }

  if (lid) {
    await db('leagues').update({ processed_at: timestamp }).where({ uid: lid })
  }
}

const run = async ({ year = constants.season.year } = {}) => {
  const league_formats = {}
  const scoring_formats = {}
  const lids = [0, 1]
  const leagues_cache = {}

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
  debug.enable('process-projections,project-lineups,simulate-season')
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
