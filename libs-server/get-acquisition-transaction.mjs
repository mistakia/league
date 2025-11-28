import { transaction_types } from '#constants'
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
    transaction_types.ROSTER_ADD,
    transaction_types.TRADE,
    transaction_types.POACHED,
    transaction_types.AUCTION_PROCESSED,
    transaction_types.DRAFT,
    transaction_types.PRACTICE_ADD,
    transaction_types.RESTRICTED_FREE_AGENCY_TAG
  ]

  return transactions.find((t) => types.includes(t.type))
}
