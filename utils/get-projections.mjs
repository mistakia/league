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

  const query = db
    .from('projections_index')
    .whereIn('pid', pids)
    .where({
      year,
      userid: 0
    })
    .whereNot('sourceid', constants.sources.AVERAGE)

  if (typeof week !== 'undefined') {
    query.where('week', week)
  } else {
    query.where('week', '>=', constants.season.week)
  }

  return query
}
