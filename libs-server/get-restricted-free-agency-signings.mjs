import db from '#db'

// `original_team_id` comes from the nomination rather than the bid row. It is
// the team that LOSES the player on a cross-team win, and callers read it off
// the returned object -- so it must be projected here, where the table is
// named, or no grep of `restricted_free_agency_bids` will ever reach them.
export default async function ({ lid, year = null }) {
  const restricted_free_agency_bids_query = db('restricted_free_agency_bids')
    .select(
      'restricted_free_agency_bids.*',
      'restricted_free_agency_nominations.original_team_id',
      // `processed` is timestamptz, so it goes straight to TO_CHAR. The
      // TO_TIMESTAMP wrapper that converted it from epoch seconds now has no
      // matching signature at all -- `function to_timestamp(timestamp with
      // time zone) does not exist` -- which fails the whole statement rather
      // than just this projection.
      db.raw(
        "TO_CHAR(restricted_free_agency_bids.processed, 'YYYY-MM-DD') AS date"
      )
    )
    .leftJoin(
      'restricted_free_agency_nominations',
      'restricted_free_agency_nominations.nomination_id',
      'restricted_free_agency_bids.nomination_id'
    )
    .where({
      is_successful: true,
      'restricted_free_agency_bids.lid': lid
    })

  if (year) {
    restricted_free_agency_bids_query.where({
      'restricted_free_agency_bids.season_year': year
    })
  }

  const restricted_free_agency_bids = await restricted_free_agency_bids_query

  return restricted_free_agency_bids
}
