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
 * Original team bids get a boost of 20% or $2, whichever is greater.
 * If multiple bids have the same maximum amount, they are sorted by player ID.
 *
 * Each returned bid carries `original_team_id`, resolved through the player's
 * nomination. The rights holder is a property of the auction, not of a bid: two
 * of the 166 historical auctions have bid rows that disagree on it, because the
 * player was traded and a bid against the previous holder was later cancelled.
 *
 * @param {string|number} leagueId - The league ID to check
 * @returns {Promise<Array>} Array of restricted free agency bids ready to be processed
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
    .where({ lid: leagueId, year: current_season.year, is_successful: true })

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
      year: current_season.year
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

  // Find highest restricted free agency bids
  const bid_amounts = restricted_free_agency_bid_rows.map((bid) => bid._bid)
  const max_bid = Math.max(...bid_amounts)
  const max_bids = restricted_free_agency_bid_rows.filter(
    (bid) => bid._bid === max_bid
  )

  // If more than one bid with the same amount, process player based on player ID order
  const max_pids = max_bids.map((bid) => bid.pid)
  const sorted_pids = max_pids.sort((a, b) => a - b)
  const top_pid = sorted_pids[0]

  // Return all bids for the top priority player
  return max_bids.filter((bid) => bid.pid === top_pid)
}
