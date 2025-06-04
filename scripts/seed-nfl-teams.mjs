import debug from 'debug'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
// import config from '#config'
import { constants } from '#libs-shared'
import { is_main } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('seed-nfl-teams')
debug.enable(
  'seed-nfl-teams,generate-league-format-hash,generate-scoring-format-hash'
)

const seed_nfl_teams = async () => {
  // get all tables with pid columns
  const player_rows_teams = await db('player').whereIn(
    'pid',
    constants.nflTeams
  )

  log(`loaded ${player_rows_teams.length} player rows`)

  const inserts = []

  for (const {
    pid,
    fname,
    lname,
    pname,
    formatted,
    current_nfl_team,
    dob,
    height,
    weight,
    nfl_draft_year: start,
    jnum
  } of player_rows_teams) {
    inserts.push({
      pid: `${pid}-DEF`,
      fname,
      lname: `${lname} Defense`,
      formatted: `${formatted} defense`,
      pname,
      pos: 'DEF',
      pos1: 'DEF',
      current_nfl_team,
      dob,
      height,
      weight,
      nfl_draft_year: start,
      jnum
    })
    inserts.push({
      pid: `${pid}-OFF`,
      fname,
      lname: `${lname} Offense`,
      formatted: `${formatted} offense`,
      pname,
      pos: 'OFF',
      pos1: 'OFF',
      current_nfl_team,
      dob,
      height,
      weight,
      nfl_draft_year: start,
      jnum
    })
    inserts.push({
      pid: `${pid}-DST`,
      fname,
      lname: `${lname} Defense and Special Teams`,
      formatted: `${formatted} defense and special teams`,
      pname,
      pos: 'DST',
      pos1: 'DST',
      current_nfl_team,
      dob,
      height,
      weight,
      nfl_draft_year: start,
      jnum
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
