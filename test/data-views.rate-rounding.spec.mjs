/* global describe it */

import * as chai from 'chai'

import { emit_rate_outer_select } from '#libs-server/data-views/rate-type/emit-rate-outer-select.mjs'
import aggregator_rate from '#libs-server/data-views/output-aggregator/aggregator-rate.mjs'

const expect = chai.expect

const make_column_def = (decimals) => ({
  column_id: 'synthetic_col',
  column_name: 'synthetic_col',
  measure_source: 'plays',
  measure_expr: () => 'rush_yds',
  decimals
})

describe('data-views rate-rounding', () => {
  describe('emit_rate_outer_select (legacy denominator path)', () => {
    it('wraps the rate division in ROUND when decimals is set', () => {
      const { sql } = emit_rate_outer_select({
        column_def: make_column_def(2),
        cte_name: 'denom_cte',
        column_index: 0,
        params: {},
        identity_id: 'player_year'
      })
      expect(sql).to.match(/^ROUND\(.*, 2\) AS synthetic_col_0$/)
    })

    it('emits no ROUND when decimals is null', () => {
      const { sql } = emit_rate_outer_select({
        column_def: make_column_def(null),
        cte_name: 'denom_cte',
        column_index: 0,
        params: {},
        identity_id: 'player_year'
      })
      expect(sql).to.not.match(/ROUND/)
    })
  })

  describe('aggregator_rate.emit_outer_select (period-CTE path)', () => {
    it('wraps the rate division in ROUND when decimals is set', () => {
      const { sql } = aggregator_rate.emit_outer_select({
        column_def: make_column_def(2),
        cte_name: 'rate_cte',
        column_index: 0,
        params: {},
        identity_id: 'player_year'
      })
      expect(sql).to.match(/^ROUND\(SUM\(.*\) \/ NULLIF\(COUNT\(.*\), 0\), 2\)/)
    })

    it('emits no ROUND when decimals is null', () => {
      const { sql } = aggregator_rate.emit_outer_select({
        column_def: make_column_def(null),
        cte_name: 'rate_cte',
        column_index: 0,
        params: {},
        identity_id: 'player_year'
      })
      expect(sql).to.not.match(/ROUND/)
    })
  })
})
