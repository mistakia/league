const { constants } = require('../common')
const db = require('../db')

module.exports = async function ({ lid, player, tid }) {
  const transactions = await db('transactions')
    .where({
      lid,
      tid,
      player
    })
    .orderBy('timestamp', 'desc')
    .orderBy('uid', 'desc')

  const types = [
    constants.transactions.ROSTER_ADD,
    constants.transactions.TRADE,
    constants.transactions.POACHED,
    constants.transactions.AUCTION_PROCESSED,
    constants.transactions.DRAFT,
    constants.transactions.PRACTICE_ADD
  ]
  const index = transactions.findIndex((t) => types.includes(t.type))
  return transactions.slice(0, index + 1)
}
