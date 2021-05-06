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

  return rosterRow
}
