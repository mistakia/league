import db from '#db'
import { current_season } from '#constants'
import { build_active_restricted_free_agency_bids_query } from './restricted-free-agency-bids-query.mjs'

export default async function ({ userId, leagueId }) {
  const query1 = await db('teams')
    .select('teams.*')
    .join('users_teams', function () {
      this.on('teams.team_id', '=', 'users_teams.tid').andOn(
        'teams.season_year',
        '=',
        'users_teams.season_year'
      )
    })
    .where('users_teams.user_id', userId)
    .where('teams.lid', leagueId)
    .where('teams.season_year', current_season.year)

  if (query1.length) {
    const tid = query1[0].team_id
    // Every bid this team has outstanding, on its own players and on others'.
    const bids = await build_active_restricted_free_agency_bids_query({
      db,
      tid
    })

    if (bids.length) {
      // Get conditional releases for all restricted free agency bids
      const restricted_free_agency_releases = await db(
        'restricted_free_agency_releases'
      ).whereIn(
        'restricted_free_agency_bid_id',
        bids.map((b) => b.bid_id)
      )

      // Map releases to bids
      for (const bid of bids) {
        const releases = restricted_free_agency_releases.filter(
          (r) => r.restricted_free_agency_bid_id === bid.bid_id
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
