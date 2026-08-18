import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

import { current_season } from '#constants'
import { getLeague, createLeague } from '#libs-server'
import { DRAFT_TIMEZONE } from '#libs-shared/draft-daily-window.mjs'
import reset_league_tables from './reset-league-tables.mjs'

dayjs.extend(utc)
dayjs.extend(timezone)

// The default hard end: two weeks after the draft opens, which is comfortably
// past the last of a full 65-pick board at five slots a day.
//
// Derived from the draft's OWN start rather than from now, so a spec that moves
// `draft_start` moves the whole draft, hard end included.
//
// This deliberately does NOT reproduce the projection the column replaces,
// because that projection was not one value: it read `window(total_picks + 1)`,
// so it landed on the day the draft opened for a spec that seeded no board and
// roughly thirteen days out for one that seeded sixty-five picks. A stated
// column cannot vary with the board and should not -- that instability is the
// forcing argument for the column existing. The consequence is that a spec
// needing a CLOSED draft must now say so, by passing its own
// `rookie_draft_end_at`, rather than getting one as a side effect of leaving
// the `draft` table empty.
const DEFAULT_DRAFT_LENGTH_DAYS = 14

export const default_rookie_draft_end_at = (draft_start_timestamp) =>
  dayjs
    .unix(draft_start_timestamp)
    .tz(DRAFT_TIMEZONE)
    .add(DEFAULT_DRAFT_LENGTH_DAYS, 'day')
    .endOf('day')
    .unix()

export default async function (knex, league_params = {}) {
  // One shared list, so a new league-scoped table cannot be remembered here and
  // forgotten in the other fixture. Must run BEFORE the sequence restarts below
  // -- see that module's header for the collision window it protects.
  await reset_league_tables(knex)

  // Reset sequences for test isolation (teams_team_id_seq reset after team creation)
  await knex.raw('ALTER SEQUENCE waivers_waiver_id_seq RESTART WITH 1')
  await knex.raw(
    'ALTER SEQUENCE transactions_transaction_id_seq RESTART WITH 1'
  )
  await knex.raw('ALTER SEQUENCE rosters_roster_id_seq RESTART WITH 1')
  await knex.raw('ALTER SEQUENCE trades_trade_id_seq RESTART WITH 1')
  await knex.raw('ALTER SEQUENCE poaches_poach_id_seq RESTART WITH 1')
  await knex.raw('ALTER SEQUENCE leagues_league_id_seq RESTART WITH 1')
  await knex.raw(
    'ALTER SEQUENCE super_priority_super_priority_id_seq RESTART WITH 1'
  )

  const userId = 1
  const league_defaults = {
    lid: 1,
    is_hosted: 1,
    commissioner_user_id: userId,
    // A real slate config, not just a start: `draft_type` left null makes the
    // SPA's two window predicates false, so `getPicks` places no window at all
    // and a draft-page fixture renders no label. The 11:00-24:00 band with a
    // 3-hour interval is the elected 2026 config, so a fixture exercises the
    // slate the league actually runs on.
    draft_start: Math.round(Date.now() / 1000),
    draft_type: 'hour',
    draft_pick_interval: 3,
    draft_hour_min: 11,
    draft_hour_max: 24,
    free_agency_live_auction_start: null,
    trade_deadline_at: current_season.regular_season_start
      .add('12', 'weeks')
      .unix(),
    extension_deadline_at: current_season.now.subtract('1', 'week').unix(),
    ...league_params
  }

  const leagueId = await createLeague({
    ...league_defaults,
    rookie_draft_end_at:
      league_defaults.rookie_draft_end_at ??
      default_rookie_draft_end_at(league_defaults.draft_start)
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
  // runs. Row order within each insert is preserved so `rosters.roster_id` is handed
  // out in the same sequence as before.
  const team_rows = []
  const roster_rows = []
  const users_teams_rows = []
  const last_updated = new Date()

  for (let i = 1; i <= 12; i++) {
    team_rows.push({
      team_id: i,
      season_year: current_season.year,
      lid: 1,
      waiver_order: i,
      draft_order: i,
      salary_cap: league.salary_cap,
      free_agent_acquisition_budget_balance:
        league.starting_free_agent_acquisition_budget,
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
      user_id: i,
      tid: i,
      season_year: current_season.year
    })
  }

  await knex('teams').insert(team_rows)
  await knex('rosters').insert(roster_rows)
  await knex('users_teams').insert(users_teams_rows)

  // Sync teams sequence with the max team_id after manual inserts
  await knex.raw(
    "SELECT setval('teams_team_id_seq', (SELECT MAX(team_id) FROM teams))"
  )
}
