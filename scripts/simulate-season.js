// eslint-disable-next-line
require = require('esm')(module /*, options*/)
const debug = require('debug')
const dayjs = require('dayjs')
const dayOfYear = require('dayjs/plugin/dayOfYear')
// const argv = require('yargs').argv

const db = require('../db')
const { constants, simulate } = require('../common')
const { getRosters } = require('../utils')

dayjs.extend(dayOfYear)
const log = debug('simulate-season')
debug.enable('simulate-season')

const timestamp = Math.round(Date.now() / 1000)

const run = async () => {
  const leagueId = 1
  const currentWeek = Math.max(constants.season.week, 1)
  const teamRows = await db('teams').where({ lid: leagueId })
  const matchups = await db('matchups')
    .where({ lid: leagueId })
    .where('week', '>=', currentWeek)
  const rosterRows = await getRosters({ lid: leagueId })
  const tids = teamRows.map((t) => t.uid)
  const teamStats = await db('team_stats')
    .where('year', constants.season.year)
    .whereIn('tid', tids)

  const rosters = {}
  for (const row of rosterRows) {
    rosters[row.tid] = row
  }

  const teams = {}
  for (const row of teamRows) {
    teams[row.uid] = row
    teams[row.uid].stats =
      teamStats.find((t) => t.tid === row.uid) ||
      constants.createFantasyTeamStats()
  }

  const result = simulate({
    teams,
    matchups,
    rosters
  })

  const forecastInserts = []
  for (const forecast of Object.values(result)) {
    const { playoff_odds, division_odds, bye_odds, tid } = forecast
    forecastInserts.push({
      tid,
      lid: leagueId,

      week: constants.season.week,
      year: constants.season.year,
      day: dayjs().dayOfYear(),

      playoff_odds,
      division_odds,
      bye_odds,

      timestamp
    })
  }

  if (forecastInserts.length) {
    await db('league_team_forecast')
      .insert(forecastInserts)
      .onConflict()
      .merge()
    log(`saved ${forecastInserts.length} team forecasts`)
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
   *   type: constants.jobs.SIMULATE_SEASON,
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
