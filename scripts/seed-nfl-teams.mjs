import debug from 'debug'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
// import config from '#config'
import { constants } from '#libs-shared'
import { isMain } from '#libs-server'

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
    start,
    jnum
  } of player_rows_teams) {
    inserts.push({
      pid: `${pid}_DEF`,
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
      start,
      jnum
    })
  }

  await db('player').insert(inserts)
}

async function main() {
  let error
  try {
    await seed_nfl_teams()
  } catch (err) {
    error = err
    log(error)
  }

  /* await db('jobs').insert({
   *   type: constants.jobs.EXAMPLE,
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

export default seed_nfl_teams
