/* global describe, it, before, after */

import * as chai from 'chai'
import MockDate from 'mockdate'
import knex from 'knex'

import { current_season } from '#constants'
import betting_market_columns from '#libs-server/data-views-column-definitions/player-betting-market-column-definitions.mjs'

const expect = chai.expect
const qb = knex({ client: 'pg' })

// The grain each column DECLARES, independent of any clock. A game-grain column
// must scope to a game; a season-grain column must not pretend to.
const SEASON_GRAIN_COLUMNS = ['player_season_prop_line_from_betting_markets']

const GAME_GRAIN_COLUMNS = [
  'player_game_prop_line_from_betting_markets',
  'player_game_prop_american_odds_from_betting_markets',
  'player_game_prop_decimal_odds_from_betting_markets',
  'player_game_prop_implied_probability_from_betting_markets',
  'player_game_prop_historical_hit_rate',
  'player_game_prop_historical_edge',
  'team_game_prop_line_from_betting_markets',
  'team_game_prop_american_odds_from_betting_markets',
  'team_game_prop_decimal_odds_from_betting_markets',
  'team_game_implied_team_total_from_betting_markets'
]

// Four clocks, and 2026-07-01 is the one that matters. There
// current_season.nfl_seas_week reads 0 -- the deep-offseason value the old game
// branch fell back to, which made `if (week || ...)` false and skipped the join
// outright. A suite that only samples in-season clocks passes over it.
const CLOCKS = {
  'deep offseason': '2026-07-01T12:00:00Z',
  preseason: '2026-08-27T12:00:00Z',
  'regular season': '2026-10-15T12:00:00Z',
  postseason: '2027-01-20T12:00:00Z'
}

const emits_nfl_games_join = (column_name) => {
  const query = qb.queryBuilder()
  betting_market_columns[column_name].with({
    query,
    params: {},
    with_table_name: 't',
    data_view_options: {}
  })
  return /join\s+"?nfl_games"?/i.test(query.toString())
}

describe('DATA VIEWS betting market grain', function () {
  after(() => {
    MockDate.reset()
  })

  // Denominator. The two lists below are the whole registry, so a column added
  // later is not silently unexamined.
  it('covers every betting-market column', function () {
    const declared = [...SEASON_GRAIN_COLUMNS, ...GAME_GRAIN_COLUMNS].sort()
    const actual = Object.keys(betting_market_columns).sort()
    expect(actual).to.deep.equal(declared)
  })

  for (const [clock_name, clock] of Object.entries(CLOCKS)) {
    describe(`under the ${clock_name} clock`, function () {
      before(() => MockDate.set(clock))
      after(() => MockDate.reset())

      for (const column_name of SEASON_GRAIN_COLUMNS) {
        it(`${column_name} emits NO nfl_games join`, function () {
          expect(emits_nfl_games_join(column_name)).to.equal(false)
        })
      }

      for (const column_name of GAME_GRAIN_COLUMNS) {
        it(`${column_name} emits an nfl_games join`, function () {
          expect(emits_nfl_games_join(column_name)).to.equal(true)
        })
      }
    })
  }

  // The gate tests the DECLARED grain, not the truthiness of the week integer.
  //
  // These two assertions are the only ones in this file that can tell the two
  // gates apart. Everything above stays green under `if (week || ...)` once the
  // week resolution is fixed, because a game-grain column then always resolves
  // a truthy week -- so without this case the gate change would be untested and
  // look tested.
  //
  // A week-0 identifier is the discriminator: it makes `week` falsy while the
  // column's grain is still `game`. No resolver can produce one (the contract
  // guard floors at 1 and validate_nfl_week_identifier rejects it), but a raw
  // API caller can send one, and under the old gate it silently turned a
  // game-scoped column season-wide -- the exact conflation this task removes.
  it('gates on the declared grain, not on the week being truthy', function () {
    MockDate.set(CLOCKS['regular season'])
    const params = { single_nfl_week_id: ['2026_REG_WEEK_0'] }

    const query = qb.queryBuilder()
    betting_market_columns.player_game_prop_historical_hit_rate.with({
      query,
      params,
      with_table_name: 't',
      data_view_options: {}
    })
    expect(/join\s+"?nfl_games"?/i.test(query.toString())).to.equal(true)

    // Control: the same falsy-week input on a SEASON-grain column still emits
    // no join, so the assertion above is about grain and not about the input.
    const season_query = qb.queryBuilder()
    betting_market_columns.player_season_prop_line_from_betting_markets.with({
      query: season_query,
      params,
      with_table_name: 't',
      data_view_options: {}
    })
    expect(/join\s+"?nfl_games"?/i.test(season_query.toString())).to.equal(
      false
    )
  })

  // The offseason leg of the join gate, stated as the property rather than as a
  // clock sample. nfl_seas_week genuinely reaches 0 here, and the old code read
  // it as the default week for game props.
  it('the deep-offseason clock really does have nfl_seas_week 0', function () {
    MockDate.set(CLOCKS['deep offseason'])
    expect(current_season.nfl_seas_week).to.equal(0)
    expect(current_season.week).to.equal(0)
    // The control that makes the assertions above non-vacuous: the resolver the
    // game branch now uses is >= 1 at this very clock.
    expect(current_season.active_fantasy_week).to.equal(1)
  })
})
