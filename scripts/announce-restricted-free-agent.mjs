import debug from 'debug'
import db from '#db'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { constants } from '#libs-shared'
import { isMain, sendNotifications, getLeague } from '#libs-server'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('template')
debug.enable('template')

const script = async ({ tid, lid }) => {
  if (!tid) {
    throw new Error('tid is required')
  }

  if (!lid) {
    throw new Error('lid is required')
  }

  const league = await getLeague({ lid })

  if (!league) {
    throw new Error(`League with lid ${lid} not found`)
  }

  const transition_bid = await db('transition_bids')
    .where({
      tid,
      lid,
      year: constants.season.year
    })
    .whereNull('cancelled')
    .whereNull('processed')
    .whereNull('announced')
    .whereNotNull('nominated')
    .first()

  if (transition_bid) {
    const player_row = await db('player')
      .where({ pid: transition_bid.pid })
      .first()

    if (!player_row) {
      throw new Error(
        `Player with pid ${transition_bid.pid} for team ${tid} not found`
      )
    }

    const team = await db('teams')
      .where({ uid: tid, year: constants.season.year })
      .first()

    if (!team) {
      throw new Error(`Team with tid ${tid} not found`)
    }

    await db('transition_bids')
      .where({ uid: transition_bid.uid })
      .update({ announced: Math.round(Date.now() / 1000) })

    const message = `${team.name} (${team.abbrv}) has announced ${player_row.fname} ${player_row.lname} (${player_row.pos}) as a restricted free agent`

    await sendNotifications({
      league,
      notifyLeague: true,
      message
    })

    log(`Notification sent: ${message}`)
  } else {
    log(`No unprocessed nominated player found for team ${tid}`)
  }
}

const main = async () => {
  let error
  try {
    const tid = argv.tid
    const lid = argv.lid
    await script({ tid, lid })
  } catch (err) {
    error = err
    log(error)
  }

  // await db('jobs').insert({
  //   type: constants.jobs.EXAMPLE,
  //   succ: error ? 0 : 1,
  //   reason: error ? error.message : null,
  //   timestamp: Math.round(Date.now() / 1000)
  // })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default script
