import debug from 'debug'
import dayjs from 'dayjs'
import db from '#db'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { constants } from '#libs-shared'
import { isMain, sendNotifications, getLeague } from '#libs-server'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('announce-restricted-free-agent')
debug.enable('announce-restricted-free-agent')

const announce_restricted_free_agent = async ({ lid }) => {
  if (!lid) {
    throw new Error('lid is required')
  }

  const league = await getLeague({ lid })

  if (!league) {
    throw new Error(`League with lid ${lid} not found`)
  }

  if (!league.tran_start) {
    throw new Error(`League with lid ${lid} does not have a tran_start date`)
  }

  const current_date = dayjs().format('YYYY-MM-DD')
  const tran_end_date = dayjs.unix(league.tran_end).format('YYYY-MM-DD')
  if (dayjs(current_date).isAfter(tran_end_date)) {
    throw new Error(
      `The restricted free agency period has ended on ${tran_end_date}`
    )
  }

  const teams = await db('teams')
    .where({ lid, year: constants.season.year })
    .orderBy('draft_order', 'desc')

  const tran_start_date = dayjs.unix(league.tran_start).format('YYYY-MM-DD')
  const days_since_start = dayjs(current_date).diff(
    dayjs(tran_start_date),
    'day'
  )

  const nominating_team = teams[days_since_start % teams.length]

  if (!nominating_team) {
    throw new Error(`No nominating team found for league ${lid}`)
  }

  const transition_bid = await db('transition_bids')
    .where({
      tid: nominating_team.uid,
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
        `Player with pid ${transition_bid.pid} for team ${nominating_team.uid} not found`
      )
    }

    await db('transition_bids')
      .where({ uid: transition_bid.uid })
      .update({ announced: Math.round(Date.now() / 1000) })

    const message = `${nominating_team.name} (${nominating_team.abbrv}) has announced ${player_row.fname} ${player_row.lname} (${player_row.pos}) as a restricted free agent`

    await sendNotifications({
      league,
      notifyLeague: true,
      message
    })

    log(`Notification sent: ${message}`)
  } else {
    log(`No unprocessed nominated player found for team ${nominating_team.uid}`)
  }
}

const main = async () => {
  let error
  try {
    const lid = argv.lid
    await announce_restricted_free_agent({ lid })
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

export default announce_restricted_free_agent
