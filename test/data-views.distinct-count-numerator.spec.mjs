/* global describe it */

import * as chai from 'chai'

import {
  build_batched_period_cte,
  build_period_cte
} from '#libs-server/data-views/output-aggregator/build-period-cte.mjs'
import { compute_measure_alias } from '#libs-server/data-views/output-aggregator/measure-batch.mjs'

const expect = chai.expect

const build = (measures) =>
  build_batched_period_cte({
    measure_source: 'plays',
    measure_predicate: null,
    pid_columns: ['bc_pid'],
    apply_filters: null,
    measures,
    period: 'game',
    query_context: { row_axes: [] },
    identity_id: 'player_year',
    params: {}
  }).toString()

describe('data-views distinct-count numerator', () => {
  it('emits SUM(expr) for an additive measure (unchanged default)', () => {
    const sql = build([
      { alias: 'm_sum', measure_expr: 'rush_yards', aggregate: 'sum' }
    ])
    expect(sql).to.match(/SUM\(rush_yards\) AS m_sum/)
    expect(sql).to.not.match(/COUNT\(DISTINCT/)
  })

  it('defaults to SUM when no aggregate is supplied (back-compat)', () => {
    const sql = build([{ alias: 'm_sum', measure_expr: 'rush_yards' }])
    expect(sql).to.match(/SUM\(rush_yards\) AS m_sum/)
  })

  it('emits COUNT(DISTINCT expr) for a count_distinct measure', () => {
    const sql = build([
      {
        alias: 'm_dc',
        measure_expr: "CONCAT(esbid, '_', series_sequence)",
        aggregate: 'count_distinct'
      }
    ])
    expect(sql).to.match(
      /COUNT\(DISTINCT CONCAT\(esbid, '_', series_sequence\)\) AS m_dc/
    )
  })

  it('co-locates a sum and a count_distinct measure in one CTE', () => {
    const sql = build([
      { alias: 'm_sum', measure_expr: 'rush_yards', aggregate: 'sum' },
      {
        alias: 'm_dc',
        measure_expr: "CONCAT(esbid, '_', series_sequence)",
        aggregate: 'count_distinct'
      }
    ])
    expect(sql).to.match(/SUM\(rush_yards\) AS m_sum/)
    expect(sql).to.match(
      /COUNT\(DISTINCT CONCAT\(esbid, '_', series_sequence\)\) AS m_dc/
    )
  })

  it('build_period_cte single wrapper carries the aggregate selector', () => {
    const sql = build_period_cte({
      measure_source: 'plays',
      measure_expr: "CONCAT(esbid, '_', drive_sequence)",
      measure_predicate: null,
      pid_columns: ['bc_pid'],
      apply_filters: null,
      period: 'game',
      query_context: { row_axes: [] },
      identity_id: 'player_year',
      params: {},
      aggregate: 'count_distinct'
    }).toString()
    expect(sql).to.match(
      /COUNT\(DISTINCT CONCAT\(esbid, '_', drive_sequence\)\) AS measure_total/
    )
  })

  it('compute_measure_alias distinguishes sum from count_distinct of the same expr', () => {
    const measure_expr = () => "CONCAT(esbid, '_', series_sequence)"
    const sum_alias = compute_measure_alias({
      column_def: {
        column_id: 'c',
        measure_source: 'plays',
        measure_expr,
        aggregate: 'sum'
      },
      params: {},
      identity_id: 'player_year'
    })
    const dc_alias = compute_measure_alias({
      column_def: {
        column_id: 'c',
        measure_source: 'plays',
        measure_expr,
        aggregate: 'count_distinct'
      },
      params: {},
      identity_id: 'player_year'
    })
    expect(sum_alias).to.not.equal(dc_alias)
  })
})
