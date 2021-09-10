const { constants } = require('../common')
const db = require('../db')

module.exports = async function ({ week, playerIds = [] } = {}) {
  if (!playerIds.length) {
    const players = await db('player')
      .select('player')
      .whereIn('pos', constants.positions)
      .whereNot({ cteam: 'INA' })
    players.forEach((p) => playerIds.push(p.player))
  }

  const sub = db('projections')
    .select(db.raw('max(timestamp) AS maxtime, sourceid AS sid'))
    .groupBy('sid')
    .where('year', constants.season.year)
    .whereNull('userid')

  const query = db
    .select('*')
    .from(db.raw('(' + sub.toString() + ') AS X'))
    .innerJoin('projections', function () {
      this.on(function () {
        this.on('sourceid', '=', 'sid')
        this.andOn('timestamp', '=', 'maxtime')
      })
    })
    .whereIn('player', playerIds)
    .whereNull('userid')
    .whereNot('sourceid', constants.sources.AVERAGE)

  if (typeof week !== 'undefined') {
    query.where('week', week)
  } else {
    query.where('week', '>=', constants.season.week)
  }

  return query
}
