import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#common'
import { isMain, getRoster, processRelease } from '#utils'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('decommission-team')
debug.enable('decommission-team')

const decommission_team = async ({ year = constants.season.year, team_id }) => {
  if (!team_id) {
    throw new Error('missing team_id')
  }

  log(`decommissioning team ${team_id} for year ${year}`)

  // get leagueId from teamId
  const team = await db('teams').where({ uid: team_id, year }).first()

  if (!team) {
    throw new Error('team not found')
  }

  const leagueId = team.lid

  // release all players
  const roster = await getRoster({ tid: team_id, year })
  for (const player of roster.players) {
    // TODO - unprotect any protected players

    const params = {
      tid: team_id,
      release_pid: player.pid,
      userid: 0,
      lid: leagueId,
      create_notification: true
    }
    await processRelease(params)
  }

  // nullify all picks owned by team
  await db('draft').where({ tid: team_id, year }).del()

  // remove team from teams table
  await db('teams').where({ uid: team_id, year }).del()

  // remove team roster from rosters table
  await db('rosters').where({ tid: team_id, year, lid: leagueId }).del()
}
const main = async () => {
  let error
  try {
    await decommission_team({ team_id: argv.tid, year: argv.year })
  } catch (err) {
    error = err
    log(error)
  }

  // await db('jobs').insert({
  //   type: constants.jobs.EXAMPLE,
  //   succ: error ? 0 : 1,
  //   reason: error ? error.message : null,
  //   timestamp: Math.round(Date.now() / 1000)
  // })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default decommission_team
