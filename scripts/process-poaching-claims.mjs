import dayjs from 'dayjs'
import debug from 'debug'

import db from '#db'
import { constants, Errors } from '#libs-shared'
import {
  processPoach,
  sendNotifications,
  getLeague,
  isMain
} from '#libs-server'

const log = debug('process:claims')
if (process.env.NODE_ENV !== 'test') {
  debug.enable('process:claims')
}

const run = async () => {
  const timestamp = Math.round(Date.now() / 1000)

  const { now } = constants.season
  const cutoff = dayjs().subtract('48', 'hours').unix()
  const claims = await db('poaches')
    .where('submitted', '<', cutoff)
    .whereNull('processed')

  if (!claims.length) {
    throw new Errors.EmptyPoachingClaims()
  }

  if (constants.season.isRegularSeason) {
    // check if currently between Saturday 6pm and Tuesday 3pm (EST)
    const start_window = (
      now.day() < 3 ? now.subtract('1', 'week').day(6) : now.day(6)
    )
      .startOf('day')
      .hour(18)
    const end_window = (
      now.day() < 3 ? now.day(2) : now.add('1', 'week').day(2)
    )
      .startOf('day')
      .hour(15)
    if (now.isBetween(start_window, end_window)) {
      // do not process any claims during this window
      return
    }
  }

  for (const claim of claims) {
    let error
    let player_row
    try {
      const player_rows = await db('player').where({ pid: claim.pid }).limit(1)
      player_row = player_rows[0]

      const release = await db('poach_releases')
        .select('pid')
        .where('poachid', claim.uid)

      await processPoach({
        release: release.map((r) => r.pid),
        ...claim
      })
      log(`poaching claim awarded to teamId: (${claim.tid}) for ${claim.pid}`)
    } catch (err) {
      error = err
      log(
        `poaching claim unsuccessful by teamId: (${claim.tid}) because ${error.message}`
      )
      const league = await getLeague({ lid: claim.lid })
      await sendNotifications({
        league,
        teamIds: [claim.tid],
        voice: false,
        notifyLeague: false,
        message: player_row
          ? `Your poaching claim for ${player_row.fname} ${player_row.lname} (${player_row.pos}) was unsuccessful`
          : 'Your poaching claim was unsuccessful.'
      })
    }

    await db('poaches')
      .update('processed', timestamp)
      .update('reason', error ? error.message : null) // TODO - add error codes
      .update('succ', error ? 0 : 1)
      .where({
        pid: claim.pid,
        tid: claim.tid,
        lid: claim.lid
      })
  }
}

export default run

const main = async () => {
  let error
  try {
    await run()
  } catch (err) {
    error = err
  }

  const succ = !error || error instanceof Errors.EmptyPoachingClaims ? 1 : 0
  if (!succ) {
    console.log(error)
  }

  await db('jobs').insert({
    type: constants.jobs.CLAIMS_POACH,
    succ,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}
