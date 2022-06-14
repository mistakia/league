import { constants } from '#common'
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
    constants.transactions.ROSTER_ADD,
    constants.transactions.TRADE,
    constants.transactions.POACHED,
    constants.transactions.AUCTION_PROCESSED,
    constants.transactions.DRAFT,
    constants.transactions.PRACTICE_ADD,
    constants.transactions.TRANSITION_TAG
  ]

  return transactions.find((t) => types.includes(t.type))
}
