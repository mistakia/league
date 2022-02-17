const db = require('../../db')
const { constants } = require('../../common')

module.exports = async ({
  pos = 'RB',
  rookie = false,
  exclude = [],
  excludePS = false
} = {}) => {
  const query = db('player')
    .whereNot('cteam', 'INA')
    .where('pos1', pos)
    .orderByRaw('RAND()')
    .limit(1)

  if (exclude.length) {
    query.whereNotIn('player', exclude)
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
