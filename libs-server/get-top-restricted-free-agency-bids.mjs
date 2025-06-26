import db from '#db'
import { constants } from '#libs-shared'

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
 * @param {string|number} leagueId - The league ID to check
 * @returns {Promise<Array>} Array of restricted free agency bids ready to be processed
 */
export default async function get_top_restricted_free_agency_bids(leagueId) {
  // Find players with announced restricted free agency bids that don't have any successful bids yet
  const active_rfa_players = await db('restricted_free_agency_bids')
    .where({
      lid: leagueId,
      year: constants.season.year
    })
    .whereNotNull('announced')
    .whereNotExists(function () {
      this.select('*')
        .from('restricted_free_agency_bids as successful_bids')
        .whereRaw('successful_bids.pid = restricted_free_agency_bids.pid')
        .where({
          'successful_bids.succ': true,
          'successful_bids.year': constants.season.year
        })
    })

  const active_rfa_pids = active_rfa_players.map((p) => p.pid)

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
      year: constants.season.year
    })
    .whereIn('pid', active_rfa_pids)
    .whereNull('cancelled')
    .whereNull('processed')

  if (!restricted_free_agency_bid_rows.length) {
    return []
  }

  // Calculate effective bid amount for each bid
  // Original team (player_tid === tid) gets a boost
  restricted_free_agency_bid_rows.forEach((bid) => {
    // If competing bid (not original team), use actual bid amount
    if (bid.player_tid !== bid.tid) {
      bid._bid = bid.bid
      return
    }

    // For original team, boost bid by 20% or $2, whichever is greater
    const percentage_boost = Math.round(
      bid.bid * ORIGINAL_TEAM_BID_BOOST_PERCENT
    )
    const boost_amount = Math.max(
      ORIGINAL_TEAM_MIN_BOOST_DOLLARS,
      percentage_boost
    )
    bid._bid = bid.bid + boost_amount
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
