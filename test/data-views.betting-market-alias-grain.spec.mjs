/* global describe it before after */

import MockDate from 'mockdate'
import * as chai from 'chai'

import { get_data_view_results_query } from '#libs-server'
import { restore_suite_clock } from './utils/index.mjs'

const { expect } = chai

// Two clocks inside the same REG season that differ ONLY in the resolved week,
// which is what a game-grain betting-market column reads when no week param is
// passed. The pair is the whole instrument: the defect this spec exists for was
// invisible to any single clock.
const WEEK_6_CLOCK = '2026-10-13T12:00:00Z'
const WEEK_7_CLOCK = '2026-10-20T12:00:00Z'

// Every column the betting-market family exports. Season grain first, then the
// ten game-grain columns; the split matters and is asserted rather than assumed.
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

const ALL_COLUMNS = [...SEASON_GRAIN_COLUMNS, ...GAME_GRAIN_COLUMNS]

const table_aliases = (sql) => [...new Set(sql.match(/t[0-9a-f]{32}/g) || [])]

// Strip alias IDENTITY while keeping alias POSITION, so `structure` answers
// "does this request build a different CTE" independently of what the CTE is
// named. Comparing the two questions separately is the only way to see one
// answer yes while the other says no.
const structure_of = (sql) =>
  table_aliases(sql).reduce(
    (acc, hash, index) => acc.replaceAll(hash, `table_${index}`),
    sql
  )

const emit_at = async ({ clock, column_id }) => {
  MockDate.set(clock)
  const { query } = await get_data_view_results_query({
    prefix_columns: ['player_name'],
    columns: [{ column_id }]
  })
  const sql = query.toString()
  return {
    structure: structure_of(sql),
    aliases: table_aliases(sql).sort().join(',')
  }
}

describe('data views: betting-market table alias tracks the market grain', function () {
  this.timeout(120000)

  const at_week_6 = {}
  const at_week_7 = {}

  before(async () => {
    for (const column_id of ALL_COLUMNS) {
      at_week_6[column_id] = await emit_at({ clock: WEEK_6_CLOCK, column_id })
      at_week_7[column_id] = await emit_at({ clock: WEEK_7_CLOCK, column_id })
    }
  })

  after(() => {
    restore_suite_clock()
  })

  // The premise, asserted rather than assumed. Everything below compares a
  // week-6 emission against a week-7 one, so if the game-grain columns ever
  // stop reading the resolved week the comparison has nothing to see and the
  // collision assertion passes over anything at all.
  it('every game-grain column builds a different CTE at week 6 and week 7', () => {
    const static_columns = GAME_GRAIN_COLUMNS.filter(
      (column_id) =>
        at_week_6[column_id].structure === at_week_7[column_id].structure
    )

    expect(
      static_columns,
      `these columns emit identical SQL at two different weeks, so they are no longer week-scoped and this spec no longer tests a grain: ${static_columns.join(', ')}`
    ).to.deep.equal([])
  })

  // The other half of the premise. If BOTH grains moved, the two clocks would
  // be differing in something broader than the week and the pair would stop
  // isolating grain -- a season prop is week-independent by definition.
  it('the season-grain column builds the same CTE at both weeks', () => {
    for (const column_id of SEASON_GRAIN_COLUMNS) {
      expect(
        at_week_6[column_id].structure,
        `${column_id} is season grain, so the resolved week must not reach its SQL`
      ).to.equal(at_week_7[column_id].structure)
    }
  })

  // The assertion the spec exists for, stated as the cache-key invariant rather
  // than as a literal hash: two requests that build DIFFERENT SQL must not share
  // a table alias, because that alias is the CTE name and the redis cache key.
  //
  // betting_markets_table_alias destructured only is_player_game_prop and
  // silently dropped is_team_game_prop, so the four team columns resolved their
  // params at the SEASON grain -- week null, invariant across clocks -- while
  // team_betting_market_with built a game-grain CTE at the resolved week.
  // Measured before the 6e724c02c fix: identical alias at week 6 and week 7,
  // with an explicit week moving the hash as the control. Two different weeks
  // sharing one cache key, and the goldens could not see it -- both comparison
  // paths rewrite every 32-character hash to a positional table_N before
  // comparing, so all 279 goldens and the whole data-view spec family stay
  // green over it.
  //
  // Deliberately NOT a pinned literal hash. A literal is a screenshot: it
  // breaks on any legitimate change to the alias key and says nothing about
  // why, and nobody reading it can tell whether the value is right. The
  // property is what was violated, so the property is what is asserted.
  it('never shares one table alias across two different emitted CTEs', () => {
    const collisions = ALL_COLUMNS.filter(
      (column_id) =>
        at_week_6[column_id].structure !== at_week_7[column_id].structure &&
        at_week_6[column_id].aliases === at_week_7[column_id].aliases
    )

    expect(
      collisions,
      `these columns build different SQL at week 6 and week 7 but hash to the same table alias, so two weeks share one CTE name and one cache key: ${collisions.join(', ')}`
    ).to.deep.equal([])
  })
})
