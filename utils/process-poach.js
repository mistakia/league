const db = require('../db')
const { constants, Roster } = require('../common')
const sendNotifications = require('./send-notifications')
const getRoster = require('./get-roster')
const processRelease = require('./process-release')
const getLeague = require('./get-league')

module.exports = async function ({ player, release = [], lid, tid, userid }) {
  const rosterSlots = await db('rosters')
    .join('rosters_players', 'rosters.uid', 'rosters_players.rid')
    .where('rosters_players.player', player)
    .where({ week: constants.season.week, year: constants.season.year })

  // verify player is on a team
  if (!rosterSlots.length) {
    throw new Error('player not on a roster')
  }

  const rosterSlot = rosterSlots[0]

  // verify player is on the practice squad
  if (rosterSlot.slot !== constants.slots.PS) {
    throw new Error('player is not on a practice squad')
  }

  // verify poaching team has active roster space
  const claimPlayerIds = [player]
  if (release.length) {
    release.map((player) => claimPlayerIds.push(player))
  }
  const playerRows = await db('player').whereIn('player', claimPlayerIds)
  const poachPlayer = playerRows.find((p) => p.player === player)
  const league = await getLeague(lid)
  const rosterRow = await getRoster({ tid })
  const roster = new Roster({ roster: rosterRow, league })
  if (release.length) {
    for (const player of release) {
      if (roster.has(player)) {
        roster.removePlayer(player)
      }
    }
  }
  const hasSlot = roster.hasOpenBenchSlot(poachPlayer.pos)
  if (!hasSlot) {
    throw new Error('poaching claim unsuccessful, no available roster space')
  }

  // verify team has enough cap if during the offseason
  const transactions = await db('transactions')
    .where({
      player,
      lid
    })
    .orderBy('timestamp', 'desc')
    .orderBy('uid', 'desc')
    .limit(1)
  const tran = transactions[0]
  const playerPoachValue = tran.value + 2
  if (
    !constants.season.isRegularSeason &&
    roster.availableCap - playerPoachValue < 0
  ) {
    throw new Error('not enough available cap')
  }

  // process release
  if (release.length) {
    for (const player of release) {
      if (roster.has(player)) {
        await processRelease({ player, tid, lid, userid })
      }
    }
  }

  // remove player from poached team rosters
  const poachedTeamRosters = await db('rosters')
    .where('week', '>=', constants.season.week)
    .where('tid', rosterSlot.tid)
    .where('year', constants.season.year)
  const poachedTeamRosterIds = poachedTeamRosters.map((r) => r.uid)
  await db('rosters_players')
    .whereIn('rid', poachedTeamRosterIds)
    .where('player', player)
    .del()

  const transaction = {
    userid,
    tid,
    lid,
    player,
    type: constants.transactions.POACHED,
    value: playerPoachValue,
    year: constants.season.year,
    timestamp: Math.round(Date.now() / 1000)
  }
  await db('transactions').insert(transaction)

  // add player to poaching team roster
  await db('rosters_players').insert({
    rid: rosterRow.uid,
    slot: constants.slots.BENCH,
    player,
    pos: poachPlayer.pos
  })

  // send notification
  let message = `Poaching claim for ${poachPlayer.fname} ${poachPlayer.lname} (${poachPlayer.pos}) successfully processed.`
  if (release.length) {
    for (const player of release) {
      if (roster.has(player)) {
        const releasePlayer = playerRows.find((p) => p.player === player)
        message += ` ${releasePlayer.fname} ${releasePlayer.lname} (${releasePlayer.pos}) has been released.`
      }
    }
  }

  await sendNotifications({
    league,
    notifyLeague: true,
    message
  })
}
