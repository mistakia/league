import { constants } from '#libs-shared'
import getTransactionsSinceFreeAgent from './get-transactions-since-free-agent.mjs'

export default async function ({ lid, pid }) {
  const transactions = await getTransactionsSinceFreeAgent({
    lid,
    pid,
    include_restricted: true
  })
  const extensions = transactions.filter(
    (t) => t.type === constants.transactions.EXTENSION
  )
  return extensions
}
