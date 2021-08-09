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
    const transactions = await db('transactions')
      .select(
        'transactions.type',
        'transactions.value',
        'transactions.timestamp',
        'transactions.tid',
        'transactions.lid',
        'transactions.player'
      )
      .join('rosters_players', 'transactions.player', 'rosters_players.player')
      .join('rosters', function () {
        this.on('rosters_players.rid', '=', 'rosters.uid')
        this.on('transactions.tid', '=', 'rosters.tid')
      })
      .where('rosters.week', constants.season.week)
      .where('rosters.year', constants.season.year)
      .whereIn('type', [
        constants.transactions.EXTENSION,
        constants.transactions.TRANSITION_TAG,
        constants.transactions.FRANCHISE_TAG,
        constants.transactions.ROOKIE_TAG
      ])
      .whereIn('transactions.player', playerIds)

    if (transactions.length) {
      for (const player of rosterRow.players) {
        player.extensions = transactions.filter(
          (p) => p.player === player.player
        )
      }
    }

    const bids = await db('transition_bids')
      .where('tid', tid)
      .where('year', constants.season.year)

    if (bids.length) {
      for (const player of rosterRow.players) {
        const { bid } = bids.find((b) => b.player === player) || {}
        player.bid = bid
      }
    }
  }

  return rosterRow
}
