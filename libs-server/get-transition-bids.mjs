import db from '#db'
import { constants } from '#libs-shared'

export default async function ({ userId, leagueId }) {
  const query1 = await db('teams')
    .select('teams.*')
    .join('users_teams', 'teams.uid', 'users_teams.tid')
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

    return bids
  }

  return []
}
