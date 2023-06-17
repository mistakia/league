import dayjs from 'dayjs'
import db from '#db'
import { isOnReleaseWaivers } from '#libs-shared'

export default async function ({ pid, leagueId }) {
  // get last two transactions for player
  const cutoff = dayjs().subtract('48', 'hours').unix()
  const transactions = await db('transactions')
    .where({
      lid: leagueId,
      pid
    })
    .where('timestamp', '>', cutoff)
    .orderBy('timestamp', 'desc')
    .orderBy('uid', 'desc')
    .limit(2)

  return isOnReleaseWaivers({ transactions })
}
