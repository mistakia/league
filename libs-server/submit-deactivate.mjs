import dayjs from 'dayjs'

import { constants, Roster } from '#libs-shared'
import getLeague from './get-league.mjs'
import getRoster from './get-roster.mjs'
import getTransactionsSinceAcquisition from './get-transactions-since-acquisition.mjs'
import getTransactionsSinceFreeAgent from './get-transactions-since-free-agent.mjs'
import sendNotifications from './send-notifications.mjs'
import db from '#db'

export default async function ({
  tid,
  deactivate_pid,
  leagueId,
  userId,
  roster: existing_roster,
  skip_practice_squad_space_check = false
}) {
  const league = await getLeague({ lid: leagueId })
  if (!league) {
    throw new Error('invalid leagueId')
  }

  const timestamp = Math.round(Date.now() / 1000)

  let roster = existing_roster
  if (!roster) {
    const rosterRow = await getRoster({ tid })
    roster = new Roster({ roster: rosterRow, league })
  }

  // make sure player is on roster
  if (!roster.has(deactivate_pid)) {
    throw new Error('invalid deactivate_pid')
  }

  // make sure player is not on practice squad
  if (roster.practice.find((p) => p.pid === deactivate_pid)) {
    throw new Error('player is already on practice squad')
  }

  const player_rows = await db('player').where('pid', deactivate_pid).limit(1)
  const player_row = player_rows[0]

  const transactionsSinceAcquisition = await getTransactionsSinceAcquisition({
    lid: leagueId,
    tid,
    pid: deactivate_pid
  })
  const sortedTransactions = transactionsSinceAcquisition.sort(
    (a, b) => a.timestamp - b.timestamp
  )
  const lastTransaction = sortedTransactions[sortedTransactions.length - 1]
  const firstTransaction = sortedTransactions[0]
  const isActive = Boolean(roster.active.find((p) => p.pid === deactivate_pid))

  // make sure player has not been on the active roster for more than 48 hours
  const cutoff = dayjs.unix(lastTransaction.timestamp).add('48', 'hours')
  if (isActive && dayjs().isAfter(cutoff)) {
    throw new Error('player has exceeded 48 hours on active roster')
  }

  const transactionsSinceFA = await getTransactionsSinceFreeAgent({
    lid: leagueId,
    pid: deactivate_pid
  })

  // make sure player has not been poached since the last time they were a free agent
  if (
    transactionsSinceFA.find((t) => t.type === constants.transactions.POACHED)
  ) {
    throw new Error('player can not be deactivated once poached')
  }

  // make sure player has not been previously activated since they were a free agent
  if (
    transactionsSinceFA.find(
      (t) => t.type === constants.transactions.ROSTER_ACTIVATE
    )
  ) {
    throw new Error('player can not be deactivated once previously activated')
  }

  // players acquired through market bidding are ineligible
  const acceptable_types = [
    constants.transactions.ROSTER_ADD,
    constants.transactions.PRACTICE_ADD,
    constants.transactions.TRADE,
    constants.transactions.DRAFT
  ]
  if (!acceptable_types.includes(firstTransaction.type)) {
    throw new Error('player is not eligible')
  }

  // if signed through waivers, make sure player had no competing bids
  if (firstTransaction.waiverid) {
    const waivers = await db('waivers').where({
      uid: firstTransaction.waiverid
    })
    const transactionWaiver = waivers[0]

    // search for competing waivers
    if (transactionWaiver) {
      const competingWaivers = await db('waivers')
        .where({
          pid: deactivate_pid,
          processed: transactionWaiver.processed,
          succ: 0,
          type: 1,
          lid: leagueId,
          reason: 'player is not a free agent'
        })
        .whereNot({
          tid: transactionWaiver.tid
        })
      if (competingWaivers.length) {
        throw new Error('player is not eligible, had competing waivers')
      }
    }
  }

  const isDraftedRookie = transactionsSinceAcquisition.find(
    (t) => t.type === constants.transactions.DRAFT
  )

  // make sure team has space on practice squad (unless skipped for combined operations)
  if (!skip_practice_squad_space_check && !isDraftedRookie) {
    if (!roster.hasOpenPracticeSquadSlot()) {
      throw new Error('no available space on practice squad')
    }
  }

  const slot = isDraftedRookie ? constants.slots.PSD : constants.slots.PS

  await db('rosters_players').update({ slot }).where({
    rid: roster.uid,
    pid: deactivate_pid
  })

  await db('league_cutlist').where({ pid: deactivate_pid, tid }).del()

  const transaction = {
    userid: userId,
    tid,
    lid: leagueId,
    pid: deactivate_pid,
    type: constants.transactions.ROSTER_DEACTIVATE,
    value: lastTransaction.value,
    week: constants.season.week,
    year: constants.season.year,
    timestamp
  }
  await db('transactions').insert(transaction)

  const data = {
    pid: deactivate_pid,
    tid,
    slot,
    rid: roster.uid,
    pos: player_row.pos,
    transaction
  }

  const teams = await db('teams').where({
    uid: tid,
    year: constants.season.year
  })
  const team = teams[0]

  const message = `${team.name} (${team.abbrv}) has placed ${player_row.fname} ${player_row.lname} (${player_row.pos}) on the practice squad.`

  await sendNotifications({
    league,
    notifyLeague: true,
    message
  })

  return data
}
