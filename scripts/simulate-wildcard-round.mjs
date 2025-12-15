import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import debug from 'debug'
import dayjs from 'dayjs'
import dayOfYear from 'dayjs/plugin/dayOfYear.js'

import db from '#db'
import { simulate_wildcard_round } from '#libs-shared'
import { current_season } from '#constants'
import { get_laegue_rosters_from_database, is_main } from '#libs-server'

dayjs.extend(dayOfYear)
const log = debug('simulate-wildcard-round')
debug.enable('simulate-wildcard-round')
const timestamp = Math.round(Date.now() / 1000)

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const simulate_wildcard_round_for_league = async (lid) => {
  if (isNaN(lid)) {
    throw new Error(`missing lid param: ${lid}`)
  }

  // Get all teams in the league
  const teamRows = await db('teams').where({
    lid,
    year: current_season.year
  })

  // Get all team seasonlogs to determine regular_season_finish
  const league_team_seasonlogs = await db('league_team_seasonlogs').where({
    lid,
    year: current_season.year
  })

  // Filter to playoff teams (regular_season_finish 1-6)
  const playoff_team_seasonlogs = league_team_seasonlogs.filter((t) =>
    [1, 2, 3, 4, 5, 6].includes(t.regular_season_finish)
  )

  if (playoff_team_seasonlogs.length !== 6) {
    log(
      `Expected 6 playoff teams but found ${playoff_team_seasonlogs.length} for lid ${lid}`
    )
    return
  }

  // Get rosters with lineup projections for weeks 15-17
  const rosterRows = await get_laegue_rosters_from_database({
    lid,
    min_week: 15
  })

  const rosters = {}
  for (const row of rosterRows) {
    rosters[row.tid] = row
  }

  // Prepare playoff teams array
  const playoff_teams = playoff_team_seasonlogs.map((team) => ({
    tid: team.tid,
    regular_season_finish: team.regular_season_finish
  }))

  // Create lookup for regular_season_finish by tid
  const finish_by_tid = {}
  for (const team of league_team_seasonlogs) {
    finish_by_tid[team.tid] = team.regular_season_finish
  }

  // Run wildcard simulation
  const simulation_result = simulate_wildcard_round({
    playoff_teams,
    rosters
  })

  // Build forecast inserts for all teams in the league
  const forecastInserts = []
  const playoff_tids = playoff_teams.map((t) => t.tid)

  for (const team of teamRows) {
    const tid = team.uid
    const regular_season_finish = finish_by_tid[tid]
    const is_playoff_team = playoff_tids.includes(tid)

    // During playoffs, these are known outcomes based on regular_season_finish:
    // - playoff_odds: 1.0 for finish 1-6, 0.0 for others
    // - division_odds: 1.0 for finish 1-2 (division winners), 0.0 for others
    // - bye_odds: 1.0 for finish 1-2 (bye teams), 0.0 for others
    const is_division_winner = [1, 2].includes(regular_season_finish)

    forecastInserts.push({
      tid,
      lid,
      week: current_season.week,
      year: current_season.year,
      day: dayjs().dayOfYear(),
      playoff_odds: is_playoff_team ? 1.0 : 0.0,
      division_odds: is_division_winner ? 1.0 : 0.0,
      bye_odds: is_division_winner ? 1.0 : 0.0,
      championship_odds: is_playoff_team
        ? simulation_result[tid].championship_odds
        : 0,
      timestamp
    })
  }

  if (forecastInserts.length) {
    await db('league_team_forecast')
      .insert(forecastInserts)
      .onConflict(['tid', 'year', 'week', 'day'])
      .merge()
    log(`saved ${forecastInserts.length} team forecasts for wildcard round`)
  }
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const lid = argv.lid || 1
    await simulate_wildcard_round_for_league(lid)
  } catch (err) {
    error = err
    console.log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default simulate_wildcard_round_for_league
