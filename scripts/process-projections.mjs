import debug from 'debug'

import db from '#db'
import {
  constants,
  groupBy,
  getRosterSize,
  weightProjections,
  calculatePoints,
  calculateValues,
  calculatePrices,
  calculateBaselines,
  calculatePlayerValuesRestOfSeason,
  getHistoricBaselines
} from '#common'
import {
  getProjections,
  getRoster,
  getLeague,
  getPlayerTransactions,
  isMain
} from '#utils'
import projectLineups from './project-lineups.mjs'
import simulateSeason from './simulate-season.mjs'

const log = debug('process-projections')

const processLeague = async ({ year, lid }) => {
  let week = year === constants.season.year ? constants.season.week : 0
  const { finalWeek } = constants.season
  const league = await getLeague(lid)
  const teams = await db('teams').where({ lid })
  const { nteams, cap, minBid } = league
  const rosterSize = getRosterSize(league)
  const leagueTotalCap = nteams * cap - nteams * rosterSize * minBid

  const rosterRows = []
  const rostered_pids = []
  for (const team of teams) {
    const rosterRow = await getRoster({ tid: team.uid, week })
    rosterRows.push(rosterRow)
    rosterRow.players.forEach((p) => rostered_pids.push(p.pid))
  }

  const projections = await getProjections()
  const projections_by_pid = groupBy(projections, 'pid')
  const projection_pids = Object.keys(projections_by_pid)
  const player_rows = await db('player').whereIn(
    'pid',
    projection_pids.concat(rostered_pids)
  )

  const transactions = await getPlayerTransactions({
    lid,
    pids: rostered_pids
  })

  for (const tran of transactions) {
    const player_row = player_rows.find((p) => p.pid === tran.pid)
    player_row.value = tran.value
  }

  for (const player_row of player_rows) {
    player_row.value =
      typeof player_row.value === 'undefined' || player_row.value === null
        ? null
        : player_row.value
    player_row.projection = {}
    player_row.points = {}
    player_row.vorp = {}
    player_row.vorp_adj = {}
    player_row.market_salary = {}

    const projections = projections_by_pid[player_row.pid] || []

    week = year === constants.season.year ? constants.season.week : 0
    for (; week <= finalWeek; week++) {
      player_row.projection[week] = {}
      player_row.points[week] = {}
      player_row.vorp[week] = {}
      player_row.vorp_adj[week] = {}
      player_row.market_salary[week] = {}

      // average projection
      const projection = weightProjections({
        projections,
        week
      })

      // points
      const points = calculatePoints({
        stats: projection,
        position: player_row.pos,
        league
      })

      player_row.projection[week] = projection
      player_row.points[week] = points
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
    player_row.points.ros = calculatePoints({
      stats: ros,
      position: player_row.pos,
      league
    })
  }

  week = year === constants.season.year ? constants.season.week : 0

  const baselines = {}
  const historicBaselines = getHistoricBaselines({ league })
  for (; week <= finalWeek; week++) {
    // baselines
    const baseline = calculateBaselines({
      players: player_rows,
      league,
      rosterRows,
      week
    })
    baselines[week] = baseline

    // calculate values
    const total = calculateValues({
      players: player_rows,
      baselines: baseline,
      week,
      historicBaselines
    })
    calculatePrices({ cap: leagueTotalCap, total, players: player_rows, week })
  }

  calculatePlayerValuesRestOfSeason({
    players: player_rows,
    rosterRows,
    league
  })

  const projectionInserts = []
  const rosProjectionInserts = []
  const pointsInserts = []
  const valueInserts = []
  for (const player_row of player_rows) {
    if (!projection_pids.includes(player_row.pid)) {
      continue
    }

    for (const [week, projection] of Object.entries(player_row.projection)) {
      if (week === 'ros') {
        rosProjectionInserts.push({
          pid: player_row.pid,
          sourceid: constants.sources.AVERAGE,
          year: constants.season.year,
          timestamp: 0,
          week,
          ...projection
        })
      } else {
        projectionInserts.push({
          pid: player_row.pid,
          sourceid: constants.sources.AVERAGE,
          year: constants.season.year,
          timestamp: 0, // must be set at zero for unique key
          week,
          ...projection
        })
      }
    }

    for (const [week, points] of Object.entries(player_row.points)) {
      pointsInserts.push({
        pid: player_row.pid,
        year: constants.season.year,
        lid,
        week,
        ...points
      })
    }

    for (const [week, vorp] of Object.entries(player_row.vorp)) {
      valueInserts.push({
        pid: player_row.pid,
        year: constants.season.year,
        lid,
        week,
        vorp,
        vorp_adj: player_row.vorp_adj[week],
        market_salary: player_row.market_salary[week]
      })
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
    await db('league_baselines').insert(baselineInserts).onConflict().merge()
    log(`saved ${baselineInserts.length} baselines`)
  }

  if (projectionInserts.length) {
    await db('projections').insert(projectionInserts).onConflict().merge()
    log(`processed and saved ${projectionInserts.length} projections`)
  }

  if (rosProjectionInserts.length) {
    await db('ros_projections')
      .insert(rosProjectionInserts)
      .onConflict()
      .merge()
    log(`processed and saved ${rosProjectionInserts.length} ros projections`)
  }

  if (pointsInserts.length) {
    await db('league_player_projection_points')
      .insert(pointsInserts)
      .onConflict()
      .merge()
    log(`processed and saved ${pointsInserts.length} player points`)
  }

  if (valueInserts.length) {
    await db('league_player_projection_values')
      .insert(valueInserts)
      .onConflict()
      .merge()
    log(`processed and saved ${valueInserts.length} player values`)
  }

  await projectLineups()
  if (constants.season.week <= constants.season.regularSeasonFinalWeek)
    await simulateSeason()
}

const run = async ({ year = constants.season.year } = {}) => {
  const lids = [0, 1]
  for (const lid of lids) {
    await processLeague({ year, lid })
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

  await db('jobs').insert({
    type: constants.jobs.PROCESS_PROJECTIONS,
    succ: error ? 0 : 1,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default run
