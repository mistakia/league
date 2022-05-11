import dayjs from 'dayjs'
import debug from 'debug'

import db from '#db'
import { constants, Errors } from '#common'
import { processPoach, sendNotifications, getLeague, isMain } from '#utils'

const log = debug('process:claims')
if (process.env.NODE_ENV !== 'test') {
  debug.enable('process:claims')
}

const run = async () => {
  const timestamp = Math.round(Date.now() / 1000)

  const cutoff = dayjs().subtract('48', 'hours').unix()
  const claims = await db('poaches')
    .where('submitted', '<', cutoff)
    .whereNull('processed')

  if (!claims.length) {
    throw new Errors.EmptyPoachingClaims()
  }

  for (const claim of claims) {
    let error
    let player
    try {
      const players = await db('player')
        .where({ player: claim.player })
        .limit(1)
      player = players[0]

      const release = await db('poach_releases')
        .select('player')
        .where('poachid', claim.uid)

      await processPoach({
        release: release.map((r) => r.player),
        ...claim
      })
      log(
        `poaching claim awarded to teamId: (${claim.tid}) for ${claim.player}`
      )
    } catch (err) {
      error = err
      log(
        `poaching claim unsuccessful by teamId: (${claim.tid}) because ${error.message}`
      )
      const league = await getLeague(claim.lid)
      await sendNotifications({
        league,
        teamIds: [claim.tid],
        voice: false,
        notifyLeague: false,
        message: player
          ? `Your poaching claim for ${player.fname} ${player.lname} (${player.pos}) was unsuccessful`
          : 'Your poaching claim was unsuccessful.'
      })
    }

    await db('poaches')
      .update('processed', timestamp)
      .update('reason', error ? error.message : null) // TODO - add error codes
      .update('succ', error ? 0 : 1)
      .where({
        player: claim.player,
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

if (isMain()) {
  main()
}
