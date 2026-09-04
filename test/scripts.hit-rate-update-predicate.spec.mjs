/* global describe it */
import * as chai from 'chai'

import { build_hit_rate_update_where_clause } from '#scripts/calculate-historical-hit-rates.mjs'
import { build_team_hit_rate_update_where_clause } from '#scripts/calculate-team-historical-hit-rates.mjs'

const expect = chai.expect

// prop_market_selections_index is unique on
// (source_id, source_market_id, source_selection_id, time_type).
//
// Both hit-rate crons built their UPDATE predicate without time_type, so every
// write matched BOTH the OPEN and the CLOSE row for a selection. The two rows
// carry the same hit rate -- the rate is a function of the line, not the price
// -- but different odds, so the second write overwrote the first row's edge
// with an edge computed against the other row's odds. Measured on production
// 2026-09-04: 26,710 of 27,421 sampled CLOSE rows carried their sibling's edge
// while only 8,434 shared its odds.
//
// These assertions fail against the predicate as it stood before 2026-09-04.

const open_selection = {
  source_id: 'DRAFTKINGS',
  source_market_id: 'market-1',
  source_selection_id: 'selection-1',
  time_type: 'OPEN',
  selection_type: 'OVER',
  selection_metric_line: 45.5,
  selection_pid: 'PLAYER-1',
  team: 'BUF',
  odds_american: -110
}

const close_selection = {
  ...open_selection,
  time_type: 'CLOSE',
  odds_american: 120
}

describe('hit-rate update predicate', function () {
  describe('player cron', function () {
    it('carries time_type, so it names exactly one physical row', function () {
      const where_clause = build_hit_rate_update_where_clause(open_selection)

      expect(where_clause).to.have.property('time_type', 'OPEN')

      // The full unique key must be present. A predicate missing any part of it
      // matches more than one row and the loop's last write wins.
      for (const column of [
        'source_id',
        'source_market_id',
        'source_selection_id',
        'time_type'
      ]) {
        expect(
          where_clause[column],
          `unique key column ${column}`
        ).to.not.equal(undefined)
      }
    })

    it('distinguishes the OPEN row from the CLOSE row of one selection', function () {
      const open_clause = build_hit_rate_update_where_clause(open_selection)
      const close_clause = build_hit_rate_update_where_clause(close_selection)

      // The two selections differ ONLY in time_type and odds, and odds are not
      // part of the predicate. If the predicates match, one update overwrites
      // the other -- which is the defect this asserts against.
      expect(open_clause).to.not.eql(close_clause)
      expect(open_clause.time_type).to.not.equal(close_clause.time_type)
    })
  })

  describe('team cron', function () {
    it('carries time_type, so it names exactly one physical row', function () {
      const where_clause =
        build_team_hit_rate_update_where_clause(open_selection)

      expect(where_clause).to.have.property('time_type', 'OPEN')

      for (const column of [
        'source_id',
        'source_market_id',
        'source_selection_id',
        'time_type'
      ]) {
        expect(
          where_clause[column],
          `unique key column ${column}`
        ).to.not.equal(undefined)
      }
    })

    it('distinguishes the OPEN row from the CLOSE row of one selection', function () {
      const open_clause =
        build_team_hit_rate_update_where_clause(open_selection)
      const close_clause =
        build_team_hit_rate_update_where_clause(close_selection)

      expect(open_clause).to.not.eql(close_clause)
    })

    it('omits selection_pid, which this query aliases to team', function () {
      const where_clause =
        build_team_hit_rate_update_where_clause(open_selection)

      // The team query selects `selection_pid as team`, so binding
      // selection.selection_pid here would be undefined and match no row.
      // Guarding it explicitly, because adding the column reads like a
      // tightening and would silently stop every team update.
      expect(where_clause).to.not.have.property('selection_pid')
    })
  })
})
