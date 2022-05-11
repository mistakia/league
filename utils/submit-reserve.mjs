import {
  constants,
  Roster,
  isReserveCovEligible,
  isReserveEligible
} from '#common'
import getLeague from './get-league.mjs'
import getRoster from './get-roster.mjs'
import db from '#db'
import sendNotifications from './send-notifications.mjs'
import getAcquisitionTransaction from './get-acquisition-transaction.mjs'
import isPlayerLocked from './is-player-locked.mjs'
import getLastTransaction from './get-last-transaction.mjs'

export default async function ({
  slot,
  tid,
  player,
  leagueId,
  userId,
  activate
}) {
  const data = []

  const slots = [constants.slots.IR, constants.slots.COV]
  if (!slots.includes(slot)) {
    throw new Error('invalid slot')
  }

  const players = await db('player').where('player', player)
  const playerRow = players[0]

  if (!playerRow) {
    throw new Error('invalid player')
  }

  // make sure player is on active roster
  const league = await getLeague(leagueId)
  if (!league) {
    throw new Error('invalid leagueId')
  }
  const rosterRow = await getRoster({ tid })
  const roster = new Roster({ roster: rosterRow, league })
  const rosterPlayer = roster.get(player)
  if (!rosterPlayer) {
    throw new Error('player not on roster')
  }

  if (rosterPlayer.slot === slot) {
    throw new Error('player already on reserve')
  }

  // make sure player is not protected
  if (rosterPlayer.slot === constants.slots.PSP) {
    throw new Error('protected players are not reserve eligible')
  }

  // make sure player is reserve eligible
  if (slot === constants.slots.COV) {
    if (constants.season.week === 0) {
      throw new Error(
        'player is not eligible for Reserve/COV during the Offseason'
      )
    }

    if (!isReserveCovEligible(playerRow)) {
      throw new Error('player not eligible for Reserve/COV')
    }
  } else {
    if (!isReserveEligible(playerRow)) {
      throw new Error('player not eligible for Reserve')
    }
  }

  // make sure player was on previous week roster, unless acquired via a trade
  const prevRosterRow = await getRoster({
    tid,
    week: Math.max(constants.season.week - 1, 0),
    year: constants.season.year
  })
  const prevRoster = new Roster({ roster: prevRosterRow, league })
  const acquisitionTransaction = await getAcquisitionTransaction({
    lid: leagueId,
    player,
    tid
  })
  if (
    acquisitionTransaction.type !== constants.transactions.TRADE &&
    !prevRoster.has(player)
  ) {
    throw new Error('not eligible, not rostered long enough')
  }

  // verify player is not locked and is a starter
  const isLocked = await isPlayerLocked(player)
  const isStarter = Boolean(roster.starters.find((p) => p.player === player))
  if (isLocked && isStarter) {
    throw new Error('not eligible, locked starter')
  }

  let activatePlayerRow
  if (activate) {
    const players = await db('player').where('player', activate)
    activatePlayerRow = players[0]

    // make sure player is on team
    if (!roster.has(activate)) {
      throw new Error('invalid player')
    }

    // make sure player is not on active roster
    if (roster.active.find((p) => p.player === activate)) {
      throw new Error('player is on active roster')
    }

    // make sure player is on reserve
    if (
      roster.players.find(
        (p) => p.player === activate && p.slot !== constants.slots.IR
      )
    ) {
      throw new Error('player is not on reserve')
    }

    roster.removePlayer(player)
    if (!roster.hasOpenBenchSlot(activatePlayerRow.pos)) {
      throw new Error('exceeds roster limits')
    }

    // activate player
    await db('rosters_players').update({ slot: constants.slots.BENCH }).where({
      rid: rosterRow.uid,
      player: activate
    })

    const { value } = await getLastTransaction({
      player: activate,
      lid: leagueId,
      tid
    })
    const transaction = {
      userid: userId,
      tid,
      lid: leagueId,
      player: activate,
      type: constants.transactions.ROSTER_ACTIVATE,
      value,
      year: constants.season.year,
      timestamp: Math.round(Date.now() / 1000)
    }
    await db('transactions').insert(transaction)

    // return data
    data.push({
      player: activate,
      tid,
      slot: constants.slots.BENCH,
      rid: roster.uid,
      pos: activatePlayerRow.pos,
      transaction
    })

    // update roster
    roster.updateSlot(activate, constants.slots.BENCH)
  }

  if (slot === constants.slots.IR && !roster.hasOpenInjuredReserveSlot()) {
    throw new Error('exceeds roster limits')
  }

  const type =
    slot === constants.slots.IR
      ? constants.transactions.RESERVE_IR
      : constants.transactions.RESERVE_COV
  await db('rosters_players').update({ slot }).where({
    rid: rosterRow.uid,
    player
  })

  const { value } = await getLastTransaction({ player, lid: leagueId, tid })
  const transaction = {
    userid: userId,
    tid,
    lid: leagueId,
    player,
    type,
    value,
    year: constants.season.year,
    timestamp: Math.round(Date.now() / 1000)
  }
  await db('transactions').insert(transaction)

  await db('league_cutlist')
    .where({
      player,
      tid
    })
    .del()

  const teams = await db('teams').where({ uid: tid })
  const team = teams[0]
  let message = `${team.name} (${team.abbrv}) has placed ${playerRow.fname} ${playerRow.lname} (${playerRow.pos}) on ${constants.transactionsDetail[type]}.`

  if (activate) {
    message += ` ${activatePlayerRow.fname} ${activatePlayerRow.lname} (${playerRow.pos}) has been activated`
  }

  await sendNotifications({
    league,
    notifyLeague: true,
    message
  })

  data.unshift({
    transaction,
    slot,
    player,
    rid: roster.uid,
    tid,
    pos: playerRow.pos
  })

  return data
}
