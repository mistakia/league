const db = require('../db')

module.exports = async function ({ lid, player, tid }) {
  const transactions = await db('transactions')
    .orderBy('transactions.timestamp', 'desc')
    .orderBy('transactions.uid', 'desc')
    .where({
      player,
      lid,
      tid
    })
    .limit(1)

  return transactions ? transactions[0] : {}
}
