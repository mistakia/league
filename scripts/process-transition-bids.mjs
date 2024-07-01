import debug from 'debug'

import db from '#db'
import { constants } from '#libs-shared'
import {
  getTopTransitionBids,
  processTransitionBid,
  isMain
} from '#libs-server'

const log = debug('process-transition-bids')
debug.enable('process-transition-bids')

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
    .whereNotNull('tran_end')
    .where('tran_end', '<=', timestamp)
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
      const transitionBid = originalTeamBid || transitionBids[0]

      try {
        if (originalTeamBid || transitionBids.length === 1) {
          log('processing transition bid', transitionBid)
          await processTransitionBid(transitionBid)

          const { pid } = transitionBid
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
            .whereNot('uid', transitionBid.uid)
        } else {
          // multiple bids tied with no original team
          log(`tied top bids for league ${lid}`)
          log(transitionBids)
          break
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
        .where('uid', transitionBid.uid)

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

  await db('jobs').insert({
    type: constants.jobs.PROCESS_TRANSITION_BIDS,
    succ: error ? 0 : 1,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}
