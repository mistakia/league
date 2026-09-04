import { acquisition_transaction_types } from '#constants'
import db from '#db'

export default async function ({ lid, pid, tid }) {
  const transactions = await db('transactions')
    .where({
      lid,
      tid,
      pid
    })
    .orderBy('occurred_at', 'desc')
    .orderBy('transaction_id', 'desc')

  const index = transactions.findIndex((t) =>
    acquisition_transaction_types.includes(t.type)
  )
  return transactions.slice(0, index + 1)
}
