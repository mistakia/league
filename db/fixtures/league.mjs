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
  await knex('poaches').del()
  await knex('poach_releases').del()
  await knex('draft').del()
  await knex('league_cutlist').del()
  await knex('super_priority').del()
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
    hosted: 1,
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
  const last_updated = Math.round(Date.now() / 1000)

  for (let i = 1; i <= 12; i++) {
    team_rows.push({
      uid: i,
      year: current_season.year,
      lid: 1,
      waiver_order: i,
      draft_order: i,
      cap: league.cap,
      faab: league.faab,
      div: (i % 4) + 1,
      name: `Team${i}`,
      abbrv: `TM${i}`
    })

    for (let week = 0; week <= current_season.finalWeek; week++) {
      roster_rows.push({
        tid: i,
        lid: 1,
        week,
        year: current_season.year,
        last_updated
      })
    }

    users_teams_rows.push({
      userid: i,
      tid: i,
      year: current_season.year
    })
  }

  await knex('teams').insert(team_rows)
  await knex('rosters').insert(roster_rows)
  await knex('users_teams').insert(users_teams_rows)

  // Sync teams sequence with the max uid after manual inserts
  await knex.raw("SELECT setval('teams_uid_seq', (SELECT MAX(uid) FROM teams))")
}
