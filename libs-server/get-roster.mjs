import { uniqBy, constants } from '#libs-shared'
import db from '#db'

export default async function ({
  tid,
  week = constants.season.fantasy_season_week,
  year = constants.season.year
}) {
  const rows = await db('rosters').where({ tid, year, week })
  const roster_row = rows[0]
  const players = await db('rosters_players')
    .leftJoin('transactions', 'rosters_players.pid', 'transactions.pid')
    .where('rid', roster_row.uid)
    .where('transactions.tid', tid)
    .orderBy('transactions.timestamp', 'desc')
    .orderBy('transactions.uid', 'desc')

  roster_row.players = uniqBy(players, 'pid')

  if (week === 0) {
    const pids = players.map((p) => p.pid)

    // TODO - get extension count for player
    const transactions = await db('transactions')
      .where('tid', tid)
      .whereIn('pid', pids)
      .where('type', constants.transactions.EXTENSION)

    if (transactions.length) {
      for (const roster_player of roster_row.players) {
        const matches = transactions.filter((p) => p.pid === roster_player.pid)
        roster_player.extensions = matches.length
      }
    }

    const bids = await db('transition_bids')
      .where('tid', tid)
      .where('year', constants.season.year)
      .whereNull('cancelled')

    if (bids.length) {
      for (const roster_player of roster_row.players) {
        const { bid } = bids.find((b) => b.pid === roster_player.pid) || {}
        roster_player.bid = bid
      }
    }
  }

  return roster_row
}
