import { constants } from '#common'
import getTransactionsSinceFreeAgent from './get-transactions-since-free-agent.mjs'

export default async function ({ lid, player }) {
  const transactions = await getTransactionsSinceFreeAgent({ lid, player })
  const extensions = transactions.filter(
    (t) => t.type === constants.transactions.EXTENSION
  )
  return extensions
}
