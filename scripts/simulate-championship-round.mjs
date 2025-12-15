import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import debug from 'debug'
import dayjs from 'dayjs'
import dayOfYear from 'dayjs/plugin/dayOfYear.js'

import db from '#db'
import { simulate_championship_round } from '#libs-shared'
import { current_season } from '#constants'
import { get_laegue_rosters_from_database, is_main } from '#libs-server'

dayjs.extend(dayOfYear)
const log = debug('simulate-championship-round')
debug.enable('simulate-championship-round')
const timestamp = Math.round(Date.now() / 1000)

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const simulate_championship_round_for_league = async (lid) => {
  if (isNaN(lid)) {
    throw new Error(`missing lid param: ${lid}`)
  }

  const week = current_season.week

  // Get all teams in the league
  const teamRows = await db('teams').where({
    lid,
    year: current_season.year
  })

  // Get playoff data from playoffs table
  const playoffs = await db('playoffs').where({
    lid,
    year: current_season.year
  })

  // Get all team seasonlogs to determine regular_season_finish for known outcomes
  const league_team_seasonlogs = await db('league_team_seasonlogs').where({
    lid,
    year: current_season.year
  })

  // Create lookup for regular_season_finish by tid
  const finish_by_tid = {}
  for (const team of league_team_seasonlogs) {
    finish_by_tid[team.tid] = team.regular_season_finish
  }

  if (!playoffs.length) {
    log(`No playoff data found for lid ${lid} year ${current_season.year}`)
    return
  }

  // Determine championship teams
  // uid 2 = championship round week 16, uid 3 = championship round week 17
  const championship_playoff_entries = playoffs.filter(
    (p) => p.uid === 2 || p.uid === 3
  )

  if (!championship_playoff_entries.length) {
    log(`No championship round entries found for lid ${lid}`)
    return
  }

  // Get unique championship team tids
  const championship_tids = [
    ...new Set(championship_playoff_entries.map((p) => p.tid))
  ]

  if (championship_tids.length !== 4) {
    log(
      `Expected 4 championship teams but found ${championship_tids.length} for lid ${lid}`
    )
    return
  }

  // Get rosters with lineup projections for weeks 16-17
  const rosterRows = await get_laegue_rosters_from_database({
    lid,
    min_week: 16
  })

  const rosters = {}
  for (const row of rosterRows) {
    rosters[row.tid] = row
  }

  // Prepare championship teams array
  const championship_teams = championship_tids.map((tid) => ({ tid }))

  // Get actual week 16 points if we're in week 17
  const week_16_points = {}
  if (week === 17) {
    const week_16_playoffs = playoffs.filter(
      (p) => p.uid === 2 && p.week === 16
    )
    for (const entry of week_16_playoffs) {
      // Use points_manual if available, otherwise points
      week_16_points[entry.tid] = entry.points_manual ?? entry.points ?? 0
    }
    log(`Using actual week 16 points: ${JSON.stringify(week_16_points)}`)
  }

  // Run championship simulation
  const simulation_result = simulate_championship_round({
    championship_teams,
    rosters,
    week,
    week_16_points
  })

  // Get all playoff teams (including eliminated wildcard teams)
  const all_playoff_tids = [...new Set(playoffs.map((p) => p.tid))]

  // Build forecast inserts for all teams in the league
  const forecastInserts = []

  for (const team of teamRows) {
    const tid = team.uid
    const regular_season_finish = finish_by_tid[tid]
    const is_playoff_team = all_playoff_tids.includes(tid)
    const is_championship_team = championship_tids.includes(tid)

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
      championship_odds: is_championship_team
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
    log(
      `saved ${forecastInserts.length} team forecasts for championship round week ${week}`
    )
  }
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const lid = argv.lid || 1
    await simulate_championship_round_for_league(lid)
  } catch (err) {
    error = err
    console.log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default simulate_championship_round_for_league
