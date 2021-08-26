const { constants } = require('../common')
const db = require('../db')

module.exports = async function () {
  const players = await db('player')
    .select('player')
    .whereIn('pos', constants.positions)
    .whereNot({ cteam: 'INA' })
  const playerIds = players.map((p) => p.player)

  const sub = db('projections')
    .select(db.raw('max(timestamp) AS maxtime, sourceid AS sid'))
    .groupBy('sid')
    .where('year', constants.season.year)
    .whereNull('userid')

  const projections = await db
    .select('*')
    .from(db.raw('(' + sub.toString() + ') AS X'))
    .innerJoin('projections', function () {
      this.on(function () {
        this.on('sourceid', '=', 'sid')
        this.andOn('timestamp', '=', 'maxtime')
      })
    })
    .whereIn('player', playerIds)
    .where('week', '>=', constants.season.week)
    .whereNull('userid')

  return projections
}
