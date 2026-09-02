// The single per-league reset list, shared by every fixture that rebuilds
// league 1 from scratch.
//
// WHY THIS IS ONE FILE. It used to be two hand-maintained lists -- one in
// league.mjs and a shorter one in user.mjs -- and they had already drifted by
// SEVENTEEN tables: user.mjs cleared neither the restricted-free-agency tables,
// nor bid_changelog, draft, league_cutlist, super_priority, trades_slots, nor
// league_pauses. That is the same class of defect the list itself exists to
// prevent (a human has to remember to edit a list), duplicated, so every future
// table had to be remembered TWICE and the second copy had no gate on it.
// db/gates/check-league-fixture-reset-coverage.mjs reads this file, so there is
// now exactly one list and exactly one thing to keep current.
//
// ORDERING IS LOAD-BEARING, in two ways.
//
// Rows are cleared BEFORE the caller restarts any sequence that hands out their
// ids. Restarting first leaves a window where the sequence is back at 1 while
// rows holding id 1..n are still present, so any insert landing in that window
// collides on the primary key. The window is reachable whenever a spec times out
// mid-fixture: mocha abandons the test but cannot cancel its in-flight queries,
// so the orphaned inserts run on against the next test's reset. Callers must
// therefore call this first and restart sequences after it returns.
//
// Children are cleared before parents, which matters only where a foreign key
// actually exists -- this schema has very few (roster_asset_transformation ->
// roster_asset_holding is one of the two that bite).
//
// SCOPE. This clears tables whose rows belong to a LEAGUE. It deliberately does
// not touch global NFL data that some fixtures also reset for their own test
// isolation (practice, player_gamelogs) or user-owned rows that are not
// per-league (users_sources); those stay at their call sites, where the reason
// for clearing them is local.

export default async function reset_league_tables(knex) {
  await knex('transactions').del()
  await knex('trades').del()
  await knex('trades_picks').del()
  await knex('trades_players').del()
  await knex('trades_slots').del()
  await knex('trades_transactions').del()
  await knex('trade_releases').del()
  await knex('waivers').del()
  await knex('waiver_releases').del()
  await knex('restricted_free_agency_bids').del()
  await knex('restricted_free_agency_releases').del()
  // The nomination holds the auction's state for a whole (league, player,
  // season), so a leftover row outlives the bids that used to carry that state
  // per row. Omitting it here leaked an announced nomination across spec files
  // and made a later nominate return 400 -- on CI only, because it depends on
  // which spec claimed the player first.
  await knex('restricted_free_agency_nominations').del()
  // The bid audit trail outlives the bids it describes by design -- nothing in
  // production ever deletes from it. That makes it exactly the kind of table
  // this reset must name: a leftover changelog row from an earlier spec file
  // carries a bid id the next file's sequence will hand out again, so an
  // assertion on "this bid's history" would read another spec's rows.
  await knex('bid_changelog').del()
  // Elections span the whole free agency period rather than one nomination, so
  // a leftover row outlives every transaction the auction wrote around it: a
  // stale live election on a player the next spec nominates joins that
  // nomination's eligible set and settles it against another spec's maximum.
  await knex('auction_elections').del()
  await knex('auction_block_opt_ins').del()
  // A finalized block is what puts the auction into LIVE mode at an instant, so
  // a leftover row from an earlier spec silently runs the next spec's auction on
  // the bid clock -- which is the one difference that changes every settlement
  // path the suite exercises.
  await knex('auction_blocks').del()
  await knex('poaches').del()
  await knex('poach_releases').del()
  await knex('draft').del()
  await knex('league_cutlist').del()
  await knex('super_priority').del()
  // A leaked OPEN pause breaks the next spec file two ways, and neither names
  // this table: every write route answers 423, and the partial unique index
  // league_pauses_one_open_per_league makes the next pause insert a duplicate
  // key. Nothing in production deletes these rows, so only this reset can.
  await knex('league_pauses').del()
  // Amendment XLIII Admission Vote. Children before parents: the preferences
  // carry a foreign key to the ballots, the ballots to the eligibility
  // snapshot, and all of them to the vote. The partial unique index
  // admission_votes_one_open_vote_per_league_season makes a leaked OPEN vote a
  // duplicate key on the next spec file's open, the same shape as
  // league_pauses above. Nothing in production deletes any of these rows --
  // ballots are retained permanently by design.
  await knex('admission_vote_ballot_preferences').del()
  await knex('admission_vote_ballots').del()
  await knex('admission_vote_candidate_sponsors').del()
  await knex('admission_vote_candidates').del()
  await knex('admission_vote_eligible_teams').del()
  await knex('admission_votes').del()
  // Rows in these outlive a spec FILE otherwise: nothing in production deletes
  // them and no other fixture clears them, so a leftover row from an earlier
  // file is read by the next one. Measured 2026-08-14 by probing every
  // league-scoped table at fixture entry across a full suite run -- all eight
  // held rows there. `matchups` had a fixture of its own that nothing imported,
  // and two specs were hand-purging these tables in their own beforeEach to
  // work around the gap.
  await knex('league_notifications').del()
  await knex('league_team_daily_values').del()
  await knex('league_team_seasonlogs').del()
  await knex('league_team_lineup_starters').del()
  await knex('league_team_lineups').del()
  // roster_asset_transformation carries foreign keys to
  // roster_asset_holding(holding_id), so it must go first.
  await knex('roster_asset_transformation').del()
  await knex('roster_asset_holding').del()
  await knex('matchups').del()
  await knex('users_teams').del()
  await knex('rosters_players').del()
  await knex('rosters').del()
  await knex('teams').del()
  await knex('leagues').del()
  await knex('seasons').del()
}
