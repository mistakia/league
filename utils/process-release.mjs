import dayjs from 'dayjs'

import db from '#db'
import { constants, Roster } from '#common'
import isPlayerLocked from './is-player-locked.mjs'
import getRoster from './get-roster.mjs'
import getLastTransaction from './get-last-transaction.mjs'
import sendNotifications from './send-notifications.mjs'
import getLeague from './get-league.mjs'

export default async function ({
  lid,
  tid,
  release_pid,
  userid,
  activate_pid,
  create_notification = false
}) {
  const timestamp = Math.round(Date.now() / 1000)
  const data = []

  // verify player id
  const player_rows = await db('player').where({ pid: release_pid }).limit(1)
  if (!player_rows.length) {
    throw new Error('invalid player')
  }
  const release_player_row = player_rows[0]

  // verify player is on current roster
  const league = await getLeague({ lid })
  if (!league) {
    throw new Error('invalid leagueId')
  }
  const rosterRow = await getRoster({ tid })
  const roster = new Roster({ roster: rosterRow, league })
  if (!roster.has(release_pid)) {
    throw new Error('player not on roster')
  }

  // verify player is not protected
  if (
    roster.players.find(
      (p) =>
        p.pid === release_pid &&
        (p.slot === constants.slots.PSP || p.slot === constants.slots.PSDP)
    )
  ) {
    throw new Error('player is protected')
  }

  // verify player is not locked and is a starter
  const isLocked = await isPlayerLocked(release_pid)
  const isStarter = Boolean(roster.starters.find((p) => p.pid === release_pid))
  if (isLocked && isStarter) {
    throw new Error('starter is locked')
  }

  // verify player does not have a poaching claim
  const isOnPracticeSquad = Boolean(
    roster.practice.find((p) => p.pid === release_pid)
  )
  if (isOnPracticeSquad) {
    const poaches = await db('poaches')
      .where({ pid: release_pid, lid })
      .whereNull('processed')

    if (poaches.length) {
      throw new Error('player has a poaching claim')
    }
  }

  // verify player was not poached this offseason
  if (!constants.season.isRegularSeason) {
    const poaches = await db('poaches')
      .where({ pid: release_pid, lid, tid, succ: 1 })
      .orderBy('processed', 'desc')

    if (poaches.length) {
      const poach = poaches[0]
      if (dayjs.unix(poach.processed).isAfter(constants.season.offseason)) {
        throw new Error('player was poached')
      }
    }
  }

  let activate_player_row
  if (activate_pid) {
    const players = await db('player').where('pid', activate_pid)
    activate_player_row = players[0]

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

    // make sure roster has bench space
    roster.removePlayer(release_pid)
    if (!roster.hasOpenBenchSlot(activate_player_row.pos)) {
      throw new Error('exceeds roster limits')
    }

    // activate player
    await db('rosters_players').update({ slot: constants.slots.BENCH }).where({
      rid: rosterRow.uid,
      pid: activate_pid
    })

    const { value } = await getLastTransaction({
      pid: activate_pid,
      lid,
      tid
    })
    const transaction = {
      userid,
      tid,
      lid,
      pid: activate_pid,
      type: constants.transactions.ROSTER_ACTIVATE,
      value,
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
        lid,
        pid: activate_pid
      })
      .whereNull('processed')

    // return data
    data.push({
      pid: activate_pid,
      tid,
      slot: constants.slots.BENCH,
      rid: roster.uid,
      pos: activate_player_row.pos,
      transaction
    })
  }

  // create transaction
  const transaction = {
    userid,
    tid,
    lid,
    pid: release_pid,
    type: constants.transactions.ROSTER_RELEASE,
    value: 0,
    week: constants.season.week,
    year: constants.season.year,
    timestamp
  }
  await db('transactions').insert(transaction)

  // remove release player from rosters
  const teamRosters = await db('rosters')
    .where('week', '>=', constants.season.week)
    .where('year', constants.season.year)
    .where('tid', tid)
  const rosterIds = teamRosters.map((r) => r.uid)
  await db('rosters_players')
    .whereIn('rid', rosterIds)
    .where('pid', release_pid)
    .del()
  await db('league_cutlist')
    .where({
      pid: release_pid,
      tid
    })
    .del()

  data.unshift({
    pid: release_pid,
    slot: null,
    tid,
    rid: roster.uid,
    pos: release_player_row.pos,
    transaction
  })

  if (create_notification) {
    const teams = await db('teams').where({
      uid: tid,
      year: constants.season.year
    })
    const team = teams[0]

    let message
    if (activate_pid) {
      message = `${team.name} (${team.abbrv}) has activated ${activate_player_row.fname} ${activate_player_row.lname} (${activate_player_row.pos}). ${release_player_row.fname} ${release_player_row.lname} (${release_player_row.pos}) has been released.`
    } else {
      message = `${team.name} (${team.abbrv}) has released ${release_player_row.fname} ${release_player_row.lname} (${release_player_row.pos}).`
    }

    await sendNotifications({
      league,
      notifyLeague: true,
      message
    })
  }

  return data
}
