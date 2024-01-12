import db from '#db'
import { constants } from '#libs-shared'

export default async function ({
  pos = 'RB',
  rookie = false,
  exclude_pids = [],
  excludePS = false
} = {}) {
  const query = db('player')
    .whereNot('current_nfl_team', 'INA')
    .where('pos1', pos)
    .orderByRaw('RAND()')
    .limit(1)

  if (exclude_pids.length) {
    query.whereNotIn('pid', exclude_pids)
  }

  if (rookie) {
    query.where('start', constants.season.year)
  } else {
    query.whereNot('start', constants.season.year)
  }

  if (excludePS) {
    query.whereNot('posd', 'PS')
  }

  const players = await query
  return players[0]
}
