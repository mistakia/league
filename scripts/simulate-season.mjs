import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import debug from 'debug'
import dayjs from 'dayjs'
import dayOfYear from 'dayjs/plugin/dayOfYear.js'

import db from '#db'
import { constants, simulate } from '#libs-shared'
import { getRosters, isMain } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

dayjs.extend(dayOfYear)
const log = debug('simulate-season')
debug.enable('simulate-season')
const timestamp = Math.round(Date.now() / 1000)
const argv = yargs(hideBin(process.argv)).argv

const simulate_season = async (lid) => {
  if (isNaN(lid)) {
    throw new Error(`missing lid param: ${lid}`)
  }
  const currentWeek = Math.max(constants.season.week, 1)
  const teamRows = await db('teams').where({
    lid,
    year: constants.season.year
  })
  const matchups = await db('matchups')
    .where({ lid, year: constants.season.year })
    .where('week', '>=', currentWeek)
  const rosterRows = await getRosters({ lid })
  const tids = teamRows.map((t) => t.uid)
  const teamStats = await db('league_team_seasonlogs')
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
    const { playoff_odds, division_odds, bye_odds, championship_odds, tid } =
      forecast
    forecastInserts.push({
      tid,
      lid,

      week: constants.season.week,
      year: constants.season.year,
      day: dayjs().dayOfYear(),

      playoff_odds,
      division_odds,
      bye_odds,
      championship_odds,

      timestamp
    })
  }

  if (forecastInserts.length) {
    await db('league_team_forecast')
      .insert(forecastInserts)
      .onConflict(['tid', 'year', 'week', 'day'])
      .merge()
    log(`saved ${forecastInserts.length} team forecasts`)
  }
}

const main = async () => {
  let error
  try {
    const lid = argv.lid || 1
    await simulate_season(lid)
  } catch (err) {
    error = err
    console.log(error)
  }

  /* await db('jobs').insert({
   *   type: job_types.SIMULATE_SEASON,
   *   succ: error ? 0 : 1,
   *   reason: error ? error.message : null,
   *   timestamp: Math.round(Date.now() / 1000)
   * })
   */
  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default simulate_season
