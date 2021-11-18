const { constants, Roster } = require('../common')
const getLeague = require('./get-league')
const getRoster = require('./get-roster')
const db = require('../db')
const sendNotifications = require('./send-notifications')

module.exports = async function ({ tid, player, leagueId, userId }) {
  const league = await getLeague(leagueId)
  if (!league) {
    throw new Error('invalid leagueId')
  }

  const rosterRow = await getRoster({ tid })
  const roster = new Roster({ roster: rosterRow, league })

  // make sure player is on team
  if (!roster.has(player)) {
    throw new Error('invalid player')
  }

  // make sure player is not on active roster
  if (roster.active.find((p) => p.player === player)) {
    throw new Error('player is on active roster')
  }

  // make sure player is not protected
  if (
    roster.players.find(
      (p) => p.player === player && p.slot === constants.slots.PSP
    )
  ) {
    throw new Error('player is protected')
  }

  const players = await db('player')
    .join('transactions', 'player.player', 'transactions.player')
    .where('player.player', player)
    .where({
      lid: leagueId,
      tid
    })
    .orderBy('transactions.timestamp', 'desc')
  const playerRow = players[0]

  // make sure team has space on active roster
  if (!roster.hasOpenBenchSlot(playerRow.pos)) {
    throw new Error('no available space on active roster')
  }

  await db('rosters_players').update({ slot: constants.slots.BENCH }).where({
    rid: rosterRow.uid,
    player
  })

  const transaction = {
    userid: userId,
    tid,
    lid: leagueId,
    player,
    type: constants.transactions.ROSTER_ACTIVATE,
    value: playerRow.value,
    year: constants.season.year,
    timestamp: Math.round(Date.now() / 1000)
  }
  await db('transactions').insert(transaction)

  const data = {
    player,
    tid,
    slot: constants.slots.BENCH,
    rid: roster.uid,
    pos: playerRow.pos,
    transaction
  }

  const teams = await db('teams').where({ uid: tid })
  const team = teams[0]

  const message = `${team.name} (${team.abbrv}) has activated ${playerRow.fname} ${playerRow.lname} (${playerRow.pos}).`

  await sendNotifications({
    league,
    notifyLeague: true,
    message
  })

  return data
}
