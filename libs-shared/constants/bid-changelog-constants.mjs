// Vocabulary for `bid_changelog`, the append-only audit trail of every mutation
// to a bid row.
//
// Two bid tables have the same shape and the same defect: `waivers` and
// `restricted_free_agency_bids` are both mutated IN PLACE, so an amount change
// overwrites its predecessor with no trace and nothing can answer "what was this
// manager's bid at time T, and who changed it". `bid_type` is what lets one
// trail serve both rather than growing a second bespoke one; only the restricted
// free agency writers are wired to it today.
//
// The server writes only these codes. As with the restricted free agency
// outcome vocabulary, the client owns every human-readable label, and nothing
// stores a presentation string where a code belongs.

// Which bid table `bid_changelog.bid_id` points into.
export const bid_types = {
  RESTRICTED_FREE_AGENCY: 'restricted_free_agency',
  WAIVER: 'waiver'
}

export const bid_type_values = Object.values(bid_types)

// WHAT happened to the bid. One row per mutation event, not per field: a single
// request that changes both the amount and the conditional releases is one
// UPDATED row, because it was one decision by one manager at one instant.
export const bid_change_types = {
  // the bid row was inserted
  CREATED: 'created',
  // the amount and/or the conditional releases were changed
  UPDATED: 'updated',
  // the bid was withdrawn before settlement
  CANCELLED: 'cancelled',
  // the auction resolved this bid, won or lost
  SETTLED: 'settled',
  // reconstructed from a daily backup rather than observed live; the state is
  // real, the instant is only accurate to the snapshot
  BACKFILLED_SNAPSHOT: 'backfilled_snapshot'
}

export const bid_change_type_values = Object.values(bid_change_types)

// WHY it happened — the code path that made the change. This is not redundant
// with the change type: a cancellation arrives from two different decisions.
// api_bid_cancel is a manager withdrawing a bid; api_bid_create is the same
// manager's bid being dropped because they tagged a different player in its
// place, which is the case a manager reads as "my bid was reset".
export const bid_change_sources = {
  API_BID_CREATE: 'api_bid_create',
  API_BID_UPDATE: 'api_bid_update',
  API_BID_CANCEL: 'api_bid_cancel',
  SETTLEMENT_SCRIPT: 'settlement_script',
  // An operator changing a row by hand, with no route and no user request
  // behind it. This is a real class rather than a defensive placeholder: league
  // 1's uid 600 was cancelled directly in production on 2026-08-05 to clear a
  // duplicate bid a display defect had caused a manager to submit twice. An
  // audit trail whose vocabulary cannot express "a human edited the database"
  // records such a change as whichever API path it least resembles, which is
  // worse than recording it as unexplained.
  MANUAL_DATABASE_CORRECTION: 'manual_database_correction',
  // Reconstructed from the daily pg_dump backups; see
  // db/adhoc/2026-08-05-backfill-bid-changelog-from-snapshots.sql for what that
  // reconstruction can and cannot see.
  DAILY_SNAPSHOT_BACKFILL: 'daily_snapshot_backfill',
  // The floor row written for every bid that already existed when the trail was
  // created, snapshotting the live table at that instant. Distinct from
  // daily_snapshot_backfill because it is read from the live table rather than
  // from a backup, so it is the one reconstructed source that cannot be stale.
  INITIAL_TABLE_SEED: 'initial_table_seed'
}

export const bid_change_source_values = Object.values(bid_change_sources)

export const is_valid_bid_type = (bid_type) =>
  bid_type_values.includes(bid_type)

export const is_valid_bid_change_type = (change_type) =>
  bid_change_type_values.includes(change_type)

export const is_valid_bid_change_source = (change_source) =>
  bid_change_source_values.includes(change_source)
