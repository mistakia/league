const dayjs = require('dayjs')

const db = require('../db')
const { constants, Roster } = require('../common')
const isPlayerLocked = require('./is-player-locked')
const getRoster = require('./get-roster')

module.exports = async function ({ lid, tid, player, userid, activate }) {
  const data = []

  // verify player id
  const playerRows = await db('player').where('player', player).limit(1)
  if (!playerRows.length) {
    throw new Error('invalid player')
  }
  const playerRow = playerRows[0]

  // verify player is on current roster
  const leagues = await db('leagues').where({ uid: lid }).limit(1)
  if (!leagues.length) {
    throw new Error('invalid leagueId')
  }
  const league = leagues[0]
  const rosterRow = await getRoster({ tid })
  const roster = new Roster({ roster: rosterRow, league })
  if (!roster.has(player)) {
    throw new Error('player not on roster')
  }

  // verify player is not protected
  if (
    roster.players.find(
      (p) => p.player === player && p.slot === constants.slots.PSP
    )
  ) {
    throw new Error('player is protected')
  }

  // verify player is not locked and is a starter
  const isLocked = await isPlayerLocked(player)
  const isStarter = !!roster.starters.find((p) => p.player === player)
  if (isLocked && isStarter) {
    throw new Error('starter is locked')
  }

  // verify player does not have a poaching claim
  const isOnPracticeSquad = !!roster.practice.find((p) => p.player === player)
  if (isOnPracticeSquad) {
    const poaches = await db('poaches')
      .where({ player, lid })
      .whereNull('processed')

    if (poaches.length) {
      throw new Error('player has a poaching claim')
    }
  }

  // verify player was not poached this offseason
  if (!constants.season.isRegularSeason) {
    const poaches = await db('poaches')
      .where({ player, lid, tid, succ: 1 })
      .orderBy('processed', 'desc')

    if (poaches.length) {
      const poach = poaches[0]
      if (dayjs.unix(poach.processed).isAfter(constants.season.offseason)) {
        throw new Error('player was poached')
      }
    }
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

    // make sure player is not protected
    if (
      roster.players.find(
        (p) => p.player === activate && p.slot === constants.slots.PSP
      )
    ) {
      throw new Error('player is protected')
    }

    // make sure roster has bench space
    roster.removePlayer(player)
    if (!roster.hasOpenBenchSlot(activatePlayerRow.pos)) {
      throw new Error('exceeds roster limits')
    }

    // activate player
    await db('rosters_players').update({ slot: constants.slots.BENCH }).where({
      rid: rosterRow.uid,
      player: activate
    })

    const activateRosterPlayer = roster.get(activate)
    const transaction = {
      userid,
      tid,
      lid,
      player: activate,
      type: constants.transactions.ROSTER_ACTIVATE,
      value: activateRosterPlayer.value,
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
  }

  // create transaction
  const transaction = {
    userid,
    tid,
    lid,
    player,
    type: constants.transactions.ROSTER_RELEASE,
    value: 0,
    year: constants.season.year,
    timestamp: Math.round(Date.now() / 1000)
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
    .where('player', player)
    .del()
  await db('league_cutlist')
    .where({
      player,
      tid
    })
    .del()

  data.unshift({
    player,
    slot: null,
    tid,
    rid: roster.uid,
    pos: playerRow.pos,
    transaction
  })

  return data
}
