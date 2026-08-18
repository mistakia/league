import default_db from '#db'
import {
  bid_types,
  is_valid_bid_type,
  is_valid_bid_change_type,
  is_valid_bid_change_source
} from '#constants'

// Append one row to `bid_changelog` describing a mutation that just happened to
// a bid.
//
// The caller says WHO did WHAT and through which code path. It does NOT get to
// say what the bid now holds: this reads the row back and snapshots it. That is
// the whole point of the helper. A caller-supplied payload can disagree with the
// table -- the amount it MEANT to write rather than the amount that landed -- and
// an audit trail that can disagree with its subject is worse than none, because
// it is believed. Reading back inside the caller's transaction makes the wrong
// shape unwritable rather than merely unwritten.
//
// Each row carries the COMPLETE post-change state of the audited fields, not a
// sparse diff. That is what makes "what was this manager's bid at time T" a
// single query -- order by changed_at desc, limit 1 -- which is the question the
// 2026-08-05 incident could not answer without reconstructing five daily
// pg_dumps by hand. The old value is the previous row for the same bid_id
// (`lag()` over changed_at) and is deliberately not stored a second time: two
// copies of the same fact can drift, and the derived one cannot.
//
// Pass a transaction as `db` whenever the mutation itself is transactional. The
// settlement path does, so a committed settlement always has its trail row and a
// rolled-back one has neither.

const bid_table_by_type = {
  [bid_types.RESTRICTED_FREE_AGENCY]: 'restricted_free_agency_bids',
  [bid_types.WAIVER]: 'waivers'
}

// The surrogate key's name differs per table: restricted_free_agency_bids
// spells it bid_id and waivers spells it waiver_id. A dynamic table needs its
// id column named alongside it, not hardcoded, or the rename leaves the
// predicate on the old spelling.
const bid_id_column_by_type = {
  [bid_types.RESTRICTED_FREE_AGENCY]: 'bid_id',
  [bid_types.WAIVER]: 'waiver_id'
}

export default async function record_bid_change({
  db = default_db,
  bid_type,
  bid_id,
  change_type,
  change_source,
  changed_by_user_id = null,
  changed_at = new Date()
}) {
  if (!is_valid_bid_type(bid_type)) {
    throw new Error(`invalid bid_type: ${bid_type}`)
  }

  if (!is_valid_bid_change_type(change_type)) {
    throw new Error(`invalid bid change_type: ${change_type}`)
  }

  if (!is_valid_bid_change_source(change_source)) {
    throw new Error(`invalid bid change_source: ${change_source}`)
  }

  const bid_table = bid_table_by_type[bid_type]
  const bid_id_column = bid_id_column_by_type[bid_type]
  const bid = await db(bid_table).where(bid_id_column, bid_id).first()

  // A change recorded against a bid that does not exist is a caller bug, and a
  // silent skip would leave a gap indistinguishable from an unwired write path.
  if (!bid) {
    throw new Error(
      `no ${bid_table} row with ${bid_id_column} ${bid_id} to record`
    )
  }

  // Conditional releases are part of the OFFER, not a detail beside it: changing
  // which players a team would drop changes what the manager is committing to,
  // and the update path rewrites them by delete-and-insert with no trace at all.
  // They belong in the same trail rather than in a second one -- a release row
  // has no meaning apart from the bid it qualifies, and splitting them would
  // make reconstructing an offer a join across two histories with independent
  // clocks.
  //
  // `waivers` has no equivalent, so the column stays null for that bid type
  // rather than being faked as an empty array -- absent and empty are different
  // facts about an offer.
  let conditional_release_player_ids = null
  if (bid_type === bid_types.RESTRICTED_FREE_AGENCY) {
    const release_rows = await db('restricted_free_agency_releases')
      .select('pid')
      .where('restricted_free_agency_bid_id', bid_id)
      .orderBy('pid', 'asc')
    conditional_release_player_ids = release_rows.map((row) => row.pid)
  }

  await db('bid_changelog').insert({
    bid_type,
    bid_id,
    league_id: bid.lid,
    team_id: bid.tid,
    player_id: bid.pid,
    // `waivers` carries no season column; the restricted free agency table does.
    season_year: bid.season_year ?? null,
    change_type,
    change_source,
    changed_by_user_id,
    changed_at,
    bid_amount: bid.bid_amount ?? null,
    // The bid's own `user_id` is the LAST writer of the row, which is not the
    // same fact as the actor of this change -- a cancellation does not touch it.
    // Both are recorded so neither has to be inferred from the other.
    bid_user_id: bid.user_id ?? null,
    // Bound directly: both bid tables' `cancelled`/`processed` are timestamptz
    // as of the 2026-08-08 lifecycle retype, so the `to_timestamp()` wrapper
    // that used to convert epoch seconds here is now a DOUBLE conversion --
    // Postgres reads the instant as a float and rejects it with
    // `invalid input syntax for type double precision: "58450-09-27..."`.
    cancelled_at: bid.cancelled ?? null,
    processed_at: bid.processed ?? null,
    is_successful: bid.is_successful ?? null,
    outcome: bid.outcome ?? null,
    outcome_detail: bid.outcome_detail ?? null,
    conditional_release_player_ids
  })
}

// Convenience wrapper for the restricted free agency write paths, which are the
// only ones wired today. It exists so a call site names the bid it is recording
// rather than restating the discriminator six times.
export const record_restricted_free_agency_bid_change = ({
  db,
  bid_id,
  change_type,
  change_source,
  changed_by_user_id,
  changed_at
}) =>
  record_bid_change({
    db,
    bid_type: bid_types.RESTRICTED_FREE_AGENCY,
    bid_id,
    change_type,
    change_source,
    changed_by_user_id,
    changed_at
  })
