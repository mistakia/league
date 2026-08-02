// Outcome vocabulary for a settled restricted free agency bid.
//
// This is a closed set of codes, deliberately replacing the free-text `reason`
// column the processing script used to write. The old column carried whatever
// string happened to be in scope -- two hardcoded sentences plus `error.message`
// from `process-restricted-free-agency-bid.mjs` -- so the database's vocabulary
// was an accident of exception text and every losing bid in an ordinary auction
// got the same misleading line ('player no longer a restricted free agent')
// whether it was outbid, matched, or lost a waiver-order tiebreak.
//
// The server writes only these codes; the client owns every human-readable
// label. Nothing branches on `outcome_detail`, which exists solely to carry an
// unexpected error message alongside PROCESSING_ERROR.
export const restricted_free_agency_bid_outcomes = {
  // this bid signed the player
  WON: 'won',
  // the original team exercised its right of first refusal
  MATCHED: 'matched',
  // a strictly higher bid won the auction
  OUTBID: 'outbid',
  // tied the winning amount and lost on waiver order
  LOST_TIEBREAK: 'lost_tiebreak',
  // bid was winning but failed the roster or salary cap check
  ROSTER_LIMIT_VIOLATION: 'roster_limit_violation',
  // player left the original roster or lost restricted free agent status
  PLAYER_INELIGIBLE: 'player_ineligible',
  // unexpected failure during processing; message in outcome_detail
  PROCESSING_ERROR: 'processing_error'
}

export const restricted_free_agency_bid_outcome_values = Object.values(
  restricted_free_agency_bid_outcomes
)

export const restricted_free_agency_bid_outcome_display_names = {
  [restricted_free_agency_bid_outcomes.WON]: 'Won',
  // Neither 'Matched' nor 'Outbid', and both were tried. The original team does
  // not match an amount here and does not have to beat one: any bid it submits
  // wins outright (`original_team_bid || bids[0]` in
  // `scripts/process-restricted-free-agency-bids.mjs`), so it can retain the
  // player for LESS than a competing bid. Across 2021-2025, 23 of the 125 bids
  // carrying this code were at or above the winning amount -- Derrick Henry
  // 2024 was kept at $48 over bids of $51 and $50 -- so either label is
  // contradicted by the numbers on the same row. 'Outbid' is the worse of the
  // two even where the amounts happen to agree, because it tells a manager to
  // bid more next time and no amount would have won.
  [restricted_free_agency_bid_outcomes.MATCHED]: 'Lost to Original',
  [restricted_free_agency_bid_outcomes.OUTBID]: 'Outbid',
  [restricted_free_agency_bid_outcomes.LOST_TIEBREAK]: 'Lost Tiebreak',
  [restricted_free_agency_bid_outcomes.ROSTER_LIMIT_VIOLATION]:
    'Exceeded Roster Limits',
  [restricted_free_agency_bid_outcomes.PLAYER_INELIGIBLE]: 'Player Ineligible',
  [restricted_free_agency_bid_outcomes.PROCESSING_ERROR]: 'Processing Error'
}

export const restricted_free_agency_bid_outcome_descriptions = {
  [restricted_free_agency_bid_outcomes.WON]: 'This bid signed the player.',
  [restricted_free_agency_bid_outcomes.MATCHED]:
    'The original team kept the player. Any bid it submits wins the auction, so no competing bid could have won at any amount.',
  [restricted_free_agency_bid_outcomes.OUTBID]: 'A higher bid won the player.',
  [restricted_free_agency_bid_outcomes.LOST_TIEBREAK]:
    'Tied the winning bid and lost on waiver order.',
  [restricted_free_agency_bid_outcomes.ROSTER_LIMIT_VIOLATION]:
    'The bid would have exceeded roster or salary cap limits.',
  [restricted_free_agency_bid_outcomes.PLAYER_INELIGIBLE]:
    'The player was no longer an eligible restricted free agent.',
  [restricted_free_agency_bid_outcomes.PROCESSING_ERROR]:
    'The bid failed with an unexpected error during processing.'
}

export const is_winning_restricted_free_agency_bid_outcome = (outcome) =>
  outcome === restricted_free_agency_bid_outcomes.WON

export const is_valid_restricted_free_agency_bid_outcome = (outcome) =>
  restricted_free_agency_bid_outcome_values.includes(outcome)
