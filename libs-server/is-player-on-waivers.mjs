import dayjs from 'dayjs'
import db from '#db'
import { isOnReleaseWaivers } from '#libs-shared'
import { transaction_types } from '#constants'

export default async function ({ pid, leagueId }) {
  // get last two transactions for player
  // transactions.occurred_at is timestamptz, so the bound is a Date.
  const cutoff = dayjs().subtract('48', 'hours').toDate()
  const transactions = await db('transactions')
    .where({
      lid: leagueId,
      pid
    })
    .whereNot('type', transaction_types.ROSTER_ACTIVATE)
    .where('occurred_at', '>', cutoff)
    .orderBy('occurred_at', 'desc')
    .orderBy('uid', 'desc')
    .limit(2)

  return isOnReleaseWaivers({ transactions })
}
