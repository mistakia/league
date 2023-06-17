import debug from 'debug'

import { constants, Errors } from '#libs-shared'
import {
  sendNotifications,
  submitPoach,
  resetWaiverOrder,
  getTopPoachingWaiver,
  getLeague,
  isMain
} from '#libs-server'
import db from '#db'

const log = debug('process:waivers:poach')
if (process.env.NODE_ENV !== 'test') {
  debug.enable('process:waivers:poach')
}

const run = async () => {
  const timestamp = Math.round(Date.now() / 1000)

  // get leagueIds with pending waivers
  const results = await db('waivers')
    .whereNull('processed')
    .whereNull('cancelled')
    .where('type', constants.waivers.POACH)
    .groupBy('lid')

  const leagueIds = results.map((w) => w.lid)

  if (!leagueIds.length) {
    throw new Errors.EmptyPoachingWaivers()
  }

  for (const lid of leagueIds) {
    let waiver = await getTopPoachingWaiver(lid)
    if (!waiver) {
      log(`no waivers ready to be processed for league ${lid}`)
      continue
    }

    while (waiver) {
      let error

      try {
        const release = await db('waiver_releases')
          .select('pid')
          .where('waiverid', waiver.uid)
        await submitPoach({
          release: release.map((r) => r.pid),
          leagueId: waiver.lid,
          userId: waiver.userid,
          pid: waiver.pid,
          teamId: waiver.tid,
          team: waiver
        })

        log(
          `poaching waiver awarded to ${waiver.name} (${waiver.tid}) for ${waiver.pid}`
        )

        await resetWaiverOrder({ leagueId: waiver.lid, teamId: waiver.tid })
      } catch (err) {
        error = err
        log(
          `poaching waiver unsuccessful for ${waiver.name} (${waiver.tid}) because ${error.message}`
        )
        const player_rows = await db('player').where('pid', waiver.pid).limit(1)
        const player_row = player_rows[0]
        const league = await getLeague({ lid: waiver.lid })
        await sendNotifications({
          league,
          teamIds: [waiver.tid],
          voice: false,
          notifyLeague: false,
          message: `Your waiver claim to poach ${player_row.fname} ${player_row.lname} was unsuccessful.`
        })
      }

      await db('waivers')
        .update({
          succ: error ? 0 : 1,
          reason: error ? error.message : null, // TODO - add error codes
          processed: timestamp
        })
        .where('uid', waiver.wid)

      waiver = await getTopPoachingWaiver(lid)
    }
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

  const succ = !error || error instanceof Errors.EmptyPoachingWaivers ? 1 : 0
  if (!succ) {
    console.log(error)
  }

  await db('jobs').insert({
    type: constants.jobs.CLAIMS_WAIVERS_POACH,
    succ,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}
