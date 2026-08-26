/* global describe it */

import * as chai from 'chai'

import {
  guarded_divide,
  render_combine_accumulators
} from '#libs-server/data-views/measure/combine-accumulators.mjs'

const expect = chai.expect

// Both cases pin arithmetic that is silently wrong rather than loud when it
// breaks: bigint division truncates instead of erroring, and a zero
// denominator answering 0 is indistinguishable from a real zero downstream.

const WOPR_COMBINE = (a, { divide }) =>
  `${divide({ numerator: a.player_targets, denominator: a.team_targets, scale: '1.5' })} + ${divide({ numerator: a.player_air_yards, denominator: a.team_air_yards, scale: '0.7' })}`

const normalize = (sql) => sql.replace(/\s+/g, ' ').trim()

describe('data-views combine-accumulators rendering', () => {
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
})
