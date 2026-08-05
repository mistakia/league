import { current_season } from '#constants'

// A restricted free agency bid prices a roster only while it is still LIVE, and
// `cancelled` alone does not test that. `scripts/process-restricted-free-agency-bids.mjs`
// settles a losing bid with `succ: 0` and a `processed` timestamp and leaves `cancelled`
// null, so a bid filtered on `cancelled` only survives its own processing run and keeps
// handing a `bid` to whatever reads the roster afterwards. `getExtensionAmount` coalesces
// with `??`, so a settled $0 bid then prices the player at $0 and hands the team free cap
// space -- across the add-player gate, waivers and poaches, not just the bid dialog.
//
// Three call sites load these bids and all three need the same liveness test; two agreed
// on it and `get-roster.mjs` did not. Sharing the guards is what keeps them from drifting
// apart again -- the divergence, not the individual query, was the defect.
//
// Ownership is deliberately NOT part of this builder. `tid` selects the bids a team MADE,
// which is what the bid dialog wants; a roster's cap pricing wants only the team's own
// players and adds `.where('player_tid', tid)` at the call site, where it reads as the
// semantic choice it is.
export const build_active_restricted_free_agency_bids_query = ({
  db,
  tid,
  year = current_season.year
}) =>
  db('restricted_free_agency_bids')
    .where('tid', tid)
    // Qualified because callers join `restricted_free_agency_nominations`, which
    // carries its own `season_year` -- unqualified, the predicate is ambiguous.
    .where('restricted_free_agency_bids.season_year', year)
    .whereNull('cancelled')
    .whereNull('processed')

// Load a single bid together with the auction facts that are no longer stored
// on it. `original_team_id`, `nominated_at` and `announced_at` belong to the
// player's nomination, so every route that used to read them off the bid row
// reaches them through this join.
//
// Projected under names distinct from the bid's own columns, which is what lets
// a caller test `announced_at` without ambiguity now that the bid has no
// `announced` of its own.
export const select_restricted_free_agency_bid_with_nomination = ({ db }) =>
  db('restricted_free_agency_bids')
    .select(
      'restricted_free_agency_bids.*',
      'restricted_free_agency_nominations.nomination_id',
      'restricted_free_agency_nominations.original_team_id',
      'restricted_free_agency_nominations.nominated_at',
      'restricted_free_agency_nominations.announced_at',
      'restricted_free_agency_nominations.processed_at'
    )
    .leftJoin(
      'restricted_free_agency_nominations',
      'restricted_free_agency_nominations.nomination_id',
      'restricted_free_agency_bids.nomination_id'
    )

export default build_active_restricted_free_agency_bids_query
