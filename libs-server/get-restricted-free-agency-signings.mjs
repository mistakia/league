import db from '#db'

export default async function ({ lid, year = null }) {
  const restricted_free_agency_bids_query = db('restricted_free_agency_bids')
    .select(
      '*',
      db.raw("TO_CHAR(TO_TIMESTAMP(processed), 'YYYY-MM-DD') AS date")
    )
    .where({
      succ: true,
      lid
    })

  if (year) {
    restricted_free_agency_bids_query.where({ year })
  }

  const restricted_free_agency_bids = await restricted_free_agency_bids_query

  return restricted_free_agency_bids
}
