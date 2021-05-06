const API = require('groupme').Stateless

const db = require('../db')
const { constants, Roster } = require('../common')
const sendNotifications = require('./send-notifications')
const getRoster = require('./get-roster')
const processRelease = require('./process-release')

module.exports = async function (claim) {
  const rosterSlots = await db('rosters')
    .join('rosters_players', 'rosters.uid', 'rosters_players.rid')
    .where('rosters_players.player', claim.player)
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
  const claimPlayerIds = [claim.player]
  if (claim.drop) claimPlayerIds.push(claim.drop)
  const playerRows = await db('player').whereIn('player', claimPlayerIds)
  const poachPlayer = playerRows.find((p) => p.player === claim.player)
  const leagues = await db('leagues').where({ uid: claim.lid })
  const league = leagues[0]
  const rosterRow = await getRoster({
    tid: claim.tid,
    week: constants.season.week,
    year: constants.season.year
  })
  const roster = new Roster({ roster: rosterRow, league })
  if (claim.drop && roster.has(claim.drop)) {
    roster.removePlayer(claim.drop)
  }
  const hasSlot = roster.hasOpenBenchSlot(poachPlayer.pos)
  if (!hasSlot) {
    throw new Error('poaching claim unsuccessful, no available roster space')
  }

  // verify team has enough cap if during the offseason
  const transactions = await db('transactions')
    .where({
      player: claim.player,
      lid: claim.lid
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
  if (claim.drop && roster.has(claim.drop)) {
    const { drop, tid, lid, userid } = claim
    await processRelease({ player: drop, tid, lid, userid })
  }

  // remove player from poached team rosters
  const poachedTeamRosters = await db('rosters')
    .where('week', '>=', constants.season.week)
    .where('tid', rosterSlot.tid)
    .where('year', constants.season.year)
  const poachedTeamRosterIds = poachedTeamRosters.map((r) => r.uid)
  await db('rosters_players')
    .whereIn('rid', poachedTeamRosterIds)
    .where('player', claim.player)
    .del()

  const transaction = {
    userid: claim.userid,
    tid: claim.tid,
    lid: claim.lid,
    player: claim.player,
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
    player: claim.player,
    pos: poachPlayer.pos
  })

  // send notification
  let message = `Poaching claim for ${poachPlayer.fname} ${poachPlayer.lname} (${poachPlayer.pos}) successfully processed.`
  if (claim.drop && roster.has(claim.drop)) {
    const dropPlayer = playerRows.find((p) => p.player === claim.drop)
    message += ` ${dropPlayer.fname} ${dropPlayer.lname} (${dropPlayer.pos}) has been released.`
  }

  await sendNotifications({
    leagueId: claim.lid,
    league: true,
    message
  })

  if (league.groupme_token && league.groupme_id) {
    await API.Bots.post.Q(league.groupme_token, league.groupme_id, message, {})
  }
}
