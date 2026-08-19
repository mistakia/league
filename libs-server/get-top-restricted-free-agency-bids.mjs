import db from '#db'
import { current_season } from '#constants'
import get_restricted_free_agency_nominations from './get-restricted-free-agency-nominations.mjs'

// Define constants for better readability
const ORIGINAL_TEAM_BID_BOOST_PERCENT = 0.2
const ORIGINAL_TEAM_MIN_BOOST_DOLLARS = 2

/**
 * Get the highest priority restricted free agency bids for a league that are ready to be processed.
 * This function finds active restricted free agents and selects the top bid(s) for processing.
 *
 * Exactly one auction is returned per call -- the one whose nomination was
 * announced earliest, so a backlog of ready windows settles in window order.
 * The caller settles it and calls again for the next.
 *
 * Original team bids get a boost of 20% or $2, whichever is greater. Every bid
 * tied at that auction's maximum effective amount is returned, leaving the
 * original-team and waiver-order rules to the caller.
 *
 * Each returned bid carries `original_team_id`, resolved through the player's
 * nomination. The rights holder is a property of the auction, not of a bid: two
 * of the 166 historical auctions have bid rows that disagree on it, because the
 * player was traded and a bid against the previous holder was later cancelled.
 *
 * @param {string|number} leagueId - The league ID to check
 * @returns {Promise<object[]>} Array of restricted free agency bids ready to be processed
 */
export default async function get_top_restricted_free_agency_bids(leagueId) {
  const nominations_by_pid = await get_restricted_free_agency_nominations({
    lid: leagueId
  })

  // Only announced players have an open window; an unannounced nomination is
  // not yet biddable and must never reach the processing loop.
  const announced_pids = Object.keys(nominations_by_pid).filter(
    (pid) => nominations_by_pid[pid].announced
  )

  if (!announced_pids.length) {
    return []
  }

  // Find announced restricted free agents that don't have a successful bid yet
  const settled_pid_rows = await db('restricted_free_agency_bids')
    .select('pid')
    .where({
      lid: leagueId,
      season_year: current_season.year,
      is_successful: true
    })

  const settled_pids = new Set(settled_pid_rows.map((row) => row.pid))
  const active_rfa_pids = announced_pids.filter((pid) => !settled_pids.has(pid))

  // If no active restricted free agents, return empty array
  if (!active_rfa_pids.length) {
    return []
  }

  // Get all unprocessed, uncancelled bids for active RFA players
  const restricted_free_agency_bid_rows = await db(
    'restricted_free_agency_bids'
  )
    .where({
      lid: leagueId,
      season_year: current_season.year
    })
    .whereIn('pid', active_rfa_pids)
    .whereNull('cancelled')
    .whereNull('processed')

  if (!restricted_free_agency_bid_rows.length) {
    return []
  }

  // Calculate effective bid amount for each bid
  // The original team gets a boost
  restricted_free_agency_bid_rows.forEach((bid) => {
    const { original_team_id } = nominations_by_pid[bid.pid]
    bid.original_team_id = original_team_id

    // If competing bid (not original team), use actual bid amount
    if (original_team_id !== bid.tid) {
      bid._bid = bid.bid_amount
      return
    }

    // For original team, boost bid by 20% or $2, whichever is greater
    const percentage_boost = Math.round(
      bid.bid_amount * ORIGINAL_TEAM_BID_BOOST_PERCENT
    )
    const boost_amount = Math.max(
      ORIGINAL_TEAM_MIN_BOOST_DOLLARS,
      percentage_boost
    )
    bid._bid = bid.bid_amount + boost_amount
  })

  // Choose WHICH auction settles next by window order -- the nomination
  // announced earliest -- and only then find the top bids within it.
  //
  // This used to take the globally highest effective bid across every open
  // auction and settle that one first. Under normal operation the two agree,
  // because a window's bids are processed
  // `restricted_free_agency_processing_lead_hours` before the next window
  // opens, so exactly one auction is ever open at a time. They diverge only
  // when several windows are ready at once -- which is precisely what a
  // processing pause, an outage, or a late manual announcement produces.
  //
  // Three things went wrong in that state, and window order fixes all three.
  //
  // Settling out of order changes OUTCOMES rather than merely the sequence:
  // signing a player consumes cap space and a roster slot, so an auction
  // settled early can starve a team's bid in an auction that
  // constitutionally preceded it.
  //
  // The caller filters the returned bids against their own window's
  // processing time and skips the whole league when none are due. Selecting
  // by bid amount could therefore return a not-yet-due auction and mask an
  // earlier one that WAS due, deferring the earlier auction until the richer
  // one matured. The earliest-announced auction is by construction the first
  // to come due, so that filter is coherent now.
  //
  // And the tiebreak here was a no-op: pids are strings
  // (`DRAK-LOND-025029`), so `(a, b) => a - b` yields NaN for every
  // comparison, which `sort` reads as "equal" and leaves the array in
  // whatever order the database happened to return. Ties resolve explicitly
  // now.
  const biddable_pids = [
    ...new Set(restricted_free_agency_bid_rows.map((bid) => bid.pid))
  ]

  const next_pid = biddable_pids.sort((pid_first, pid_second) => {
    const announced_delta =
      nominations_by_pid[pid_first].announced -
      nominations_by_pid[pid_second].announced
    if (announced_delta !== 0) return announced_delta

    // Two auctions sharing an announcement timestamp is unreachable today --
    // claim_league_notification holds one announcement per (league, season,
    // window timestamp) -- but a tie must still resolve deterministically
    // rather than by row order.
    if (pid_first < pid_second) return -1
    if (pid_first > pid_second) return 1
    return 0
  })[0]

  // Within that auction, return every bid tied at the maximum effective
  // amount (the original team's boost is already applied above) so the caller
  // can apply the original-team and waiver-order rules.
  const auction_bids = restricted_free_agency_bid_rows.filter(
    (bid) => bid.pid === next_pid
  )
  const max_bid = Math.max(...auction_bids.map((bid) => bid._bid))

  return auction_bids.filter((bid) => bid._bid === max_bid)
}
