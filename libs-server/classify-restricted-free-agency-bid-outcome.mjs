import { restricted_free_agency_bid_outcomes } from '#constants'

// Derive why a settled restricted free agency bid did not sign the player.
//
// This replaces the blanket `reason: 'player no longer a restricted free agent'`
// that `scripts/process-restricted-free-agency-bids.mjs` wrote to every losing
// bid in an auction. That sentence is true of all three ordinary loss cases and
// distinguishes none of them, which is precisely the information a manager
// reading the auction back wants.
//
// The classification is decided entirely by the resolved auction: who won, for
// how much, and whether the winner held the player's rights. Waiver order does
// not need to be re-derived -- `process-restricted-free-agency-bids.mjs` only
// consults it when the top bids are tied, so an equal amount IS the tiebreak
// signature.
//
// Amounts coalesce with `?? 0` rather than being trusted: `bid` is nullable, and
// an undefined flowing into a comparison yields false on BOTH `<` and `===`,
// which would silently drop every such bid into the fallback.
export default function classify_restricted_free_agency_bid_outcome({
  winning_bid,
  losing_bid,
  original_team_id
}) {
  // No winner means the auction resolved without a signing, so nothing more
  // specific than the legacy meaning can be claimed.
  if (!winning_bid) {
    return restricted_free_agency_bid_outcomes.PLAYER_INELIGIBLE
  }

  if (
    losing_bid.bid_id &&
    winning_bid.bid_id &&
    losing_bid.bid_id === winning_bid.bid_id
  ) {
    return restricted_free_agency_bid_outcomes.WON
  }

  // Right of first refusal takes precedence over amount: when the original team
  // wins, every competing bid was matched regardless of what it offered.
  if (winning_bid.tid === original_team_id) {
    return restricted_free_agency_bid_outcomes.MATCHED
  }

  const losing_amount = losing_bid.bid_amount ?? 0
  const winning_amount = winning_bid.bid_amount ?? 0

  if (losing_amount < winning_amount) {
    return restricted_free_agency_bid_outcomes.OUTBID
  }

  if (losing_amount === winning_amount) {
    return restricted_free_agency_bid_outcomes.LOST_TIEBREAK
  }

  // A losing bid above the winning amount is not reachable through the normal
  // processing loop -- a higher bid is always processed first and settles with
  // its own outcome. Degrade to the legacy meaning rather than asserting a
  // ranking the auction never performed.
  return restricted_free_agency_bid_outcomes.PLAYER_INELIGIBLE
}
