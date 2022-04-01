const { constants } = require('../common')
const getTransactionsSinceFreeAgent = require('./get-transactions-since-free-agent')

module.exports = async function ({ lid, player }) {
  const transactions = await getTransactionsSinceFreeAgent({ lid, player })
  const extensions = transactions.filter(
    (t) => t.type === constants.transactions.EXTENSION
  )
  return extensions
}
