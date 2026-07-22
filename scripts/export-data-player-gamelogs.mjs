import debug from 'debug'
import fs from 'node:fs/promises'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
import { convert_to_csv } from '#libs-shared'
import { is_main } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const data_path = path.join(__dirname, '../data')

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('export-data-player-gamelogs')
debug.enable('export-data-player-gamelogs')

const stat_fields = [
  'passing_attempts',
  'passing_completions',
  'passing_yards',
  'passing_interceptions',
  'passing_touchdowns',
  'rushing_attempts',
  'rushing_yards',
  'rushing_touchdowns',
  'fumbles_lost',
  'targets',
  'receptions',
  'receiving_yards',
  'receiving_touchdowns',
  'two_point_conversions',
  'punt_return_touchdowns',
  'kickoff_return_touchdowns',
  'field_goals_made',
  'field_goal_yards',
  'field_goals_made_0_19_yards',
  'field_goals_made_20_29_yards',
  'field_goals_made_30_39_yards',
  'field_goals_made_40_49_yards',
  'field_goals_made_50_plus_yards',
  'extra_points_made',
  'defensive_sacks',
  'defensive_interceptions',
  'defensive_forced_fumbles',
  'defensive_recovered_fumbles',
  'defensive_three_and_outs',
  'defensive_fourth_down_stops',
  'defensive_points_against',
  'defensive_yards_against',
  'defensive_blocked_kicks',
  'defensive_safeties',
  'defensive_two_point_returns',
  'defensive_touchdowns'
]

const has_any_stat = (gamelog) =>
  stat_fields.some((field) => gamelog[field] && gamelog[field] !== 0)

const format_gamelog = (gamelog) => ({
  esbid: gamelog.esbid,
  pid: gamelog.pid,
  opp: gamelog.opp,
  tm: gamelog.tm,
  pos: gamelog.pos,
  jnum: gamelog.jnum,
  active: gamelog.active,
  started: gamelog.started,
  passing_attempts: gamelog.passing_attempts,
  passing_completions: gamelog.passing_completions,
  passing_yards: gamelog.passing_yards,
  passing_interceptions: gamelog.passing_interceptions,
  passing_touchdowns: gamelog.passing_touchdowns,
  rushing_attempts: gamelog.rushing_attempts,
  rushing_yards: gamelog.rushing_yards,
  rushing_touchdowns: gamelog.rushing_touchdowns,
  fumbles_lost: gamelog.fumbles_lost,
  targets: gamelog.targets,
  receptions: gamelog.receptions,
  receiving_yards: gamelog.receiving_yards,
  receiving_touchdowns: gamelog.receiving_touchdowns,
  two_point_conversions: gamelog.two_point_conversions,
  punt_return_touchdowns: gamelog.punt_return_touchdowns,
  kickoff_return_touchdowns: gamelog.kickoff_return_touchdowns,
  field_goals_made: gamelog.field_goals_made,
  field_goal_yards: gamelog.field_goal_yards,
  field_goals_made_0_19_yards: gamelog.field_goals_made_0_19_yards,
  field_goals_made_20_29_yards: gamelog.field_goals_made_20_29_yards,
  field_goals_made_30_39_yards: gamelog.field_goals_made_30_39_yards,
  field_goals_made_40_49_yards: gamelog.field_goals_made_40_49_yards,
  field_goals_made_50_plus_yards: gamelog.field_goals_made_50_plus_yards,
  extra_points_made: gamelog.extra_points_made,
  defensive_sacks: gamelog.defensive_sacks,
  defensive_interceptions: gamelog.defensive_interceptions,
  defensive_forced_fumbles: gamelog.defensive_forced_fumbles,
  defensive_recovered_fumbles: gamelog.defensive_recovered_fumbles,
  defensive_three_and_outs: gamelog.defensive_three_and_outs,
  defensive_fourth_down_stops: gamelog.defensive_fourth_down_stops,
  defensive_points_against: gamelog.defensive_points_against,
  defensive_yards_against: gamelog.defensive_yards_against,
  defensive_blocked_kicks: gamelog.defensive_blocked_kicks,
  defensive_safeties: gamelog.defensive_safeties,
  defensive_two_point_returns: gamelog.defensive_two_point_returns,
  defensive_touchdowns: gamelog.defensive_touchdowns,
  career_game: gamelog.career_game
})

const export_data_player_gamelogs = async ({ collector = null } = {}) => {
  await db.raw('SET statement_timeout = 0')
  const data = await db('player_gamelogs')
    .select('player_gamelogs.*')
    .orderBy('esbid', 'asc')
    .orderBy('pid', 'asc')

  const header = {}
  for (const field of Object.keys(data[0])) {
    header[field] = field
  }

  const gamelogs_by_year = {}
  for (const item of data) {
    const { year, ...gamelog } = item
    if (!gamelogs_by_year[year]) {
      gamelogs_by_year[year] = []
    }

    if (!has_any_stat(gamelog)) {
      continue
    }

    const formatted_gamelog = format_gamelog(gamelog)
    gamelogs_by_year[year].push(formatted_gamelog)
  }

  for (const year of Object.keys(gamelogs_by_year)) {
    const year_data = gamelogs_by_year[year]
    const year_json_file_path = `${data_path}/nfl/player_gamelogs/${year}.json`
    const year_csv_file_path = `${data_path}/nfl/player_gamelogs/${year}.csv`

    const year_csv_data = [header, ...year_data]
    const year_csv_data_string = JSON.stringify(year_csv_data)
    const year_csv = convert_to_csv(year_csv_data_string)

    await fs.mkdir(`${data_path}/nfl/player_gamelogs`, { recursive: true })
    await fs.writeFile(year_json_file_path, JSON.stringify(year_data, null, 2))
    log(`wrote json to ${year_json_file_path}`)

    await fs.writeFile(year_csv_file_path, year_csv)
    log(`wrote csv to ${year_csv_file_path}`)
  }
}

const main = async () => {
  let error
  try {
    await export_data_player_gamelogs()
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default export_data_player_gamelogs
