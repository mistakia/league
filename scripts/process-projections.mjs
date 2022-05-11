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
  calculatePlayerValuesRestOfSeason
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
  const rosteredIds = []
  for (const team of teams) {
    const rosterRow = await getRoster({ tid: team.uid, week })
    rosterRows.push(rosterRow)
    rosterRow.players.forEach((p) => rosteredIds.push(p.player))
  }

  const playerProjections = await getProjections()
  const groupedProjs = groupBy(playerProjections, 'player')
  const projectionPlayerIds = Object.keys(groupedProjs)
  const players = await db('player').whereIn(
    'player',
    projectionPlayerIds.concat(rosteredIds)
  )

  const transactions = await getPlayerTransactions({
    lid,
    playerIds: rosteredIds
  })

  for (const tran of transactions) {
    const player = players.find((p) => p.player === tran.player)
    player.value = tran.value
  }

  for (const player of players) {
    player.value =
      typeof player.value === 'undefined' || player.value === null
        ? null
        : player.value
    player.projection = {}
    player.points = {}
    player.vorp = {}
    player.vorp_adj = {}
    player.market_salary = {}

    const projections = groupedProjs[player.player] || []

    week = year === constants.season.year ? constants.season.week : 0
    for (; week <= finalWeek; week++) {
      player.projection[week] = {}
      player.points[week] = {}
      player.vorp[week] = {}
      player.vorp_adj[week] = {}
      player.market_salary[week] = {}

      // average projection
      const projection = weightProjections({
        projections,
        week
      })

      // points
      const points = calculatePoints({
        stats: projection,
        position: player.pos,
        league
      })

      player.projection[week] = projection
      player.points[week] = points
    }

    // calculate ros projection
    const ros = constants.createStats()
    let projWks = 0
    for (const [week, projection] of Object.entries(player.projection)) {
      if (week && week !== '0' && week >= constants.season.week) {
        projWks += 1
        for (const [key, value] of Object.entries(projection)) {
          ros[key] += value
        }
      }
    }

    player.projWks = projWks
    player.projection.ros = ros
    player.points.ros = calculatePoints({
      stats: ros,
      position: player.pos,
      league
    })
  }

  week = year === constants.season.year ? constants.season.week : 0

  const baselines = {}
  for (; week <= finalWeek; week++) {
    // baselines
    const baseline = calculateBaselines({ players, league, rosterRows, week })
    baselines[week] = baseline

    // calculate values
    const total = calculateValues({ players, baselines: baseline, week })
    calculatePrices({ cap: leagueTotalCap, total, players, week })
  }

  calculatePlayerValuesRestOfSeason({
    players,
    rosterRows,
    league
  })

  const projectionInserts = []
  const rosProjectionInserts = []
  const pointsInserts = []
  const valueInserts = []
  for (const player of players) {
    if (!projectionPlayerIds.includes(player.player)) {
      continue
    }

    for (const [week, projection] of Object.entries(player.projection)) {
      if (week === 'ros') {
        rosProjectionInserts.push({
          player: player.player,
          sourceid: constants.sources.AVERAGE,
          year: constants.season.year,
          timestamp: 0,
          week,
          ...projection
        })
      } else {
        projectionInserts.push({
          player: player.player,
          sourceid: constants.sources.AVERAGE,
          year: constants.season.year,
          timestamp: 0, // must be set at zero for unique key
          week,
          ...projection
        })
      }
    }

    for (const [week, points] of Object.entries(player.points)) {
      pointsInserts.push({
        player: player.player,
        year: constants.season.year,
        lid,
        week,
        ...points
      })
    }

    for (const [week, vorp] of Object.entries(player.vorp)) {
      valueInserts.push({
        player: player.player,
        year: constants.season.year,
        lid,
        week,
        vorp,
        vorp_adj: player.vorp_adj[week],
        market_salary: player.market_salary[week]
      })
    }
  }

  const baselineInserts = []
  for (const [week, positions] of Object.entries(baselines)) {
    for (const [position, types] of Object.entries(positions)) {
      for (const [type, baseline] of Object.entries(types)) {
        baselineInserts.push({
          lid,
          week,
          year: constants.season.year,
          pos: position,
          player: baseline.player,
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
