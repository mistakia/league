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

    // for RFA tagged players, get if their tag is processed, nominated, or announced
    const transition_tagged_players = roster_row.players.filter(
      (p) => p.tag === constants.tags.TRANSITION
    )
    if (transition_tagged_players.length) {
      const transition_bids = await db('transition_bids')
        .select('pid', 'processed', 'nominated', 'announced')
        .where({
          player_tid: tid,
          year: constants.season.year
        })
        .whereIn(
          'pid',
          transition_tagged_players.map((p) => p.pid)
        )
        .whereNull('cancelled')

      for (const roster_player of transition_tagged_players) {
        const bid = transition_bids.find((b) => b.pid === roster_player.pid)
        if (bid) {
          roster_player.transition_tag_processed = bid.processed
          roster_player.transition_tag_nominated = bid.nominated
          roster_player.transition_tag_announced = bid.announced
        }
      }
    }
  }

  return roster_row
}
