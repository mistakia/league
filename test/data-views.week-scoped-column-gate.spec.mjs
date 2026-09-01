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
    { single_nfl_week_id: ['2023_REG_WEEK_1', '2023_REG_WEEK_2'] },
    'game'
  ],
  [
    'team_game_prop_american_odds_from_betting_markets',
    { single_nfl_week_id: ['2023_REG_WEEK_1', '2023_REG_WEEK_2'] },
    'game'
  ],
  [
    'team_game_prop_decimal_odds_from_betting_markets',
    { single_nfl_week_id: ['2023_REG_WEEK_1', '2023_REG_WEEK_2'] },
    'game'
  ],
  [
    'team_game_implied_team_total_from_betting_markets',
    { single_nfl_week_id: ['2023_REG_WEEK_1', '2023_REG_WEEK_2'] },
    'game'
  ]
]

// The one column in the hosting modules that is NOT week-scoped: a season
// market carries no week at all. If a second season-only column appears in one
// of these modules, declare it here rather than folding it into the week set.
const SEASON_ONLY_COLUMNS = ['player_season_prop_line_from_betting_markets']

// Under a player ["year","week"] request the identity's week reference is
// player_years_weeks.week. The output CTEs that also reference it
// (player_participation_weeks, player_years_teams) quote both sides, so the
// unquoted 'week' fragment below cannot match them -- a predicate removed from
// the column's own join takes the gate red even though the week reference still
// appears elsewhere in the statement.
//
// Two correlation MECHANISMS, declared per column rather than accepted
// interchangeably. A column that silently swaps one for the other has changed
// how it selects a row, which is the class this gate exists to catch, so the
// declaration is what makes a swap fail rather than pass.
//
//   'week' -- the join carries the cell's week directly. The correlate helper
//     (week-scoped-cte.mjs) and the two inline emitters that predate it write it
//     through db.raw, so both sides are UNQUOTED.
//   'game' -- the join carries the cell's GAME, via the player_week_teams
//     bridge, and the game fixes the week as a consequence. Knex quotes both
//     sides. This is only a week correlation if the BRIDGE is itself joined on
//     the cell's week, so that is asserted too rather than assumed.
const correlation_patterns = (alias) => ({
  week: new RegExp(`${alias}\\.week = player_years_weeks\\.week`),
  game: new RegExp(`"${alias}"\\."esbid" = "player_week_teams"\\."esbid"`)
})

const BRIDGE_WEEK_CORRELATION =
  /"player_week_teams"\."week" = "player_years_weeks"\."week"/

// Every hashed CTE alias in the statement. Anchoring each assertion on the
// column's OWN alias is what stops a stray correlation elsewhere in the query
// from satisfying the gate on a column that lost its own.
const hashed_aliases = (sql) => [
  ...new Set([...sql.matchAll(/t[0-9a-f]{32}/g)].map((match) => match[0]))
]

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

  for (const [column_id, params, correlation = 'week'] of WEEK_SCOPED_COLUMNS) {
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
      const aliases = hashed_aliases(sql)

      expect(aliases.length).to.be.greaterThan(
        0,
        `${column_id}: emitted no hashed CTE alias, so this assertion would pass vacuously`
      )

      for (const alias of aliases) {
        expect(sql).to.match(
          correlation_patterns(alias)[correlation],
          `${column_id}: ${alias} carries no ${correlation} correlation; its CTE may span the weeks while the join does not select between them`
        )
      }

      if (correlation === 'game') {
        expect(sql).to.match(
          BRIDGE_WEEK_CORRELATION,
          `${column_id}: joins on the game, but player_week_teams is not itself correlated on the cell week, so the game does not pin the week`
        )
      }
    })
  }
})
