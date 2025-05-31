import debug from 'debug'

import db from '#db'
import { constants } from '#libs-shared'
import {
  getTopTransitionBids,
  processTransitionBid,
  is_main,
  resetWaiverOrder,
  report_job
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

const log = debug('process-transition-bids')
debug.enable('process-transition-bids')

const argv = yargs(hideBin(process.argv)).argv

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

const run = async ({ dry_run = false } = {}) => {
  if (dry_run) {
    log('DRY RUN MODE: No database changes will be made')
  }

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

          if (!dry_run) {
            await processTransitionBid(winning_bid)
          } else {
            log(
              `DRY RUN: Would process transition bid for player ${winning_bid.pid} by team ${winning_bid.tid}`
            )
          }

          const { pid } = winning_bid

          if (!dry_run) {
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
            log(
              `DRY RUN: Would mark all other bids for player ${pid} as unsuccessful`
            )
          }
        } else {
          // multiple bids tied with no original team
          log(`tied top bids for league ${lid}`)
          log(transitionBids)

          // Sort bids by waiver order
          const sorted_bids = await sortBidsByWaiverOrder(transitionBids)
          winning_bid = sorted_bids[0]

          log('processing winning transition bid', winning_bid)

          if (!dry_run) {
            await processTransitionBid(winning_bid)
            // Reset waiver order for the winning team
            await resetWaiverOrder({ leagueId: lid, teamId: winning_bid.tid })
          } else {
            log(
              `DRY RUN: Would process winning transition bid for player ${winning_bid.pid} by team ${winning_bid.tid}`
            )
            log(`DRY RUN: Would reset waiver order for team ${winning_bid.tid}`)
          }

          // Update all other bids as unsuccessful
          if (!dry_run) {
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
          } else {
            log(
              `DRY RUN: Would mark all other bids for player ${winning_bid.pid} as unsuccessful`
            )
          }
        }
      } catch (err) {
        error = err
        log(error)
      }

      // save transition bid outcome
      if (!dry_run) {
        await db('transition_bids')
          .update({
            succ: error ? 0 : 1,
            reason: error ? error.message : null, // TODO - use error codes
            processed: timestamp
          })
          .where('uid', winning_bid.uid)
      } else {
        log(
          `DRY RUN: Would update transition bid ${winning_bid.uid} with success=${error ? 'false' : 'true'}`
        )
      }

      if (dry_run) {
        // In dry run mode, manually break the loop after first iteration to avoid showing the same info
        log('DRY RUN: Stopping after first bid to prevent repetitive logging')
        break
      } else {
        transitionBids = await getTopTransitionBids(lid)
      }
    }
  }
}

export default run

const main = async () => {
  debug.enable('process-transition-bids')
  let error
  try {
    const dry_run = argv.dry_run || false
    await run({ dry_run })
  } catch (err) {
    error = err
    console.log(error)
  }

  if (!argv.dry_run) {
    await report_job({
      job_type: job_types.PROCESS_TRANSITION_BIDS,
      error
    })
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}
