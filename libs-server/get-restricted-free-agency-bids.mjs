import db from '#db'
import { current_season } from '#constants'

export default async function ({ userId, leagueId }) {
  const query1 = await db('teams')
    .select('teams.*')
    .join('users_teams', function () {
      this.on('teams.uid', '=', 'users_teams.tid').andOn(
        'teams.year',
        '=',
        'users_teams.year'
      )
    })
    .where('users_teams.userid', userId)
    .where('teams.lid', leagueId)
    .where('teams.year', current_season.year)

  if (query1.length) {
    const tid = query1[0].uid
    const bids = await db('restricted_free_agency_bids')
      .where('tid', tid)
      .where('year', current_season.year)
      .whereNull('cancelled')
      .whereNull('processed')

    if (bids.length) {
      // Get conditional releases for all restricted free agency bids
      const restricted_free_agency_releases = await db(
        'restricted_free_agency_releases'
      ).whereIn(
        'restricted_free_agency_bid_id',
        bids.map((b) => b.uid)
      )

      // Map releases to bids
      for (const bid of bids) {
        const releases = restricted_free_agency_releases.filter(
          (r) => r.restricted_free_agency_bid_id === bid.uid
        )
        if (releases.length) {
          bid.restricted_free_agency_conditional_releases = releases.map(
            (r) => r.pid
          )
        }
      }
    }

    return bids
  }

  return []
}
