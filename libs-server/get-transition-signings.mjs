import db from '#db'

export default async function ({ lid, year = null }) {
  const transition_bids_query = db('transition_bids')
    .select(
      db.raw('*, DATE_FORMAT(FROM_UNIXTIME(processed), "%Y-%m-%d") AS date')
    )
    .where({
      succ: 1,
      lid
    })

  if (year) {
    transition_bids_query.where({ year })
  }

  const transition_bids = await transition_bids_query

  return transition_bids
}
