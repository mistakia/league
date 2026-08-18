import db from '#db'

export default async function ({ lid, pid, tid }) {
  const transactions = await db('transactions')
    .orderBy('transactions.occurred_at', 'desc')
    .orderBy('transactions.transaction_id', 'desc')
    .where({
      pid,
      lid,
      tid
    })
    .limit(1)

  return transactions ? transactions[0] : {}
}
