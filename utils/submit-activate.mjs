import { constants, Roster } from '#common'

import getLeague from './get-league.mjs'
import getRoster from './get-roster.mjs'
import db from '#db'
import sendNotifications from './send-notifications.mjs'

export default async function ({ tid, pid, leagueId, userId }) {
  const league = await getLeague(leagueId)
  if (!league) {
    throw new Error('invalid leagueId')
  }

  const rosterRow = await getRoster({ tid })
  const roster = new Roster({ roster: rosterRow, league })

  // make sure player is on team
  if (!roster.has(pid)) {
    throw new Error('invalid player')
  }

  // make sure player is not on active roster
  if (roster.active.find((p) => p.pid === pid)) {
    throw new Error('player is on active roster')
  }

  // make sure player is not protected
  if (
    roster.players.find((p) => p.pid === pid && p.slot === constants.slots.PSP)
  ) {
    throw new Error('player is protected')
  }

  const player_rows = await db('player')
    .join('transactions', 'player.pid', 'transactions.pid')
    .where('player.pid', pid)
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
    pid
  })

  const transaction = {
    userid: userId,
    tid,
    lid: leagueId,
    pid,
    type: constants.transactions.ROSTER_ACTIVATE,
    value: player_row.value,
    year: constants.season.year,
    timestamp: Math.round(Date.now() / 1000)
  }
  await db('transactions').insert(transaction)

  const data = {
    pid,
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
