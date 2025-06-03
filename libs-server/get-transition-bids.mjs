import db from '#db'
import { constants } from '#libs-shared'

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
    .where('teams.year', constants.season.year)

  if (query1.length) {
    const tid = query1[0].uid
    const bids = await db('transition_bids')
      .where('tid', tid)
      .where('year', constants.season.year)
      .whereNull('cancelled')
      .whereNull('processed')

    if (bids.length) {
      // Get conditional releases for all transition bids
      const transition_releases = await db('transition_releases').whereIn(
        'transitionid',
        bids.map((b) => b.uid)
      )

      // Map releases to bids
      for (const bid of bids) {
        const releases = transition_releases.filter(
          (r) => r.transitionid === bid.uid
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
