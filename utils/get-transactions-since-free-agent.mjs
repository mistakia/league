import { constants } from '#common'
import db from '#db'

export default async function ({ lid, pid }) {
  const transactions = await db('transactions')
    .where({
      lid,
      pid
    })
    .orderBy('timestamp', 'desc')
    .orderBy('uid', 'desc')

  const types = [
    constants.transactions.ROSTER_ADD,
    constants.transactions.AUCTION_PROCESSED,
    constants.transactions.PRACTICE_ADD
  ]
  const index = transactions.findIndex((t) => types.includes(t.type))
  if (index === -1) return transactions
  return transactions.slice(0, index + 1)
}
