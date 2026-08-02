import { uniqBy } from '#libs-shared'
import { current_season, transaction_types, player_tag_types } from '#constants'
import db from '#db'
import { build_active_restricted_free_agency_bids_query } from './restricted-free-agency-bids-query.mjs'

// A rostered player's salary is `transactions.value` -- `rosters_players` carries no
// value column -- so the transaction is the only source of the salary that `Roster`
// sums into `availableCap`. That makes this an INNER join by design, not a degraded
// LEFT join: admitting a player with no team transaction would hand `Roster` an
// undefined value and turn the cap arithmetic into NaN.
//
// A roster is a snapshot of one (year, week), so the salary in force at that snapshot
// comes from the newest transaction dated at or before it. Without the `(year, week)`
// bound the lookup reaches forward in time and a historical roster reports a salary
// that had not been agreed yet -- an extension signed in a later season would be
// backdated onto every earlier roster the player appears on.
//
// Both the team id and the as-of bound qualify which transactions may match rather
// than filtering the result, so both belong in the ON clause. The ordering feeds the
// `uniqBy` below, which keeps the newest surviving row per player.
export const build_roster_players_query = ({ db, rid, tid, year, week }) =>
  db('rosters_players')
    .join('transactions', function () {
      this.on('rosters_players.pid', '=', 'transactions.pid')
        .andOnVal('transactions.tid', '=', tid)
        .andOn(
          db.raw('(transactions.year, transactions.week) <= (?, ?)', [
            year,
            week
          ])
        )
    })
    .where('rid', rid)
    .orderBy('transactions.timestamp', 'desc')
    .orderBy('transactions.uid', 'desc')

export default async function ({
  tid,
  week = current_season.fantasy_season_week,
  year = current_season.year
}) {
  const rows = await db('rosters').where({ tid, year, week })
  const roster_row = rows[0]

  if (!roster_row) {
    throw new Error('No roster found')
  }

  const players = await build_roster_players_query({
    db,
    rid: roster_row.uid,
    tid,
    year: roster_row.year,
    week: roster_row.week
  })

  roster_row.players = uniqBy(players, 'pid')

  if (week === 0) {
    const pids = players.map((p) => p.pid)

    // TODO - get extension count for player
    const transactions = await db('transactions')
      .where('tid', tid)
      .whereIn('pid', pids)
      .where('type', transaction_types.EXTENSION)

    if (transactions.length) {
      for (const roster_player of roster_row.players) {
        const matches = transactions.filter((p) => p.pid === roster_player.pid)
        roster_player.extensions = matches.length
      }
    }

    // Own-player bids only, and only live ones -- this `bid` becomes the player's
    // cap charge through `getExtensionAmount`, so a settled bid must not reach it.
    const bids = await build_active_restricted_free_agency_bids_query({
      db,
      tid
    }).where('player_tid', tid)

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
        if (
          bid &&
          roster_player.tag === player_tag_types.RESTRICTED_FREE_AGENCY
        ) {
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
      (p) => p.tag === player_tag_types.RESTRICTED_FREE_AGENCY
    )
    if (restricted_free_agency_tagged_players.length) {
      const restricted_free_agency_bids = await db(
        'restricted_free_agency_bids'
      )
        .select('pid', 'processed', 'nominated', 'announced', 'player_tid')
        .where({
          player_tid: tid,
          year: current_season.year
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
