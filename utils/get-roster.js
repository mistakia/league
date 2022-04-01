const { uniqBy, constants } = require('../common')
const db = require('../db')

module.exports = async ({
  tid,
  week = constants.season.week,
  year = constants.season.year
}) => {
  const rows = await db('rosters').where({ tid, year, week })
  const rosterRow = rows[0]
  const players = await db('rosters_players')
    .leftJoin('transactions', 'rosters_players.player', 'transactions.player')
    .where('rid', rosterRow.uid)
    .where('transactions.tid', tid)
    .orderBy('transactions.timestamp', 'desc')
    .orderBy('transactions.uid', 'desc')

  rosterRow.players = uniqBy(players, 'player')

  if (week === 0) {
    const playerIds = players.map((p) => p.player)

    // TODO - get extension count for player
    const transactions = await db('transactions')
      .where('tid', tid)
      .whereIn('player', playerIds)
      .where('type', constants.transactions.EXTENSION)

    if (transactions.length) {
      for (const player of rosterRow.players) {
        const matches = transactions.filter((p) => p.player === player.player)
        player.extensions = matches.length
      }
    }

    const bids = await db('transition_bids')
      .where('tid', tid)
      .where('year', constants.season.year)
      .whereNull('cancelled')

    if (bids.length) {
      for (const player of rosterRow.players) {
        const { bid } = bids.find((b) => b.player === player.player) || {}
        player.bid = bid
      }
    }
  }

  return rosterRow
}
