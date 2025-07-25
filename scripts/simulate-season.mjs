import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import debug from 'debug'
import dayjs from 'dayjs'
import dayOfYear from 'dayjs/plugin/dayOfYear.js'

import db from '#db'
import { constants, simulate } from '#libs-shared'
import { get_laegue_rosters_from_database, is_main } from '#libs-server'
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

  if (!matchups.length) {
    log(
      `No matchups found for year ${constants.season.year} from week ${currentWeek} on`
    )
    return
  }

  const rosterRows = await get_laegue_rosters_from_database({ lid })
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

  const base_result = simulate({
    teams,
    matchups,
    rosters
  })

  const forecastInserts = []
  for (const [tid, forecast] of Object.entries(base_result)) {
    const { playoff_odds, division_odds, bye_odds, championship_odds } =
      forecast

    const win_result = simulate({
      teams,
      matchups,
      rosters,
      force_win_tid: tid
    })

    const loss_result = simulate({
      teams,
      matchups,
      rosters,
      force_loss_tid: tid
    })

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

      playoff_odds_with_win: win_result[tid].playoff_odds,
      division_odds_with_win: win_result[tid].division_odds,
      bye_odds_with_win: win_result[tid].bye_odds,
      championship_odds_with_win: win_result[tid].championship_odds,

      playoff_odds_with_loss: loss_result[tid].playoff_odds,
      division_odds_with_loss: loss_result[tid].division_odds,
      bye_odds_with_loss: loss_result[tid].bye_odds,
      championship_odds_with_loss: loss_result[tid].championship_odds,

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

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default simulate_season
