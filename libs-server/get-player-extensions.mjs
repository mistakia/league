import { transaction_types } from '#constants'
import getTransactionsSinceFreeAgent from './get-transactions-since-free-agent.mjs'

export default async function ({ lid, pid }) {
  const transactions = await getTransactionsSinceFreeAgent({
    lid,
    pid,
    include_restricted: true
  })
  const extensions = transactions.filter(
    (t) => t.type === transaction_types.EXTENSION
  )
  return extensions
}
