import { constants } from '#libs-shared'
import db from '#db'

export default async function ({
  year = constants.season.year,
  week = constants.season.week,
  pids = []
} = {}) {
  if (!pids.length) {
    const players = await db('player')
      .select('pid')
      .whereIn('pos', constants.positions)
      .whereNot({ current_nfl_team: 'INA' })
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
    .where('week', '>=', week)

  return query
}
