import { constants } from '#common'
import db from '#db'

export default async function ({
  year = constants.season.year,
  week,
  pids = []
} = {}) {
  if (!pids.length) {
    const players = await db('player')
      .select('pid')
      .whereIn('pos', constants.positions)
      .whereNot({ cteam: 'INA' })
    players.forEach((p) => pids.push(p.pid))
  }

  const sub = db('projections')
    .select(
      db.raw(
        'max(timestamp) AS maxtime, sourceid AS sid, week as wid, CONCAT(sourceid, week) AS sid_week'
      )
    )
    .groupBy('sid_week')
    .where('year', year)
    .where('userid', 0)

  const query = db
    .select('*')
    .from(db.raw('(' + sub.toString() + ') AS X'))
    .innerJoin('projections', function () {
      this.on(function () {
        this.on('sourceid', '=', 'sid')
        this.andOn('timestamp', '=', 'maxtime')
        this.andOn('week', '=', 'wid')
      })
    })
    .whereIn('pid', pids)
    .where('userid', 0)
    .whereNot('sourceid', constants.sources.AVERAGE)

  if (typeof week !== 'undefined') {
    query.where('week', week)
  } else {
    query.where('week', '>=', constants.season.week)
  }

  return query
}
