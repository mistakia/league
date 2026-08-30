/* global describe it */

// The preloader writes rows; the settlement handlers read columns off them by
// name. Nothing connects the two at runtime, and the failure is silent in the
// worst direction: calculate_metric_value does `data_item[column]`, skips a
// value that is null or undefined, and returns a total of 0 -- so a market
// settles against a zero metric and pays out, rather than raising.
//
// This is the "never fixture either side" rule. Both halves are imported real:
// the mappings say which columns a handler will read, the preloader says which
// columns it selects, and a hand-written list of either would agree with the
// side that wrote it and drift with it.
//
// It replaces a gate that recovered the select list by REGEX over
// data-preloader.mjs's source text. That gate could see only the NFL_PLAYS
// handler and only the `load_nfl_plays` function, so the three return-touchdown
// columns added to player_gamelogs had no gate at all -- and its
// `'([a-z_0-9]+)'` pattern could not have matched the qualified
// `player_gamelogs.` names even if the loop had been widened to reach them.
//
// NFL_GAMES is deliberately not covered. Its mappings carry a calculation_type
// rather than metric_columns, and the handler reads home_score/away_score
// directly, so a metric_columns-driven check would assert nothing about it.

import * as chai from 'chai'

import {
  HANDLER_TYPES,
  market_type_mappings
} from '#libs-server/prop-market-settlement/market-type-mappings.mjs'
import {
  nfl_plays_columns,
  player_gamelog_columns
} from '#libs-server/prop-market-settlement/data-preloader.mjs'

const expect = chai.expect

// Every column a handler will read off a preloaded row for this mapping.
const columns_read_by = (mapping) => {
  const columns = new Set(mapping.metric_columns || [])

  if (mapping.player_column) columns.add(mapping.player_column)
  if (mapping.team_aggregate) columns.add('offense_nfl_team')
  if (mapping.quarter_filter || mapping.half_filter) columns.add('quarter')
  if (mapping.special_logic === 'first_touchdown_scorer') {
    // The first-scorer branch reads these off the play directly.
    for (const column of [
      'is_rushing_play',
      'is_passing_play',
      'ball_carrier_pid',
      'target_pid',
      'is_completion'
    ]) {
      columns.add(column)
    }
  }

  return columns
}

const preloaded_columns = {
  [HANDLER_TYPES.NFL_PLAYS]: new Set(nfl_plays_columns),
  [HANDLER_TYPES.PLAYER_GAMELOG]: new Set(player_gamelog_columns)
}

describe('prop-market-settlement preloaded column coverage', function () {
  for (const handler of Object.keys(preloaded_columns)) {
    it(`preloads every column the ${handler} handler reads`, () => {
      const missing = []

      for (const [market_type, mapping] of Object.entries(
        market_type_mappings
      )) {
        if (mapping.handler !== handler) continue

        for (const column of columns_read_by(mapping)) {
          if (preloaded_columns[handler].has(column)) continue
          missing.push(`${market_type} reads ${column}`)
        }
      }

      expect(
        missing,
        `${handler} reads a column the preloader does not select. The read ` +
          'yields undefined, calculate_metric_value skips it, and the market ' +
          'settles against a zero metric instead of raising'
      ).to.deep.equal([])
    })
  }

  // Without this, the loop above passes vacuously if a handler constant is
  // renamed, a mapping table is emptied, or the columns_read_by extraction
  // stops finding anything -- all of which look exactly like full coverage.
  it('reads a non-trivial number of columns for each handler', () => {
    for (const handler of Object.keys(preloaded_columns)) {
      const mappings = Object.values(market_type_mappings).filter(
        (mapping) => mapping.handler === handler
      )
      const columns = new Set(
        mappings.flatMap((mapping) => [...columns_read_by(mapping)])
      )

      expect(
        mappings.length,
        `no mapping declares handler ${handler}, so its coverage case above ` +
          'iterates nothing and passes without checking a single column'
      ).to.be.greaterThan(0)
      expect(
        columns.size,
        `${handler} mappings name no columns at all, so its coverage case ` +
          'above compares an empty set against the preloader and cannot fail'
      ).to.be.greaterThan(0)
    }
  })
})
