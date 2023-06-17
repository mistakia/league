import debug from 'debug'

import db from '#db'
import { constants, Errors } from '#libs-shared'
import {
  submitAcquisition,
  resetWaiverOrder,
  getTopPracticeSquadWaiver,
  isMain
} from '#libs-server'

const log = debug('process:waivers:freeagency')
if (process.env.NODE_ENV !== 'test') {
  debug.enable('process:waivers:freeagency')
}

const run = async () => {
  if (constants.season.week > constants.season.finalWeek) {
    return
  }

  const timestamp = Math.round(Date.now() / 1000)

  if (constants.season.isRegularSeason && constants.season.isWaiverPeriod) {
    return
  }

  // get leagueIds with pending practice squad waivers
  const results = await db('waivers')
    .whereNull('processed')
    .whereNull('cancelled')
    .where('type', constants.waivers.FREE_AGENCY_PRACTICE)
    .groupBy('lid')

  const leagueIds = results.map((w) => w.lid)
  if (!leagueIds.length) {
    throw new Errors.EmptyPracticeSquadFreeAgencyWaivers()
  }

  for (const lid of leagueIds) {
    let waiver = await getTopPracticeSquadWaiver(lid)
    if (!waiver) {
      log(`no waivers ready to be processed for league ${lid}`)
      continue
    }

    while (waiver) {
      let error
      try {
        let value = 0
        if (!constants.season.isRegularSeason) {
          const transactions = await db('transactions').where({
            lid,
            type: constants.transactions.DRAFT,
            year: constants.season.year,
            pid: waiver.pid
          })

          if (transactions.length) {
            value = transactions[0].value
          }
        }

        const release = await db('waiver_releases')
          .select('pid')
          .where('waiverid', waiver.wid)

        await submitAcquisition({
          release: release.map((r) => r.pid),
          leagueId: lid,
          pid: waiver.pid,
          teamId: waiver.tid,
          bid: value,
          userId: waiver.userid,
          slot: constants.slots.PS,
          waiverId: waiver.wid
        })

        // cancel any outstanding waivers with the same release player
        /* if (release.length) {
         *   await db('waivers')
         *     .update({
         *       succ: 0,
         *       reason: 'invalid release',
         *       processed: timestamp
         *     })
         *     .join('waiver_releases', 'waiver_releases.waiverid', 'waviers.uid')
         *     .whereNull('processed')
         *     .whereNull('cancelled')
         *     .where('tid', waiver.tid)
         *     .whereIn('waiver_releases', release)
         * }
         */
        await resetWaiverOrder({ leagueId: waiver.lid, teamId: waiver.tid })
      } catch (err) {
        error = err
      }

      await db('waivers')
        .update({
          succ: error ? 0 : 1,
          reason: error ? error.message : null,
          processed: timestamp
        })
        .where('uid', waiver.wid)

      waiver = await getTopPracticeSquadWaiver(lid)
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

  const succ =
    !error || error instanceof Errors.EmptyPracticeSquadFreeAgencyWaivers
      ? 1
      : 0
  if (!succ) {
    console.log(error)
  }

  await db('jobs').insert({
    type: constants.jobs.CLAIMS_WAIVERS_PRACTICE,
    succ,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}
