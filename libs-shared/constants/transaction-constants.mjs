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

  SUPER_PRIORITY: 19
}

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
  19: 'Super Priority'
}

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
