import { constants, Roster } from '#common'

import getLeague from './get-league.mjs'
import getRoster from './get-roster.mjs'
import db from '#db'
import sendNotifications from './send-notifications.mjs'

export default async function ({ tid, activate_pid, leagueId, userId }) {
  const league = await getLeague({ lid: leagueId })
  if (!league) {
    throw new Error('invalid leagueId')
  }

  const timestamp = Math.round(Date.now() / 1000)

  const rosterRow = await getRoster({ tid })
  const roster = new Roster({ roster: rosterRow, league })

  // make sure player is on team
  if (!roster.has(activate_pid)) {
    throw new Error('invalid player')
  }

  // make sure player is not on active roster
  if (roster.active.find((p) => p.pid === activate_pid)) {
    throw new Error('player is on active roster')
  }

  // make sure player is not protected
  if (
    roster.players.find(
      (p) =>
        p.pid === activate_pid &&
        (p.slot === constants.slots.PSP || p.slot === constants.slots.PSDP)
    )
  ) {
    throw new Error('player is protected')
  }

  const player_rows = await db('player')
    .join('transactions', 'player.pid', 'transactions.pid')
    .where('player.pid', activate_pid)
    .where({
      lid: leagueId,
      tid
    })
    .orderBy('transactions.timestamp', 'desc')
  const player_row = player_rows[0]

  // make sure team has space on active roster
  if (!roster.hasOpenBenchSlot(player_row.pos)) {
    throw new Error('no available space on active roster')
  }

  await db('rosters_players').update({ slot: constants.slots.BENCH }).where({
    rid: rosterRow.uid,
    pid: activate_pid
  })

  const transaction = {
    userid: userId,
    tid,
    lid: leagueId,
    pid: activate_pid,
    type: constants.transactions.ROSTER_ACTIVATE,
    value: player_row.value,
    week: constants.season.week,
    year: constants.season.year,
    timestamp
  }
  await db('transactions').insert(transaction)

  // clear any pending poaching claims for player
  await db('poaches')
    .update({
      succ: 0,
      processed: timestamp,
      reason: 'player is not on a practice squad' // TODO use constant
    })
    .where({
      lid: leagueId,
      pid: activate_pid
    })
    .whereNull('processed')

  const data = {
    pid: activate_pid,
    tid,
    slot: constants.slots.BENCH,
    rid: roster.uid,
    pos: player_row.pos,
    transaction
  }

  const teams = await db('teams').where({ uid: tid })
  const team = teams[0]

  const message = `${team.name} (${team.abbrv}) has activated ${player_row.fname} ${player_row.lname} (${player_row.pos}).`

  await sendNotifications({
    league,
    notifyLeague: true,
    message
  })

  return data
}
