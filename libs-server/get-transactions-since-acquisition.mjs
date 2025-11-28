import { transaction_types } from '#constants'
import db from '#db'

export default async function ({ lid, pid, tid }) {
  const transactions = await db('transactions')
    .where({
      lid,
      tid,
      pid
    })
    .orderBy('timestamp', 'desc')
    .orderBy('uid', 'desc')

  const types = [
    transaction_types.ROSTER_ADD,
    transaction_types.TRADE,
    transaction_types.POACHED,
    transaction_types.AUCTION_PROCESSED,
    transaction_types.DRAFT,
    transaction_types.PRACTICE_ADD
  ]
  const index = transactions.findIndex((t) => types.includes(t.type))
  return transactions.slice(0, index + 1)
}
