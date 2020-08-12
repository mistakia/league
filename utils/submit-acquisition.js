const API = require('groupme').Stateless

const db = require('../db')

const { constants, Roster } = require('../common')
const sendNotifications = require('./send-notifications')
const getRoster = require('./get-roster')
const isPlayerOnWaivers = require('./is-player-on-waivers')

module.exports = async function ({ leagueId, drop, player, teamId, bid = 0, userId }) {
  // verify player and drop ids
  const playerIds = [player]
  if (drop) playerIds.push(drop)
  const playerRows = await db('player').whereIn('player', playerIds)
  if (playerRows.length !== playerIds.length) {
    throw new Error('could not find playerIds')
  }
  const acquisitionPlayer = playerRows.find(p => p.player === player)

  // verify leagueId
  const leagues = await db('leagues').where({ uid: leagueId }).limit(1)
  if (!leagues.length) {
    throw new Error('invalid leagueId')
  }

  const teams = await db('teams').where({ uid: teamId }).limit(1)
  const team = teams[0]

  // verify player is a free agent
  const league = leagues[0]
  const slots = await db('rosters_players')
    .join('rosters', 'rosters_players.rid', 'rosters.uid')
    .where({
      lid: leagueId,
      week: constants.season.week,
      year: constants.season.year,
      player
    })
  if (slots.length) {
    throw new Error('player is not a free agent')
  }

  // verify player is not on waivers - dropped in the last 24 hours excluding cycling
  const isOnWaivers = isPlayerOnWaivers({ player, leagueId })
  if (isOnWaivers) {
    throw new Error('player is on waivers')
  }

  // verify team has bench space & passes roster constraints
  const rosterRow = await getRoster({
    tid: teamId,
    week: constants.season.week,
    year: constants.season.year
  })
  const roster = new Roster({ roster: rosterRow, league })
  if (drop) {
    if (!roster.has(drop)) {
      throw new Error('invalid drop player, not on roster')
    }

    // TODO check if drop player is in active roster and locked

    roster.removePlayer(drop)
  }
  const hasSlot = roster.hasOpenBenchSlot(acquisitionPlayer.pos1)
  if (!hasSlot) {
    throw new Error('acquisition unsuccessful, no available roster space')
  }

  // add player to roster
  await db('rosters_players').insert({
    rid: roster.uid,
    player,
    pos: acquisitionPlayer.pos1,
    slot: constants.slots.BENCH
  })

  // remove drop player if necessary
  const transactions = []
  if (drop) {
    transactions.push({
      userid: userId,
      tid: teamId,
      lid: leagueId,
      player: drop,
      type: constants.transactions.ROSTER_DROP,
      value: 0,
      year: constants.season.year,
      timestamp: Math.round(Date.now() / 1000)
    })
    await db('rosters_players')
      .where({
        rid: roster.uid,
        player: drop
      })
      .del()
  }

  // create transaction
  transactions.push({
    userid: userId,
    tid: teamId,
    lid: leagueId,
    player,
    type: constants.transactions.ROSTER_ADD,
    value: bid,
    year: constants.season.year,
    timestamp: Math.round(Date.now() / 1000)
  })
  await db('transactions').insert(transactions)

  for (const tran of transactions) {
    const p = playerRows.find(p => p.player === tran.player)
    tran.pos = p.pos1
    tran.rid = roster.uid
  }

  // send notification
  let message = `${team.name} (${team.abbrev}) has signed free agent ${acquisitionPlayer.fname} ${acquisitionPlayer.lname} (${acquisitionPlayer.pos1}) for ${bid}.`
  if (drop) {
    const dropPlayer = playerRows.find(p => p.player === drop)
    message += ` ${dropPlayer.fname} ${dropPlayer.lname} (${dropPlayer.pos1}) has been released.`
  }
  await sendNotifications({
    leagueId: league.uid,
    teamIds: [],
    voice: false,
    league: true,
    message
  })

  if (league.groupme_token && league.groupme_id) {
    await API.Bots.post.Q(league.groupme_token, league.groupme_id, message, {})
  }

  return transactions
}
