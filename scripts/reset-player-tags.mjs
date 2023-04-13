import debug from 'debug'
import dayjs from 'dayjs'

import db from '#db'
import { constants } from '#common'
import { getLeague, isMain } from '#utils'

const log = debug('reset-player-tags')

const run = async () => {
  const lid = 1
  const league = await getLeague({ lid })

  // past transition deadline
  if (
    !league.tran_start ||
    constants.season.now.isBefore(dayjs.unix(league.tran_start))
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
    .join('rosters', 'rosters.uid', 'rosters_players.rid')
    .where({
      week: 0,
      year: constants.season.year
    })

  log(`updated ${rowCount} roster slots`)
}

const main = async () => {
  debug.enable('reset-player-tags')

  let error
  try {
    await run()
  } catch (err) {
    error = err
    console.log(error)
  }

  /* await db('jobs').insert({
   *   type: constants.jobs.RESET_PLAYER_TAGS,
   *   succ: error ? 0 : 1,
   *   reason: error ? error.message : null,
   *   timestamp: Math.round(Date.now() / 1000)
   * })
   */
  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default run
