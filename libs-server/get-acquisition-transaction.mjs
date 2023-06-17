import { constants } from '#libs-shared'
import db from '#db'

export default async function ({ lid, pid, tid, year, week }) {
  const query = db('transactions')
    .where({
      lid,
      tid,
      pid
    })
    .orderBy('timestamp', 'desc')
    .orderBy('uid', 'desc')

  if (year) {
    query.where(function () {
      this.where(function () {
        this.where('year', year)
        this.where('week', '<=', week || 0)
      }).orWhere(function () {
        this.where('year', '<', year)
      })
    })
  }

  const transactions = await query

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
