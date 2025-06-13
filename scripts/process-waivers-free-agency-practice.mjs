import debug from 'debug'

import db from '#db'
import { constants, Errors } from '#libs-shared'
import {
  submitAcquisition,
  resetWaiverOrder,
  getTopPracticeSquadWaiver,
  get_super_priority_status,
  process_super_priority,
  is_main,
  report_job
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const log = debug('process:waivers:freeagency')
if (process.env.NODE_ENV !== 'test') {
  debug.enable('process:waivers:freeagency')
}

const run = async ({ daily = false } = {}) => {
  if (constants.season.week > constants.season.finalWeek) {
    log('after final week, practice waivers not run')
    return
  }

  // only run daily waivers during offseason
  if (!constants.season.isRegularSeason && !daily) {
    log('outside of daily waivers during offseason, practice waivers not run')
    return
  }

  const timestamp = Math.round(Date.now() / 1000)

  if (constants.season.isRegularSeason && constants.season.isWaiverPeriod) {
    return
  }

  // get leagueIds with pending practice squad waivers
  const results = await db('waivers')
    .select('lid')
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
        // Check if this is a super priority claim
        if (waiver.super_priority) {
          // Handle super priority claim
          const super_priority_status = await get_super_priority_status({
            pid: waiver.pid,
            lid
          })

          if (
            super_priority_status.eligible &&
            super_priority_status.original_tid === waiver.tid &&
            super_priority_status.super_priority_uid
          ) {
            // Process super priority claim
            await process_super_priority({
              pid: waiver.pid,
              original_tid: waiver.tid,
              lid,
              super_priority_uid: super_priority_status.super_priority_uid,
              userid: waiver.userid
            })

            // Mark waiver as successful
            await db('waivers')
              .update({
                succ: 1,
                processed: timestamp
              })
              .where('uid', waiver.wid)

            log(
              `super priority claim processed for pid: ${waiver.pid}, tid: ${waiver.tid}`
            )

            // Cancel all other pending waivers for this player
            await db('waivers')
              .update({
                succ: false,
                reason: 'Player already claimed by super priority',
                processed: timestamp
              })
              .where('lid', lid)
              .where('pid', waiver.pid)
              .where('type', constants.waivers.FREE_AGENCY_PRACTICE)
              .where('uid', '!=', waiver.wid)
              .whereNull('processed')
              .whereNull('cancelled')
          } else {
            // Super priority not eligible, mark as failed
            await db('waivers')
              .update({
                succ: 0,
                reason: 'super priority not available',
                processed: timestamp
              })
              .where('uid', waiver.wid)

            log(
              `super priority claim failed for pid: ${waiver.pid}, tid: ${waiver.tid}`
            )
          }
        } else {
          // Handle regular practice squad waiver
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

          // Reset waiver order for regular claims only
          await resetWaiverOrder({ teamId: waiver.tid, leagueId: lid })

          // Cancel all other pending waivers for this player
          await db('waivers')
            .update({
              succ: false,
              reason: 'Player already claimed',
              processed: timestamp
            })
            .where('lid', lid)
            .where('pid', waiver.pid)
            .where('type', constants.waivers.FREE_AGENCY_PRACTICE)
            .where('uid', '!=', waiver.wid)
            .whereNull('processed')
            .whereNull('cancelled')
        }
      } catch (err) {
        error = err
      }

      // Only update waiver status if it hasn't been processed yet (super priority claims handle their own status)
      if (!waiver.super_priority) {
        await db('waivers')
          .update({
            succ: error ? 0 : 1,
            reason: error ? error.message : null,
            processed: timestamp
          })
          .where('uid', waiver.wid)
      }

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

  const job_success = Boolean(
    !error || error instanceof Errors.EmptyPracticeSquadFreeAgencyWaivers
  )
  if (!job_success) {
    console.log(error)
  }

  await report_job({
    job_type: job_types.CLAIMS_WAIVERS_PRACTICE,
    job_success,
    job_reason: error ? error.message : null
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}
