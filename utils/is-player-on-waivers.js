const moment = require('moment')
const db = require('../db')
const { constants } = require('../common')

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
    .limit(2)

  // not on waivers without any transactions
  if (!transactions.length) {
    return false
  }

  // not on waivers if not dropped within the last 24 hours
  const last = transactions[0]

  if (last.type !== constants.transactions.ROSTER_DROP) {
    throw new Error('player not eligible for acquisition waivers')
  }

  if (moment().isAfter(moment(last.timestamp, 'X').add('24', 'hours'))) {
    return false
  }

  // on waivers if there is only one transaction in the last 48 hours
  const previous = transactions[1]
  if (!previous) {
    return true
  }

  // not on waivers if not on roster for 24 hours before being dropped
  const diff = moment(last.timestamp, 'X').diff(moment(previous.timestamp, 'X'), 'hours')
  if (diff < 24) {
    return false
  }

  return true
}
