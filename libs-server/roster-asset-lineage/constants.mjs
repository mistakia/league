// Roster-asset-lineage local enums. Integer values match the DDL column
// comments in db/adhoc/2026-05-20-add-roster-asset-lineage.sql.
//
// Keep ALL_CAPS keys (guideline/write-software.md); the DB stores the integer
// and JS dispatches on these constants.

export const SALARY_ATTRIBUTION_RULE = {
  NO_CAP: 0,
  AUCTION_BUDGET: 1,
  START_TEAM_BEARS: 2,
  CONTRACT_FOLLOWS: 3
}

export const ASSET_TYPE = {
  PLAYER: 1,
  PICK: 2
}

export const SALARY_BASIS = {
  AUCTION: 1,
  EXTENSION: 2,
  RFA: 3,
  FRANCHISE_TAG: 4,
  ROOKIE_TAG: 5,
  ROOKIE_CONTRACT: 6,
  PS_SALARY: 7
}

export const INITIAL_SLOT_TYPE = {
  ACTIVE: 1,
  PRACTICE_SQUAD: 2,
  RESERVE_SHORT_TERM: 3,
  RESERVE_LONG_TERM: 4,
  COV: 5
}

export const PS_SLOT_SUBTYPE = {
  DRAFTED_PS: 1,
  SIGNED_PS: 2
}

export const TRANSFORMATION_TYPE = {
  TRADE: 1,
  AUCTION: 2,
  RFA_WIN: 3,
  FRANCHISE_TAG: 4,
  ROOKIE_TAG: 5,
  EXTENSION: 6,
  DRAFT: 7,
  WAIVER_CLAIM: 8,
  FA_SIGNING: 9,
  PS_SIGNING: 10,
  POACH: 11,
  RELEASE: 12,
  PICK_CONVERSION: 13,
  SEASON_ROLLOVER: 14,
  STANDINGS_ENDOWMENT: 15,
  DECOMMISSION_REASSIGNMENT: 16,
  SUPER_PRIORITY_RESIGN: 17,
  AUTO_CAP_RELEASE: 18,
  FAILED_POACH_SANCTUARY: 19,
  PROTECT: 20
}

export const TERMINATED_BY = {
  TRADE: 1,
  RELEASE: 2,
  SEASON_END: 3,
  EXTENSION: 4,
  EXPIRED_TO_FA: 5,
  PICK_CONVERTED: 6,
  AUTO_CAP_RELEASE: 7,
  NULLIFIED_DECOMMISSION: 8,
  SUPER_PRIORITY_RESIGN: 9,
  STILL_HELD: 10
}

export const LAST_RESET_EVENT = {
  RFA_WIN: 1,
  RELEASE: 2,
  TRADED_AWAY: 3
}
