const { uniqBy } = require('../common')

const getPlayByPlayQuery = (db) => db('pbp')
  .select(
    'pbp.fuml', 'pbp.fum', 'pbp.off', 'pbp.type', 'pbp.bc', 'pbp.yds', 'pbp.fd',
    'pbp.succ', 'pbp.psr', 'pbp.trg', 'pbp.ints', 'pbp.comp', 'pbp.pts', 'pbp.sk1',
    'pbp.dwn', 'pbp.qtr', 'chart.dot', 'chart.tay', 'chart.qbp', 'chart.qbhi',
    'chart.qbhu', 'chart.high', 'chart.intw', 'chart.drp', 'chart.cnb', 'chart.mbt',
    'chart.yac', 'chart.yaco', 'game.wk', 'game.day'
  )
  .join('game', 'pbp.gid', 'game.gid')
  .leftJoin('chart', 'pbp.pid', 'chart.pid')
  .whereNot('pbp.type', 'NOPL')
  .where(function () {
    this.whereNot({ 'pbp.act1': 'A' })
    this.orWhereNot({ 'pbp.act2': 'A' })
    this.orWhereNot({ 'pbp.act3': 'A' })
  })

const getRoster = async ({ db, tid, week, year }) => {
  const rows = await db('rosters').where({ tid, year, week })
  const rosterRow = rows[0]
  const players = await db('rosters_players')
    .leftJoin('transactions', 'rosters_players.player', 'transactions.player')
    .where('rid', rosterRow.uid)
    .where('transactions.tid', tid)
    .orderBy('transactions.timestamp', 'desc')

  rosterRow.players = uniqBy(players, 'player')

  return rosterRow
}

module.exports = {
  sendNotifications: require('./send-notifications'),
  getPlayerId: require('./get-player-id'),
  getSchedule: require('./get-schedule'),
  getPlayByPlayQuery,
  getRoster
}
