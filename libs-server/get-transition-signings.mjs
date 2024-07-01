import db from '#db'

export default async function ({ lid, year = null }) {
  const transition_bids_query = db('transition_bids')
    .select(
      '*',
      db.raw("TO_CHAR(TO_TIMESTAMP(processed), 'YYYY-MM-DD') AS date")
    )
    .where({
      succ: true,
      lid
    })

  if (year) {
    transition_bids_query.where({ year })
  }

  const transition_bids = await transition_bids_query

  return transition_bids
}
