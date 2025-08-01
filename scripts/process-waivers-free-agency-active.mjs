import debug from 'debug'

import db from '#db'
import { constants, Errors, get_free_agent_period } from '#libs-shared'
import {
  submitAcquisition,
  resetWaiverOrder,
  getTopFreeAgencyWaiver,
  is_main,
  getLeague,
  report_job
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const log = debug('process:waivers:freeagency')
if (process.env.NODE_ENV !== 'test') {
  debug.enable('process:waivers:freeagency')
}

const run = async ({ daily = false } = {}) => {
  const timestamp = Math.round(Date.now() / 1000)

  // only run outside of regular season waiver period
  if (constants.season.isRegularSeason && constants.season.isWaiverPeriod) {
    log('during regular season waiver period, active waivers not run')
    return
  }

  // only run daily waivers during offseason
  if (!constants.season.isRegularSeason && !daily) {
    log('outside of daily waivers during offseason, active waivers not run')
    return
  }

  // get leagueIds with pending faab waivers
  const results = await db('waivers')
    .select('lid')
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
        const faPeriod = get_free_agent_period(league)
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

        // cancel any other pending waivers for this player
        await db('waivers')
          .update({
            succ: 0,
            reason: 'Player already claimed',
            processed: timestamp
          })
          .where('lid', lid)
          .where('pid', waiver.pid)
          .where('uid', '!=', waiver.wid)
          .whereNull('processed')
          .whereNull('cancelled')
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

  const job_success = Boolean(
    !error ||
      error instanceof Errors.EmptyFreeAgencyWaivers ||
      error instanceof Errors.NotRegularSeason
  )
  if (!job_success) {
    console.log(error)
  }

  await report_job({
    job_type: job_types.CLAIMS_WAIVERS_ACTIVE,
    job_success,
    job_reason: error ? error.message : null
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}
