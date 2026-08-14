import { current_season } from '#constants'
import { getLeague, createLeague } from '#libs-server'

export default async function (knex, league_params = {}) {
  // Clear the rows a sequence hands ids to BEFORE restarting it. Restarting
  // first leaves a window where the sequence is back at 1 while rows holding
  // uid 1..n are still present, so any insert landing in that window collides
  // on the primary key. The window is reachable whenever a spec times out
  // mid-fixture: mocha abandons the test but cannot cancel its in-flight
  // queries, so the orphaned inserts run on against the next test's reset.
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
  // Rows in these outlive a spec FILE otherwise: nothing in production deletes
  // them and no other fixture clears them, so a leftover row from an earlier
  // file is read by the next one. Measured 2026-08-14 by probing every
  // league-scoped table at fixture entry across a full suite run -- all eight
  // held rows there. `matchups` had a fixture of its own
  // (db/fixtures/matchups.mjs) that nothing imports, and two specs were
  // hand-purging these tables in their own beforeEach to work around the gap.
  // Ordered children-first: roster_asset_transformation carries FKs to
  // roster_asset_holding(holding_id).
  await knex('league_notifications').del()
  await knex('league_team_daily_values').del()
  await knex('league_team_seasonlogs').del()
  await knex('league_team_lineup_starters').del()
  await knex('league_team_lineups').del()
  await knex('roster_asset_transformation').del()
  await knex('roster_asset_holding').del()
  await knex('matchups').del()
  await knex('leagues').del()
  await knex('seasons').del()

  // Reset sequences for test isolation (teams_uid_seq reset after team creation)
  await knex.raw('ALTER SEQUENCE waivers_uid_seq RESTART WITH 1')
  await knex.raw('ALTER SEQUENCE transactions_uid_seq RESTART WITH 1')
  await knex.raw('ALTER SEQUENCE rosters_uid_seq RESTART WITH 1')
  await knex.raw('ALTER SEQUENCE trades_uid_seq RESTART WITH 1')
  await knex.raw('ALTER SEQUENCE poaches_uid_seq RESTART WITH 1')
  await knex.raw('ALTER SEQUENCE leagues_uid_seq RESTART WITH 1')
  await knex.raw('ALTER SEQUENCE super_priority_uid_seq RESTART WITH 1')

  const userId = 1
  const leagueId = await createLeague({
    lid: 1,
    is_hosted: 1,
    commishid: userId,
    draft_start: Math.round(Date.now() / 1000),
    free_agency_live_auction_start: null,
    tddate: current_season.regular_season_start.add('12', 'weeks').unix(),
    ext_date: current_season.now.subtract('1', 'week').unix(),
    ...league_params
  })
  const league = await getLeague({ lid: leagueId })

  await knex('users_sources').del()
  await knex('users_teams').del()
  await knex('teams').del()
  await knex('rosters').del()
  await knex('rosters_players').del()
  await knex('practice').del()
  await knex('player_gamelogs').del()
  // Built up and inserted per table rather than row by row. This fixture runs
  // in a `beforeEach` across most of the suite, and the row-at-a-time shape cost
  // one round trip per team-week -- roughly 230 of them -- which put the fixture
  // near mocha's default 2000ms timeout. That is why specs doing nothing unusual
  // failed on timeouts under CI load, and why which spec failed moved between
  // runs. Row order within each insert is preserved so `rosters.uid` is handed
  // out in the same sequence as before.
  const team_rows = []
  const roster_rows = []
  const users_teams_rows = []
  const last_updated = new Date()

  for (let i = 1; i <= 12; i++) {
    team_rows.push({
      uid: i,
      season_year: current_season.year,
      lid: 1,
      waiver_order: i,
      draft_order: i,
      salary_cap: league.cap,
      faab_balance: league.starting_faab_budget,
      division: (i % 4) + 1,
      name: `Team${i}`,
      abbreviation: `TM${i}`
    })

    for (let week = 0; week <= current_season.finalWeek; week++) {
      roster_rows.push({
        tid: i,
        lid: 1,
        week,
        season_year: current_season.year,
        last_updated
      })
    }

    users_teams_rows.push({
      userid: i,
      tid: i,
      season_year: current_season.year
    })
  }

  await knex('teams').insert(team_rows)
  await knex('rosters').insert(roster_rows)
  await knex('users_teams').insert(users_teams_rows)

  // Sync teams sequence with the max uid after manual inserts
  await knex.raw("SELECT setval('teams_uid_seq', (SELECT MAX(uid) FROM teams))")
}
