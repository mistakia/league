const moment = require('moment')
const db = require('../db')
const { isOnReleaseWaivers } = require('../common')

module.exports = async ({ player, leagueId }) => {
  // get last two transactions for player
  const cutoff = moment().subtract('48', 'hours').format('X')
  const transactions = await db('transactions')
    .where({
      lid: leagueId,
      player
    })
    .where('timestamp', '>', cutoff)
    .orderBy('timestamp', 'desc')
    .orderBy('uid', 'desc')
    .limit(2)

  return isOnReleaseWaivers({ transactions })
}
