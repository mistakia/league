import debug from 'debug'

import db from '#db'
import { constants } from '#libs-shared'
import {
  getTopTransitionBids,
  processTransitionBid,
  isMain,
  resetWaiverOrder,
  report_job
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const log = debug('process-transition-bids')
debug.enable('process-transition-bids')

async function sortBidsByWaiverOrder(bids) {
  const teams = await db('teams').select('uid', 'waiver_order').where({
    lid: bids[0].lid,
    year: constants.season.year
  })

  const team_waiver_order = {}
  for (const team of teams) {
    team_waiver_order[team.uid] = team.waiver_order
  }

  return bids.sort(
    (a, b) => team_waiver_order[a.tid] - team_waiver_order[b.tid]
  )
}

const run = async () => {
  const timestamp = Math.round(Date.now() / 1000)

  // get leagues past tran date cutoff with bids pending processing
  const leagues = await db('transition_bids')
    .select('transition_bids.lid')
    .join('seasons', function () {
      this.on('transition_bids.lid', 'seasons.lid').on(
        'transition_bids.year',
        'seasons.year'
      )
    })
    .whereNotNull('tran_start')
    .where('tran_start', '<=', timestamp)
    .where('transition_bids.year', constants.season.year)
    .groupBy('transition_bids.lid')
    .whereNull('processed')
    .whereNull('cancelled')

  const lids = leagues.map((l) => l.lid)

  for (const lid of lids) {
    let transitionBids = await getTopTransitionBids(lid)
    if (!transitionBids) {
      log(`no bids ready to be processed for league ${lid}`)
      continue
    }

    while (transitionBids.length) {
      let error
      const originalTeamBid = transitionBids.find((t) => t.player_tid === t.tid)
      let winning_bid = originalTeamBid || transitionBids[0]

      try {
        if (originalTeamBid || transitionBids.length === 1) {
          log('processing transition bid', winning_bid)
          await processTransitionBid(winning_bid)

          const { pid } = winning_bid
          await db('transition_bids')
            .update({
              succ: 0,
              reason: 'player no longer a restricted free agent',
              processed: timestamp
            })
            .where({
              pid,
              lid,
              year: constants.season.year
            })
            .whereNull('cancelled')
            .whereNull('processed')
            .whereNot('uid', winning_bid.uid)
        } else {
          // multiple bids tied with no original team
          log(`tied top bids for league ${lid}`)
          log(transitionBids)

          // Sort bids by waiver order
          const sorted_bids = await sortBidsByWaiverOrder(transitionBids)
          winning_bid = sorted_bids[0]

          log('processing winning transition bid', winning_bid)
          await processTransitionBid(winning_bid)

          // Reset waiver order for the winning team
          await resetWaiverOrder({ leagueId: lid, teamId: winning_bid.tid })

          // Update all other bids as unsuccessful
          await db('transition_bids')
            .update({
              succ: 0,
              reason: 'player no longer a restricted free agent',
              processed: timestamp
            })
            .where({
              pid: winning_bid.pid,
              lid,
              year: constants.season.year
            })
            .whereNull('cancelled')
            .whereNull('processed')
            .whereNot('uid', winning_bid.uid)
        }
      } catch (err) {
        error = err
        log(error)
      }

      // save transition bid outcome
      await db('transition_bids')
        .update({
          succ: error ? 0 : 1,
          reason: error ? error.message : null, // TODO - use error codes
          processed: timestamp
        })
        .where('uid', winning_bid.uid)

      transitionBids = await getTopTransitionBids(lid)
    }
  }
}

export default run

const main = async () => {
  debug.enable('process-transition-bids')
  let error
  try {
    await run()
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.PROCESS_TRANSITION_BIDS,
    error
  })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}
