export const matchup_types = {
  H2H: 1,
  TOURNAMENT: 2
}

export const waiver_types = {
  FREE_AGENCY: 1,
  POACH: 2,
  FREE_AGENCY_PRACTICE: 3
}

export const waiver_type_display_names = {
  1: 'Active Roster',
  2: 'Poach',
  3: 'Practice Squad'
}

export const transaction_types = {
  ROSTER_ADD: 14,
  ROSTER_RELEASE: 1,

  ROSTER_ACTIVATE: 2,
  ROSTER_DEACTIVATE: 3,

  TRADE: 4,

  POACHED: 5,

  AUCTION_BID: 6,
  AUCTION_PROCESSED: 7,

  DRAFT: 8,

  EXTENSION: 9,
  RESTRICTED_FREE_AGENCY_TAG: 10,
  FRANCHISE_TAG: 11,
  ROOKIE_TAG: 12,

  PRACTICE_ADD: 13,

  RESERVE_IR: 15,
  RESERVE_COV: 16,
  PRACTICE_PROTECTED: 17,
  RESERVE_LONG_TERM: 18,

  SUPER_PRIORITY: 19,

  TRADE_REVERSAL: 20
}

// Keyed by `transaction_types` value. Annotated so a checked consumer can index
// it with a transaction type read off a row rather than a literal.
/** @type {Record<number, string>} */
export const transaction_type_display_names = {
  14: 'Signed',
  1: 'Released',

  2: 'Activated',
  3: 'Deactivated',

  4: 'Traded',

  5: 'Poached',

  6: 'Bid',
  7: 'Signed',

  8: 'Drafted',

  9: 'Extended',
  10: 'Signed (RFA)',
  11: 'Franchised',
  12: 'Rookie Tag',
  13: 'Signed (PS)',
  15: 'Reserve (IR)',
  16: 'Reserve (COV)',
  17: 'Protected (PS)',
  18: 'Reserve (IR LT)',
  19: 'Super Priority',
  20: 'Trade Vetoed'
}

// The types by which a team ACQUIRES a player. Everything between one of these
// and the next belongs to a single spell on that team's roster, which is the
// window get-transactions-since-acquisition.mjs returns and the window the
// practice squad's drafted-rookie exemption is judged over.
//
// Shared because the deactivate confirmation dialog mirrors that judgement to
// decide whether to offer a release, and a copy of this list that drifts from
// the server's would silently change which players the UI asks the manager to
// drop.
export const acquisition_transaction_types = [
  transaction_types.ROSTER_ADD,
  transaction_types.TRADE,
  transaction_types.POACHED,
  transaction_types.AUCTION_PROCESSED,
  transaction_types.DRAFT,
  transaction_types.PRACTICE_ADD
]

export const player_tag_types = {
  REGULAR: 1,
  FRANCHISE: 2,
  ROOKIE: 3,
  RESTRICTED_FREE_AGENCY: 4
}

export const player_tag_display_names = {
  1: 'Regular',
  2: 'Franchise',
  3: 'Rookie',
  4: 'Restricted Free Agency'
}

// seasons.tag2/tag3/tag4 conformed to full-word columns that no longer share
// a `tag${n}` prefix with the tag type id -- see roster.mjs for the computed
// key this replaced.
export const tag_limit_season_columns = {
  [player_tag_types.FRANCHISE]: 'franchise_tag_limit',
  [player_tag_types.ROOKIE]: 'rookie_tag_limit',
  [player_tag_types.RESTRICTED_FREE_AGENCY]: 'restricted_free_agency_tag_limit'
}
