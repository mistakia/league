import debug from 'debug'
import dayjs from 'dayjs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#libs-shared'
import { getLeague, is_main } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

const log = debug('reset-player-transition-tags')
const argv = yargs(hideBin(process.argv)).argv

const run = async ({ force = false } = {}) => {
  const lid = 1
  const league = await getLeague({ lid })

  // past transition deadline
  if (
    !force &&
    (!league.tran_start ||
      constants.season.now.isBefore(dayjs.unix(league.tran_start)))
  ) {
    log('aborted, before transition deadline')
    return
  }

  // no transition bids outstanding
  const transitionBids = await db('transition_bids')
    .where({
      year: constants.season.year,
      lid
    })
    .whereNull('cancelled')
    .whereNull('processed')

  if (transitionBids.length) {
    log('aborted, outstanding transition bids')
    return
  }

  // reset tags for current rosters
  const rowCount = await db('rosters_players')
    .update({ tag: constants.tags.REGULAR })
    .where({
      tag: constants.tags.TRANSITION,
      week: 0,
      year: constants.season.year
    })

  log(`updated ${rowCount} roster slots`)
}

const main = async () => {
  debug.enable('reset-player-transition-tags')

  let error
  try {
    await run({ force: argv.force })
  } catch (err) {
    error = err
    console.log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
