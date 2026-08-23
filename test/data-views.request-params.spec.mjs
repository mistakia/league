/* global describe it */
import * as chai from 'chai'

import build_data_view_request_params from '#app/core/data-views/build-data-view-request-params.mjs'

const { expect } = chai

// Regression cover for the stale-pagination-cursor defect: a scroll to page two
// stored `offset: 500` in table_state, every later table_state change spread it
// forward, and the next column add / sort / filter re-ran the query from row 500
// while REPLACING the result -- so the top 500 rows vanished from the table.
//
// Each assertion below is paired with the input that used to produce the bug, so
// a regression fails here rather than only in a browser.

const make_table_state = (overrides = {}) => ({
  columns: ['player_name'],
  prefix_columns: [],
  sort: [{ column_id: 'player_name', desc: true }],
  where: [],
  limit: 500,
  ...overrides
})

describe('data-views request params', function () {
  describe('offset is a per-request cursor, not table_state', function () {
    it('pins offset to 0 when a stale one rides in on table_state', function () {
      const params = build_data_view_request_params({
        view_id: 'v1',
        // exactly what a scroll to page two used to leave behind
        table_state: make_table_state({ offset: 500 })
      })

      expect(params.offset).to.equal(0)
      expect(params.append_results).to.equal(false)
    })

    it('still pins offset to 0 when the caller passes none and none is stored', function () {
      const params = build_data_view_request_params({
        view_id: 'v1',
        table_state: make_table_state()
      })

      expect(params.offset).to.equal(0)
    })

    it('carries the caller cursor on a pagination request', function () {
      const params = build_data_view_request_params({
        view_id: 'v1',
        table_state: make_table_state(),
        offset: 500,
        append_results: true
      })

      expect(params.offset).to.equal(500)
      expect(params.append_results).to.equal(true)
    })

    it('prefers the caller cursor over a conflicting stored one', function () {
      const params = build_data_view_request_params({
        view_id: 'v1',
        table_state: make_table_state({ offset: 9000 }),
        offset: 500,
        append_results: true
      })

      expect(params.offset).to.equal(500)
    })
  })

  it('passes the rest of table_state through untouched', function () {
    const table_state = make_table_state({
      row_grain: ['team'],
      rank_aggregation: [{ column_id: 'player_name' }]
    })
    const params = build_data_view_request_params({
      view_id: 'v1',
      table_state
    })

    expect(params.view_id).to.equal('v1')
    expect(params.columns).to.eql(table_state.columns)
    expect(params.sort).to.eql(table_state.sort)
    expect(params.row_grain).to.eql(['team'])
    expect(params.rank_aggregation).to.eql(table_state.rank_aggregation)
  })
})
