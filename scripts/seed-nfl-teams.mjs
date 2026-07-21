import debug from 'debug'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
// import config from '#config'
import { nfl_team_abbreviations } from '#constants'
import { is_main } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('seed-nfl-teams')
debug.enable('seed-nfl-teams')

const seed_nfl_teams = async () => {
  // get all tables with pid columns
  const player_rows_teams = await db('player').whereIn(
    'pid',
    nfl_team_abbreviations
  )

  log(`loaded ${player_rows_teams.length} player rows`)

  const inserts = []

  for (const {
    pid,
    first_name,
    last_name,
    short_name,
    formatted_name,
    current_nfl_team,
    date_of_birth,
    height_inches,
    weight_pounds,
    nfl_draft_year: start,
    jersey_number
  } of player_rows_teams) {
    inserts.push({
      pid: `${pid}-DEF`,
      first_name,
      last_name: `${last_name} Defense`,
      formatted_name: `${formatted_name} defense`,
      short_name,
      primary_position: 'DEF',
      secondary_position: 'DEF',
      current_nfl_team,
      date_of_birth,
      height_inches,
      weight_pounds,
      nfl_draft_year: start,
      jersey_number
    })
    inserts.push({
      pid: `${pid}-OFF`,
      first_name,
      last_name: `${last_name} Offense`,
      formatted_name: `${formatted_name} offense`,
      short_name,
      primary_position: 'OFF',
      secondary_position: 'OFF',
      current_nfl_team,
      date_of_birth,
      height_inches,
      weight_pounds,
      nfl_draft_year: start,
      jersey_number
    })
    inserts.push({
      pid: `${pid}-DST`,
      first_name,
      last_name: `${last_name} Defense and Special Teams`,
      formatted_name: `${formatted_name} defense and special teams`,
      short_name,
      primary_position: 'DST',
      secondary_position: 'DST',
      current_nfl_team,
      date_of_birth,
      height_inches,
      weight_pounds,
      nfl_draft_year: start,
      jersey_number
    })
  }

  if (inserts.length) {
    await db('player').insert(inserts).onConflict(['pid']).ignore()
    log(`inserted ${inserts.length} player rows`)
  }
}

async function main() {
  let error
  try {
    await seed_nfl_teams()
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default seed_nfl_teams
