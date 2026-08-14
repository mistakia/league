import { current_season } from '#constants'
import { getLeague, createLeague } from '#libs-server'
import reset_league_tables from './reset-league-tables.mjs'

export default async function (knex, league_params = {}) {
  // One shared list, so a new league-scoped table cannot be remembered here and
  // forgotten in the other fixture. Must run BEFORE the sequence restarts below
  // -- see that module's header for the collision window it protects.
  await reset_league_tables(knex)

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

  // Not league-scoped, so deliberately not part of the shared reset: these are
  // global rows this fixture clears for its own test isolation.
  await knex('users_sources').del()
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
