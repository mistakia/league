import debug from 'debug'

import db from '#db'
import { constants, Errors, getFreeAgentPeriod } from '#libs-shared'
import {
  submitAcquisition,
  resetWaiverOrder,
  getTopFreeAgencyWaiver,
  isMain,
  getLeague
} from '#libs-server'

const log = debug('process:waivers:freeagency')
if (process.env.NODE_ENV !== 'test') {
  debug.enable('process:waivers:freeagency')
}

const run = async () => {
  const timestamp = Math.round(Date.now() / 1000)

  if (constants.season.isRegularSeason && constants.season.isWaiverPeriod) {
    return
  }

  // get leagueIds with pending faab waivers
  const results = await db('waivers')
    .whereNull('processed')
    .whereNull('cancelled')
    .where('type', constants.waivers.FREE_AGENCY)
    .groupBy('lid')

  const leagueIds = results.map((w) => w.lid)
  if (!leagueIds.length) {
    throw new Errors.EmptyFreeAgencyWaivers()
  }

  for (const lid of leagueIds) {
    if (!constants.season.isRegularSeason) {
      // check if during free agency period
      const league = await getLeague({ lid })

      if (league.free_agency_live_auction_start) {
        const faPeriod = getFreeAgentPeriod(league)
        if (
          constants.season.now.isBefore(faPeriod.free_agency_live_auction_start)
        ) {
          // skip leagues during offseason before start of free agency auction
          continue
        }
      } else {
        // skip leagues during offseason with no scheduled free agency period
        continue
      }
    }

    let waiver = await getTopFreeAgencyWaiver(lid)
    if (!waiver) {
      log(`no waivers ready to be processed for league ${lid}`)
      continue
    }

    while (waiver) {
      let error
      try {
        const release = await db('waiver_releases')
          .select('pid')
          .where('waiverid', waiver.wid)
        await submitAcquisition({
          release: release.map((r) => r.pid),
          leagueId: lid,
          pid: waiver.pid,
          teamId: waiver.tid,
          bid: waiver.bid,
          userId: waiver.userid,
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
        // reset waiver order if necessary
        const tiedWaivers = await db('waivers')
          .where({
            bid: waiver.bid,
            pid: waiver.pid,
            lid: waiver.lid
          })
          .whereNot('uid', waiver.wid)
          .whereNot('tid', waiver.tid)
          .whereNull('processed')
          .whereNull('cancelled')

        if (tiedWaivers.length) {
          await resetWaiverOrder({ leagueId: waiver.lid, teamId: waiver.tid })
        }

        // update team budget
        if (constants.season.isRegularSeason) {
          await db('teams').decrement('faab', waiver.bid).where({
            uid: waiver.tid,
            year: constants.season.year
          })
        }
      } catch (err) {
        error = err
      }

      await db('waivers')
        .update({
          succ: error ? 0 : 1,
          reason: error ? error.message : null, // TODO - add error codes
          processed: timestamp
        })
        .where('uid', waiver.wid)

      waiver = await getTopFreeAgencyWaiver(lid)
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
    !error ||
    error instanceof Errors.EmptyFreeAgencyWaivers ||
    error instanceof Errors.NotRegularSeason
      ? 1
      : 0
  if (!succ) {
    console.log(error)
  }

  await db('jobs').insert({
    type: constants.jobs.CLAIMS_WAIVERS_ACTIVE,
    succ,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}
