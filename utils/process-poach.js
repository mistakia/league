const API = require('groupme').Stateless

const db = require('../db')
const { constants, Roster } = require('../common')
const sendNotifications = require('./send-notifications')
const getRoster = require('./get-roster')

module.exports = async function (claim) {
  const rosterSlots = await db('rosters')
    .join('rosters_players', 'rosters.uid', 'rosters_players.rid')
    .where('rosters_players.player', claim.player)
    .where({ week: constants.week, year: constants.year })

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
  const poachPlayer = playerRows.find(p => p.player === claim.player)
  const leagues = await db('leagues').where({ uid: claim.lid })
  const league = leagues[0]
  const rosterRow = await getRoster({
    tid: claim.tid,
    week: constants.week,
    year: constants.year
  })
  const roster = new Roster({ roster: rosterRow, league })
  if (claim.drop) {
    roster.removePlayer(claim.drop)
  }
  const hasSlot = roster.hasOpenBenchSlot(poachPlayer.pos1)
  if (!hasSlot) {
    throw new Error('poaching claim unsuccessful, no available roster space')
  }

  if (claim.drop) {
    // drop transaction
    const dropTransaction = {
      userid: claim.userid,
      tid: claim.tid,
      player: claim.player,
      type: constants.transactions.ROSTER_DROP,
      value: 0,
      year: constants.year,
      timestamp: Math.round(Date.now() / 1000)
    }
    await db('transactions').insert(dropTransaction)

    // send drop notification
    const dropPlayer = playerRows.find(p => p.player === claim.drop)
    const dropMessage = `${dropPlayer.fname} ${dropPlayer.lname} (${dropPlayer.pos1}) has been released.`
    await sendNotifications({
      leagueId: claim.lid,
      league: true,
      message: dropMessage
    })

    if (league.groupme_token && league.groupme_id) {
      await API.Bots.post.Q(league.groupme_token, league.groupme_id, dropMessage, {})
    }

    // remove drop player from rosters
    const poachingTeamRosters = await db('rosters')
      .where('week', '>=', constants.week)
      .where('tid', claim.tid)
    const poachingTeamRosterIds = poachingTeamRosters.map(r => r.uid)
    await db('rosters_players')
      .whereIn('rid', poachingTeamRosterIds)
      .where('player', claim.drop)
      .del()
  }

  // verify team has enough cap if during the offseason
  const transactions = await db('transactions')
    .where({
      player: claim.player,
      lid: claim.lid
    })
    .orderBy('timestamp', 'desc')
    .limit(1)
  const tran = transactions[0]
  const playerPoachValue = tran.value + 2
  if (!constants.regularSeason && (playerPoachValue + roster.availableCap) > league.cap) {
    throw new Error('not enough available cap')
  }

  const transaction = {
    userid: claim.userid,
    tid: claim.tid,
    lid: claim.lid,
    player: claim.player,
    type: constants.transactions.POACHED,
    value: playerPoachValue,
    year: constants.year,
    timestamp: Math.round(Date.now() / 1000)
  }
  await db('transactions').insert(transaction)

  // remove player from poached team rosters
  const poachedTeamRosters = await db('rosters')
    .where('week', '>=', constants.week)
    .where('tid', rosterSlot.tid)
  const poachedTeamRosterIds = poachedTeamRosters.map(r => r.uid)
  await db('rosters_players')
    .whereIn('rid', poachedTeamRosterIds)
    .where('player', claim.player)
    .del()

  // add player to poaching team roster
  await db('rosters_players')
    .insert({
      rid: rosterRow.uid,
      slot: constants.slots.BENCH,
      player: claim.player,
      pos: poachPlayer.pos1
    })

  // send notification
  const message = `Poaching claim for ${poachPlayer.fname} ${poachPlayer.lname} (${poachPlayer.pos1}) successfully processed.`
  await sendNotifications({
    leagueId: claim.lid,
    league: true,
    message
  })

  if (league.groupme_token && league.groupme_id) {
    await API.Bots.post.Q(league.groupme_token, league.groupme_id, message, {})
  }
}
