import { uniqBy, constants } from '#libs-shared'
import db from '#db'

export default async function ({
  tid,
  week = constants.season.fantasy_season_week,
  year = constants.season.year
}) {
  const rows = await db('rosters').where({ tid, year, week })
  const roster_row = rows[0]

  if (!roster_row) {
    throw new Error('No roster found')
  }

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

    const bids = await db('restricted_free_agency_bids')
      .where('tid', tid)
      .where('year', constants.season.year)
      .whereNull('cancelled')

    if (bids.length) {
      // Get conditional releases for all restricted free agency bids
      const restricted_free_agency_releases = await db(
        'restricted_free_agency_releases'
      ).whereIn(
        'restricted_free_agency_bid_id',
        bids.map((b) => b.uid)
      )

      for (const roster_player of roster_row.players) {
        const bid = bids.find((b) => b.pid === roster_player.pid)
        if (bid) {
          roster_player.bid = bid.bid
          roster_player.restricted_free_agency_original_team = bid.player_tid

          // Add conditional releases for this bid
          const releases = restricted_free_agency_releases.filter(
            (r) => r.restricted_free_agency_bid_id === bid.uid
          )
          if (releases.length) {
            roster_player.restricted_free_agency_conditional_releases =
              releases.map((r) => r.pid)
          }
        }
      }
    }

    // for RFA tagged players, get if their tag is processed, nominated, or announced
    const restricted_free_agency_tagged_players = roster_row.players.filter(
      (p) => p.tag === constants.tags.RESTRICTED_FREE_AGENCY
    )
    if (restricted_free_agency_tagged_players.length) {
      const restricted_free_agency_bids = await db(
        'restricted_free_agency_bids'
      )
        .select('pid', 'processed', 'nominated', 'announced', 'player_tid')
        .where({
          player_tid: tid,
          year: constants.season.year
        })
        .whereIn(
          'pid',
          restricted_free_agency_tagged_players.map((p) => p.pid)
        )
        .whereNull('cancelled')

      for (const roster_player of restricted_free_agency_tagged_players) {
        const bid = restricted_free_agency_bids.find(
          (b) => b.pid === roster_player.pid
        )
        if (bid) {
          roster_player.restricted_free_agency_tag_processed = bid.processed
          roster_player.restricted_free_agency_tag_announced = bid.announced
          roster_player.restricted_free_agency_original_team = bid.player_tid
        }
      }
    }
  }

  return roster_row
}
