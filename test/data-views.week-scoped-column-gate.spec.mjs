/* global describe, it, before, after */

import * as chai from 'chai'

import { get_data_view_results_query } from '#libs-server'
import betting_market_columns from '#libs-server/data-views-column-definitions/player-betting-market-column-definitions.mjs'
import dfs_ownership_columns from '#libs-server/data-views-column-definitions/player-dfs-ownership-column-definitions.mjs'
import dfs_salary_columns from '#libs-server/data-views-column-definitions/player-dfs-salaries-column-definitions.mjs'
import game_columns from '#libs-server/data-views-column-definitions/game-column-definitions.mjs'
import { pin_golden_clock, restore_suite_clock } from './utils/index.mjs'

const expect = chai.expect

// The week-scoped column set, DECLARED explicitly. The property being asserted
// -- the join correlates on the cell's week -- cannot be sniffed from the
// column definitions without reimplementing the resolution this gate exists to
// pin: a sniffed set silently excludes a column that stops matching, which is
// exactly the failure mode under test. So the set lives here, and the coverage
// assertion below holds it against the union of the modules that host
// week-scoped sources, so a new column ADDED to one of them must be declared
// here (or adjudicated as the one season-only exception).
//
// Params name the two weeks the request spans. Most columns read the week list
// from `single_nfl_week_id`; game_opponent reads `nfl_week_id`.
const WEEK_SCOPED_COLUMNS = [
  // player game props -- fc4a84ca0
  [
    'player_game_prop_line_from_betting_markets',
    { single_nfl_week_id: ['2023_REG_WEEK_1', '2023_REG_WEEK_2'] }
  ],
  [
    'player_game_prop_american_odds_from_betting_markets',
    { single_nfl_week_id: ['2023_REG_WEEK_1', '2023_REG_WEEK_2'] }
  ],
  [
    'player_game_prop_decimal_odds_from_betting_markets',
    { single_nfl_week_id: ['2023_REG_WEEK_1', '2023_REG_WEEK_2'] }
  ],
  [
    'player_game_prop_implied_probability_from_betting_markets',
    { single_nfl_week_id: ['2023_REG_WEEK_1', '2023_REG_WEEK_2'] }
  ],
  [
    'player_game_prop_historical_hit_rate',
    { single_nfl_week_id: ['2023_REG_WEEK_1', '2023_REG_WEEK_2'] }
  ],
  [
    'player_game_prop_historical_edge',
    { single_nfl_week_id: ['2023_REG_WEEK_1', '2023_REG_WEEK_2'] }
  ],
  // dfs columns -- c85ab128a
  [
    'player_dfs_ownership_percentage',
    { single_nfl_week_id: ['2023_REG_WEEK_1', '2023_REG_WEEK_2'] }
  ],
  [
    'player_dfs_salary',
    { single_nfl_week_id: ['2023_REG_WEEK_1', '2023_REG_WEEK_2'] }
  ],
  // game columns -- c85ab128a
  ['game_opponent', { nfl_week_id: ['2023_REG_WEEK_1', '2023_REG_WEEK_2'] }],
  // team game props -- week half, current migration
  [
    'team_game_prop_line_from_betting_markets',
    { single_nfl_week_id: ['2023_REG_WEEK_1', '2023_REG_WEEK_2'] }
  ],
  [
    'team_game_prop_american_odds_from_betting_markets',
    { single_nfl_week_id: ['2023_REG_WEEK_1', '2023_REG_WEEK_2'] }
  ],
  [
    'team_game_prop_decimal_odds_from_betting_markets',
    { single_nfl_week_id: ['2023_REG_WEEK_1', '2023_REG_WEEK_2'] }
  ],
  [
    'team_game_implied_team_total_from_betting_markets',
    { single_nfl_week_id: ['2023_REG_WEEK_1', '2023_REG_WEEK_2'] }
  ]
]

// The one column in the hosting modules that is NOT week-scoped: a season
// market carries no week at all. If a second season-only column appears in one
// of these modules, declare it here rather than folding it into the week set.
const SEASON_ONLY_COLUMNS = ['player_season_prop_line_from_betting_markets']

// Under a player ["year","week"] request the identity's week reference is
// player_years_weeks.week. The correlate helper (week-scoped-cte.mjs) and the
// two inline emitters that predate it (dfs salary, game_opponent) all write it
// through a raw `db.raw` expression, so both sides are UNQUOTED:
//   t<hash>.week = player_years_weeks.week
// The output CTEs that also reference the cell week (player_participation_weeks,
// player_years_teams) quote both sides (`"player_participation_weeks"."week" =
// "player_years_weeks"."week"`), so this fragment cannot match them -- a
// predicate removed from the column's own join takes the gate red even though
// the week reference still appears elsewhere in the statement.
const WEEK_CORRELATION = /t[0-9a-f]{32}\.week = player_years_weeks\.week/

describe('DATA VIEWS week-scoped column gate', function () {
  before(() => pin_golden_clock())
  after(() => restore_suite_clock())

  it('covers every column hosted beside a week-scoped source', function () {
    const week_scoped = new Set(
      WEEK_SCOPED_COLUMNS.map(([column_id]) => column_id)
    )
    const season_only = new Set(SEASON_ONLY_COLUMNS)
    const hosted = new Set([
      ...Object.keys(betting_market_columns),
      ...Object.keys(dfs_ownership_columns),
      ...Object.keys(dfs_salary_columns),
      ...Object.keys(game_columns)
    ])
    expect(new Set([...week_scoped, ...season_only])).to.deep.equal(hosted)
    // The two sets are disjoint by construction (a column is one or the other),
    // stated explicitly so a column copied between lists fails rather than
    // passes the coverage check while dropping out of the assert loop.
    for (const column_id of week_scoped) {
      expect(season_only.has(column_id)).to.equal(
        false,
        `${column_id} declared in both sets`
      )
    }
  })

  for (const [column_id, params] of WEEK_SCOPED_COLUMNS) {
    it(`${column_id} correlates the join on the cell week under a week axis`, async function () {
      this.timeout(20000)
      const { query } = await get_data_view_results_query({
        prefix_columns: ['player_name'],
        columns: [{ column_id, params }],
        row_axes: ['year', 'week'],
        where: [
          { column_id: 'player_position', operator: 'IN', value: ['MLB'] }
        ]
      })
      const sql = query.toString()
      expect(sql).to.match(
        WEEK_CORRELATION,
        `${column_id}: expected a join predicate referencing the cell week; the CTE may span the weeks while the join does not correlate on week`
      )
    })
  }
})
