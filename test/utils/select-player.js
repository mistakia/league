const db = require('../../db')
const { constants } = require('../../common')

module.exports = async ({
  pos = 'RB',
  rookie = false,
  exclude = []
} = {}) => {
  const query = db('player')
    .whereNot('cteam', 'INA')
    .whereNotIn('player', exclude)
    .where('pos1', pos)
    .orderByRaw('RAND()')
    .limit(1)

  if (rookie) {
    query.where('start', constants.season.year)
  } else {
    query.whereNot('start', constants.season.year)
  }

  const players = await query
  return players[0]
}
