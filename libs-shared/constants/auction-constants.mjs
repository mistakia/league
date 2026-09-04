// Vocabulary for the free agency auction's election model.
//
// An election is a team's standing instruction on a player: a maximum bid, or a
// decline. It can be recorded at any point in the free agency period, before or
// after the player is nominated, and it settles second-price once every eligible
// team has elected.
//
// The outcome set follows the shape of restricted-free-agency-constants.mjs --
// an outcomes map with a per-value comment, a derived values array and a display
// name map -- for the same reason: the server writes only codes and the client
// owns every human-readable label. Nothing branches on `outcome_detail`, which
// carries the message for PROCESSING_ERROR alone.
export const auction_election_outcomes = {
  // this election signed the player
  WON: 'won',
  // a strictly higher claim won
  OUTBID: 'outbid',
  // tied the winning amount and lost on nomination order, then on who committed
  // to that amount first -- a placed BID counts, not only a stated maximum
  LOST_TIEBREAK: 'lost_tiebreak',
  // null maximum at settlement
  DECLINED: 'declined',
  // effective maximum -- min(stated, availableCap) -- fell below the price
  BUDGET_EXCEEDED: 'budget_exceeded',
  // no open active roster spot at settlement
  ROSTER_FULL: 'roster_full',
  // at the position cap for the player's position
  POSITION_LIMIT: 'position_limit',
  // swept at auction close; the player was never nominated
  NOT_NOMINATED: 'not_nominated',
  // unexpected failure during settlement; message in outcome_detail
  PROCESSING_ERROR: 'processing_error'
}

// Two values the neighbouring restricted free agency set carries that are
// deliberately absent here, because neither state can occur and a named state
// that cannot fire reads to every later reader as a case that is handled:
//
// - No `unsold`. The player opens at the nominating team's bid and a placed bid
//   BINDS, so the nominator always holds a claim in `build_auction_claims` and
//   every nominated player sells. A player nobody nominates is never processed
//   at all and takes NOT_NOMINATED at auction close.
//
//   Read that as binding and nothing else. It is NOT a statement that the
//   nomination discharges the nominator from the outstanding set -- it does
//   not, and a nominated player waits for its nominator's election like anyone
//   else's. The two were conflated once and it settled players whose nominator
//   had never named a ceiling; `get_outstanding_election_team_ids` carries the
//   argument.
// - No `player_ineligible`. In restricted free agency it means the player left
//   the original roster or lost restricted status. The auction is strictly
//   sequential with exactly one open player, that player is a free agent by
//   virtue of being nominated, and nothing else can sign them mid-nomination.
//   Construct an input that produces it before adding it back.

export const auction_election_outcome_values = Object.values(
  auction_election_outcomes
)

export const auction_election_outcome_display_names = {
  [auction_election_outcomes.WON]: 'Won',
  [auction_election_outcomes.OUTBID]: 'Outbid',
  [auction_election_outcomes.LOST_TIEBREAK]: 'Lost Tiebreak',
  [auction_election_outcomes.DECLINED]: 'Declined',
  [auction_election_outcomes.BUDGET_EXCEEDED]: 'Exceeded Budget',
  [auction_election_outcomes.ROSTER_FULL]: 'Roster Full',
  [auction_election_outcomes.POSITION_LIMIT]: 'Position Limit',
  [auction_election_outcomes.NOT_NOMINATED]: 'Not Nominated',
  [auction_election_outcomes.PROCESSING_ERROR]: 'Processing Error'
}

export const auction_election_outcome_descriptions = {
  [auction_election_outcomes.WON]: 'This election signed the player.',
  [auction_election_outcomes.OUTBID]: 'A higher maximum won the player.',
  [auction_election_outcomes.LOST_TIEBREAK]:
    'Tied the winning amount and lost on nomination order, then on which team committed to that amount first. A bid already placed counts, not just a maximum you set.',
  [auction_election_outcomes.DECLINED]:
    'You declined this player, so no maximum was in play.',
  [auction_election_outcomes.BUDGET_EXCEEDED]:
    'Available cap had fallen below the price by the time the player settled.',
  [auction_election_outcomes.ROSTER_FULL]:
    'No open active roster spot remained when the player settled.',
  [auction_election_outcomes.POSITION_LIMIT]:
    'The roster was already at the league limit for this position.',
  [auction_election_outcomes.NOT_NOMINATED]:
    'The auction ended without this player being nominated.',
  [auction_election_outcomes.PROCESSING_ERROR]:
    'Settlement failed with an unexpected error.'
}

export const is_winning_auction_election_outcome = (outcome) =>
  outcome === auction_election_outcomes.WON

export const is_valid_auction_election_outcome = (outcome) =>
  auction_election_outcome_values.includes(outcome)

// The "one increment" every price rule refers to. Hardcoded and unnamed in the
// live socket today. Distinct from `league_formats.min_bid`, which is the
// opening floor and is $0 for genesis_10_team: min_bid is where a nomination
// starts, this is what separates the winner's price from the runner-up's claim.
export const AUCTION_BID_INCREMENT = 1

// Live blocks are offered at 15-minute resolution across the whole free agency
// period. This is a constant rather than a `seasons` column because nothing
// varies it and a configuration column nothing varies is dead config.
export const AUCTION_BLOCK_GRANULARITY_MINUTES = 15

// The minimum stretch of election time the auction window must leave between the
// auction start and the final block's notice threshold. Enforced by the window
// inequality at league-season configuration write and again at auction start.
export const AUCTION_MINIMUM_ELECTION_WINDOW_HOURS = 24
