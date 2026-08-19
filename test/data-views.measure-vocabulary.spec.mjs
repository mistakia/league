/* global describe before it */
import * as chai from 'chai'

import db from '#db'
import {
  AGGREGATES,
  render_accumulator,
  render_accumulators
} from '#libs-server/data-views/measure/accumulator.mjs'
import { render_combine_accumulators } from '#libs-server/data-views/measure/combine-accumulators.mjs'
import {
  derive_supports_output,
  PARTITION_PERIODS
} from '#libs-server/data-views/measure/capability.mjs'

const { expect } = chai

// Evaluate a rendered combine against a literal fact table, so the NULL and
// truncation dispositions are executed rather than asserted about a string.
const evaluate = async ({ sql, rows }) => {
  const values = rows.map(([n, d]) => `(${n}, ${d})`).join(', ')
  const result = await db.raw(
    `select ${sql} as value from (values ${values}) as facts(n, d)`
  )
  return result.rows[0].value
}

const ratio_accumulators = {
  numerator: { aggregate: 'sum', expr: 'n' },
  denominator: { aggregate: 'sum', expr: 'd' }
}

describe('data views measure vocabulary', function () {
  before(async function () {
    await db.raw('select 1')
  })

  describe('accumulator', function () {
    it('renders every aggregate in the closed set', function () {
      expect(AGGREGATES).to.deep.equal(['sum', 'count', 'count_distinct'])
      expect(
        render_accumulator({ accumulator: { aggregate: 'sum', expr: 'x' } })
      ).to.equal('SUM(x)')
      expect(
        render_accumulator({ accumulator: { aggregate: 'count', expr: 'x' } })
      ).to.equal('COUNT(x)')
      expect(
        render_accumulator({
          accumulator: { aggregate: 'count_distinct', expr: 'x' }
        })
      ).to.equal('COUNT(DISTINCT x)')
    })

    it('throws on an unknown aggregate', function () {
      expect(() =>
        render_accumulator({
          label: 'demo.value',
          accumulator: { aggregate: 'average', expr: 'x' }
        })
      ).to.throw(/unknown aggregate 'average'/)
    })

    it('throws on an empty expression', function () {
      expect(() =>
        render_accumulator({
          label: 'demo.value',
          accumulator: { aggregate: 'sum', expr: '' }
        })
      ).to.throw(/non-empty string expr/)
    })

    it('throws when a measure declares no accumulators', function () {
      expect(() =>
        render_accumulators({ measure_name: 'demo', accumulators: {} })
      ).to.throw(/declares no accumulators/)
    })
  })

  describe('combine_accumulators', function () {
    it('emits an identity combine with no cast', function () {
      const sql = render_combine_accumulators({
        measure_name: 'demo',
        combine_accumulators: 'identity',
        accumulator_sql: render_accumulators({
          measure_name: 'demo',
          accumulators: { value: { aggregate: 'sum', expr: 'n' } }
        })
      })
      expect(sql).to.equal('SUM(n)')
      expect(sql).to.not.include('::decimal')
    })

    it('refuses an identity combine over more than one accumulator', function () {
      expect(() =>
        render_combine_accumulators({
          measure_name: 'demo',
          combine_accumulators: 'identity',
          accumulator_sql: render_accumulators({
            measure_name: 'demo',
            accumulators: ratio_accumulators
          })
        })
      ).to.throw(/identity requires exactly one/)
    })

    it('refuses an absent combine rather than defaulting to identity', function () {
      expect(() =>
        render_combine_accumulators({
          measure_name: 'demo',
          combine_accumulators: undefined,
          accumulator_sql: { value: 'SUM(n)' }
        })
      ).to.throw(/'identity' or a function/)
    })

    it('answers NULL for a ratio with a zero denominator', async function () {
      const sql = render_combine_accumulators({
        measure_name: 'demo',
        combine_accumulators: (a, { divide }) =>
          divide({ numerator: a.numerator, denominator: a.denominator }),
        accumulator_sql: render_accumulators({
          measure_name: 'demo',
          accumulators: ratio_accumulators
        })
      })
      expect(
        await evaluate({
          sql,
          rows: [
            [1, 0],
            [2, 0]
          ]
        })
      ).to.equal(null)
    })

    it('does not truncate an integer ratio', async function () {
      const sql = render_combine_accumulators({
        measure_name: 'demo',
        combine_accumulators: (a, { divide }) =>
          divide({ numerator: a.numerator, denominator: a.denominator }),
        accumulator_sql: render_accumulators({
          measure_name: 'demo',
          accumulators: ratio_accumulators
        })
      })
      // 13 / 2 -- a bigint quotient would answer 6.
      expect(Number(await evaluate({ sql, rows: [[13, 2]] }))).to.equal(6.5)
    })

    it('scales a percentage to the left of the division', async function () {
      const sql = render_combine_accumulators({
        measure_name: 'demo',
        combine_accumulators: (a, { divide }) =>
          divide({
            numerator: a.numerator,
            denominator: a.denominator,
            scale: '100.0'
          }),
        accumulator_sql: render_accumulators({
          measure_name: 'demo',
          accumulators: ratio_accumulators
        })
      })
      expect(sql).to.equal('100.0 * SUM(n) / NULLIF(SUM(d), 0)')
      // A right-of-division scale would answer 0 through integer division.
      expect(Number(await evaluate({ sql, rows: [[1, 4]] }))).to.equal(25)
      expect(await evaluate({ sql, rows: [[1, 0]] })).to.equal(null)
    })

    it('combines four accumulators with weights, WOPR shaped', async function () {
      const accumulator_sql = render_accumulators({
        measure_name: 'wopr',
        accumulators: {
          player_targets: { aggregate: 'sum', expr: 'n' },
          team_targets: { aggregate: 'sum', expr: 'd' },
          player_air_yards: { aggregate: 'sum', expr: 'n * 10' },
          team_air_yards: { aggregate: 'sum', expr: 'd * 10' }
        }
      })
      const sql = render_combine_accumulators({
        measure_name: 'wopr',
        combine_accumulators: (a, { divide }) =>
          `${divide({
            numerator: a.player_targets,
            denominator: a.team_targets,
            scale: '1.5'
          })} + ${divide({
            numerator: a.player_air_yards,
            denominator: a.team_air_yards,
            scale: '0.7'
          })}`,
        accumulator_sql
      })
      // Each weight sits left of its division, or the quotient is integer
      // division and the whole measure collapses to 0.
      expect(sql).to.include('1.5 * SUM(n) / NULLIF(SUM(d), 0)')
      expect(sql).to.include('0.7 * SUM(n * 10) / NULLIF(SUM(d * 10), 0)')
      expect(Number(await evaluate({ sql, rows: [[1, 4]] }))).to.equal(0.55)
      expect(await evaluate({ sql, rows: [[1, 0]] })).to.equal(null)
    })

    it('applies decimals outside the combine', function () {
      const sql = render_combine_accumulators({
        measure_name: 'demo',
        combine_accumulators: 'identity',
        accumulator_sql: { value: 'SUM(n)' },
        decimals: 2
      })
      expect(sql).to.equal('ROUND(SUM(n), 2)')
    })
  })

  describe('capability', function () {
    it('offers rate and mean together, whether or not a combine is present', function () {
      // Capability is derived from the fact source and the subject grain
      // alone; the measure's shape is not an input, so a ratio column and an
      // additive column on the same source advertise the same thing.
      const capability = derive_supports_output({
        denominator_unit_periods: ['game', 'team_play', 'player_route']
      })
      expect(capability.aggregations).to.deep.equal(['rate', 'count', 'mean'])
      expect(capability.periods_by_aggregation.rate).to.include('player_route')
      expect(capability.periods_by_aggregation.mean).to.deep.equal(
        PARTITION_PERIODS.slice()
      )
    })

    it('keeps a denominator unit out of the per-period vocabulary', function () {
      const capability = derive_supports_output({
        denominator_unit_periods: ['game', 'team_play']
      })
      for (const aggregation of ['count', 'mean']) {
        expect(capability.periods_by_aggregation[aggregation]).to.not.include(
          'team_play'
        )
      }
    })

    it('offers no game period to a season-grain source', function () {
      const capability = derive_supports_output({
        denominator_unit_periods: [],
        partition_periods: ['season']
      })
      expect(capability.periods).to.deep.equal(['season'])
      expect(capability.aggregations).to.deep.equal(['count', 'mean'])
    })

    it('advertises nothing when the source supports no period at all', function () {
      expect(
        derive_supports_output({
          denominator_unit_periods: [],
          partition_periods: []
        })
      ).to.equal(null)
    })
  })
})
