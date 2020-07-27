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
  rosterRow.players = await db('rosters_players').where('rid', rosterRow.uid)

  return rosterRow
}

module.exports = {
  getPlayerId: require('./get-player-id'),
  getSchedule: require('./get-schedule'),
  getPlayByPlayQuery,
  getRoster
}
