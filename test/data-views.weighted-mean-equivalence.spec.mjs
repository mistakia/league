/* global describe it before */

import * as chai from 'chai'

import {
  guarded_divide,
  render_combine_accumulators
} from '#libs-server/data-views/measure/combine-accumulators.mjs'

const expect = chai.expect

// `design-expression-columns` deliberately keeps a SEPARATE emitter from this
// one. The decisive axis is trust: an expression AST arrives over the wire and
// that design mandates `$$strict` schemas and knex bindings with no
// template-literal splice anywhere, written against a confirmed unauthenticated
// injection. A combine is a trusted fragment a league developer writes in a
// column-definition file. One module holding both is that bug's shape.
//
// What the two DO share is the weighted-mean arithmetic, and sharing an emitter
// is exactly what they must not do -- so the guard is an oracle rather than a
// convention. Without one they drift into two answers for WOPR's shape.
//
// It SKIPS cleanly while `expression-compiler.mjs` does not exist, because that
// task may land after this one and a spec that fails on a missing module is a
// red suite rather than a signal.

const WOPR_COMBINE = (a, { divide }) =>
  `${divide({ numerator: a.player_targets, denominator: a.team_targets, scale: '1.5' })} + ${divide({ numerator: a.player_air_yards, denominator: a.team_air_yards, scale: '0.7' })}`

const normalize = (sql) => sql.replace(/\s+/g, ' ').trim()

describe('data-views weighted-mean equivalence with the expression compiler', () => {
  let expression_compiler = null

  before(async () => {
    try {
      expression_compiler = await import(
        '#libs-server/data-views/expression-compiler.mjs'
      )
    } catch {
      expression_compiler = null
    }
  })

  // Runs whether or not the sibling module exists. It is the half of the oracle
  // this repo owns, and it is what the equivalence assertion below compares
  // against, so a regression here is caught even while the other side is absent.
  it('renders WOPR as a weighted sum of two guarded divisions', () => {
    const sql = render_combine_accumulators({
      measure_name: 'weighted_opp_rating_from_plays',
      combine_accumulators: WOPR_COMBINE,
      accumulator_sql: {
        player_targets: 'COUNT(a)',
        team_targets: 'SUM(b)',
        player_air_yards: 'SUM(c)',
        team_air_yards: 'SUM(d)'
      }
    })
    expect(normalize(sql)).to.equal(
      '1.5 * COUNT(a) / NULLIF(SUM(b), 0) + 0.7 * SUM(c) / NULLIF(SUM(d), 0)'
    )
    // The scale sits to the LEFT of the division. `1.5 * (num / den)` is bigint
    // integer division and collapses WOPR to 0 for every player.
    expect(sql).to.not.match(/1\.5 \* \(/)
    expect(sql).to.not.match(/0\.7 \* \(/)
  })

  it('answers a zero denominator with NULL, not zero', () => {
    const sql = guarded_divide({ numerator: 'SUM(a)', denominator: 'SUM(b)' })
    expect(sql).to.match(/NULLIF\(SUM\(b\), 0\)/)
    expect(sql).to.not.match(/ELSE 0 END/)
    // Without a scale the numerator carries the cast, because bigint / bigint
    // truncates.
    expect(sql).to.match(/SUM\(a\)::decimal/)
  })

  it('emits arithmetically equivalent SQL to the expression compiler', function () {
    if (!expression_compiler?.weighted_mean) {
      // Not a silent pass: the reason is printed and the test is pending rather
      // than green.
      this.skip()
    }

    const operands = [
      { numerator: 'COUNT(a)', denominator: 'SUM(b)', weight: '1.5' },
      { numerator: 'SUM(c)', denominator: 'SUM(d)', weight: '0.7' }
    ]

    const combine_sql = render_combine_accumulators({
      measure_name: 'weighted_opp_rating_from_plays',
      combine_accumulators: WOPR_COMBINE,
      accumulator_sql: {
        player_targets: 'COUNT(a)',
        team_targets: 'SUM(b)',
        player_air_yards: 'SUM(c)',
        team_air_yards: 'SUM(d)'
      }
    })
    const expression_sql = expression_compiler.weighted_mean({ operands })

    expect(normalize(expression_sql)).to.equal(normalize(combine_sql))
  })
})
