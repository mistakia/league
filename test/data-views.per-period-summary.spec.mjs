/* global describe it */

import * as chai from 'chai'

import { get_data_view_results_query } from '#libs-server'

const expect = chai.expect

// The gate on the per-period FAN-OUT, which no value fixture can be.
//
// A period CTE is at (subject, period_key, year) grain, finer than the outer
// row, and the outer join carries no period predicate -- so two per-period
// columns with different scans cross-multiply. Every aggregate the outer SELECT
// emits over that product is nonetheless correct: COUNT(DISTINCT period_key) is
// immune structurally and AVG is immune because the multiplier is constant per
// group. So the defect is invisible to results, and the only honest oracle is
// the SHAPE of the emitted SQL: no relation carrying `period_key` may be joined
// to the outer query.
//
// Proven red at the pre-summary revision, where both count columns joined their
// period CTE directly.

const count_column = ({ column_id, threshold }) => ({
  column_id,
  params: {
    year: [2024],
    output: {
      period: 'game',
      aggregation: 'count',
      threshold: { op: '>=', value: threshold }
    }
  }
})

// The outer query's joins begin after the last CTE definition. Splitting on the
// FROM of the main select is what separates "this CTE selects from a period
// relation", which is the whole point, from "the outer query joins one", which
// is the defect.
const outer_query_of = (sql) => {
  const marker = ' from "player" '
  const index = sql.indexOf(marker)
  expect(index, 'could not locate the outer query').to.be.greaterThan(0)
  return sql.slice(index)
}

describe('data-views per-period summary', () => {
  it('joins no period-grain relation to the outer query', async () => {
    const { query } = await get_data_view_results_query({
      columns: [
        count_column({
          column_id: 'player_receiving_yards_from_plays',
          threshold: 100
        }),
        count_column({
          column_id: 'player_rush_yards_from_plays',
          threshold: 10
        })
      ]
    })
    const sql = query.toString()

    // Positive control: the period CTEs must exist and must carry period_key,
    // or the assertion below passes over a query that never built one.
    const period_ctes = [...sql.matchAll(/"(count_game_[0-9a-f]+)"/g)].map(
      (match) => match[1]
    )
    expect(new Set(period_ctes).size, 'expected two period CTEs').to.equal(2)
    expect(sql).to.match(/AS period_key/)

    const outer = outer_query_of(sql)
    for (const period_cte of new Set(period_ctes)) {
      expect(
        outer,
        `${period_cte} is joined to the outer query at period grain`
      ).to.not.match(new RegExp(`join "${period_cte}"`))
    }
  })

  it('joins one subject-grain summary per per-period column', async () => {
    const { query } = await get_data_view_results_query({
      columns: [
        count_column({
          column_id: 'player_receiving_yards_from_plays',
          threshold: 100
        }),
        count_column({
          column_id: 'player_rush_yards_from_plays',
          threshold: 10
        })
      ]
    })
    const outer = outer_query_of(query.toString())
    const joined = [
      ...outer.matchAll(/join "(per_period_summary_[0-9a-f]+)"/g)
    ].map((match) => match[1])
    expect(new Set(joined).size).to.equal(2)
    // Each summary joins on the subject alone at (subject, year) grain, which
    // is what makes it 1:1 with the outer row.
    for (const summary of new Set(joined)) {
      expect(outer).to.match(
        new RegExp(
          `join "${summary}" on "${summary}"\\."pid" = "player"\\."pid"`
        )
      )
    }
  })

  it('gives two thresholds over one measure their own summary columns', async () => {
    const { query } = await get_data_view_results_query({
      columns: [
        count_column({
          column_id: 'player_receiving_yards_from_plays',
          threshold: 100
        }),
        count_column({
          column_id: 'player_receiving_yards_from_plays',
          threshold: 50
        })
      ]
    })
    const sql = query.toString()
    // One scan, one summary -- the two columns share a period CTE because their
    // scans are identical.
    const summaries = new Set(
      [...sql.matchAll(/"(per_period_summary_[0-9a-f]+)"/g)].map((m) => m[1])
    )
    expect(summaries.size).to.equal(1)
    // ...and two DIFFERENT summary columns, because the threshold is part of
    // the question. Collapsing them would answer one column with the other's
    // number, which the result-equivalence fixture then catches.
    const summary_columns = new Set(
      [...sql.matchAll(/AS (s_[0-9a-f]+)/g)].map((m) => m[1])
    )
    expect(summary_columns.size).to.equal(2)
    expect(sql).to.match(/>= 100\)/)
    expect(sql).to.match(/>= 50\)/)
  })
})
