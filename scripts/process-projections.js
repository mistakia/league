// eslint-disable-next-line
require = require('esm')(module /*, options*/)
const debug = require('debug')
// const argv = require('yargs').argv

const db = require('../db')
const {
  constants,
  groupBy,
  getRosterSize,
  weightProjections,
  calculatePoints,
  calculateValues,
  calculatePrices,
  calculateBaselines
} = require('../common')
const { getProjections, getRoster, getLeague } = require('../utils')

const log = debug('process-projections')
debug.enable('process-projections')

const run = async ({ year = constants.season.year } = {}) => {
  let week = year === constants.season.year ? constants.season.week : 0

  const lid = 1
  const finalWeek = constants.season.finalWeek
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

  for (const player of players) {
    player.projection = {}
    player.points = {}
    player.vorp = {}
    player.values = {}
    player.vorp_adj = {}
    player.values_adj = {}

    const projections = groupedProjs[player.player] || []

    week = year === constants.season.year ? constants.season.week : 0
    for (; week <= finalWeek; week++) {
      player.projection[week] = {}
      player.points[week] = {}
      player.vorp[week] = {}
      player.values[week] = {}
      player.vorp_adj[week] = {}
      player.values_adj[week] = {}

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

  // vorp
  // salary
  // vorp_adj

  const projectionInserts = []
  const pointsInserts = []
  for (const player of players) {
    if (!projectionPlayerIds.includes(player.player)) {
      continue
    }

    for (const [week, projection] of Object.entries(player.projection)) {
      projectionInserts.push({
        player: player.player,
        sourceid: constants.sources.AVERAGE,
        year: constants.season.year,
        timestamp: 0, // must be set at zero for unique key
        week,
        ...projection
      })
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
  }

  if (projectionInserts.length) {
    await db('projections').insert(projectionInserts).onConflict().merge()
    log(`processed and saved ${projectionInserts.length} projections`)
  }

  if (pointsInserts.length) {
    await db('league_player_projection_points')
      .insert(pointsInserts)
      .onConflict()
      .merge()
    log(`processed and saved ${pointsInserts.length} player points`)
  }
}

module.exports = run

const main = async () => {
  let error
  try {
    await run()
  } catch (err) {
    error = err
    console.log(error)
  }

  /* await db('jobs').insert({
   *   type: constants.jobs.PROCESS_PROJECTIONS,
   *   succ: error ? 0 : 1,
   *   reason: error ? error.message : null,
   *   timestamp: Math.round(Date.now() / 1000)
   * })
   */
  process.exit()
}

if (!module.parent) {
  main()
}
