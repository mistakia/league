import db from '#db'
import { constants } from '#common'

export default async function ({ players, userId, leagueId }) {
  // include player restricted free agency bid

  const query1 = await db('teams')
    .select('teams.*')
    .join('users_teams', 'teams.uid', 'users_teams.tid')
    .where('users_teams.userid', userId)
    .where('teams.lid', leagueId)

  if (query1.length) {
    const tid = query1[0].uid
    const bids = await db('transition_bids')
      .where('tid', tid)
      .where('year', constants.season.year)
      .whereNull('cancelled')
      .whereNull('processed')

    if (bids.length) {
      for (const player of players) {
        const { bid } = bids.find((b) => b.player === player.player) || {}
        player.bid = bid
      }
    }
  }
}
