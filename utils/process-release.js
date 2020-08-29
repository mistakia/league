const moment = require('moment')

const db = require('../db')
const { constants, Roster } = require('../common')
const isPlayerLocked = require('./is-player-locked')
const getRoster = require('./get-roster')

module.exports = async function ({
  lid,
  tid,
  player,
  userid
}) {
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
  const rosterRow = await getRoster({
    tid,
    week: constants.season.week,
    year: constants.season.year
  })
  const roster = new Roster({ roster: rosterRow, league })
  if (!roster.has(player)) {
    throw new Error('player not on roster')
  }

  // verify player is not locked and is a starter
  const isLocked = await isPlayerLocked(player)
  const isStarter = !!roster.starters.find(p => p.player === player)
  if (isLocked && isStarter) {
    throw new Error('starter is locked')
  }

  // verify player does not have a poaching claim
  const isOnPracticeSquad = !!roster.practice.find(p => p.player === player)
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
      if (moment(poach.processed, 'X').isAfter(constants.season.offseason)) {
        throw new Error('player was poached')
      }
    }
  }

  // remove drop player from rosters
  const teamRosters = await db('rosters')
    .where('week', '>=', constants.season.week)
    .where('year', constants.season.year)
    .where('tid', tid)
  const rosterIds = teamRosters.map(r => r.uid)
  await db('rosters_players')
    .whereIn('rid', rosterIds)
    .where('player', player)
    .del()

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

  return {
    player: player,
    slot: null,
    tid,
    rid: roster.uid,
    pos: playerRow.pos1,
    transaction
  }
}
