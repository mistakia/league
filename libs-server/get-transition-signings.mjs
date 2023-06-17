import db from '#db'

export default async function ({ lid }) {
  const transition_bids = await db('transition_bids')
    .select(
      db.raw('*, DATE_FORMAT(FROM_UNIXTIME(processed), "%Y-%m-%d") AS date')
    )
    .where({
      succ: 1,
      lid
    })

  return transition_bids
}
