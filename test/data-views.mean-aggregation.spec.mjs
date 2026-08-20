/* global describe it */

import * as chai from 'chai'

import { has_aggregator } from '#libs-server/data-views/output-aggregator-registry.mjs'
import { normalize_output_param } from '#libs-server/data-views/normalize-output-param.mjs'
import { derive_supports_output } from '#libs-server/data-views/measure/capability.mjs'
import player_stats from '#libs-server/data-views-column-definitions/player-stats-from-plays-column-definitions.mjs'

const expect = chai.expect

// `mean` is registered over the PARTITION vocabulary only, and the boundary is
// the whole point: `period` names a span of time for the per-period family and
// a DENOMINATOR UNIT for the pooled family, so `mean per team_play` is not a
// narrower version of `rate per team_play` -- it is a question with no meaning.

const PARTITION_PERIODS = ['game', 'season']
const DENOMINATOR_UNIT_PERIODS = [
  'team_play',
  'team_pass_play',
  'team_drive',
  'player_route',
  'player_target',
  'player_reception'
]

describe('data-views mean aggregation', () => {
  describe('registration', () => {
    for (const period of PARTITION_PERIODS) {
      it(`offers mean and count over the partition period '${period}'`, () => {
        expect(has_aggregator({ period, aggregation: 'mean' })).to.equal(true)
        expect(has_aggregator({ period, aggregation: 'count' })).to.equal(true)
      })
    }

    for (const period of DENOMINATOR_UNIT_PERIODS) {
      it(`refuses mean over the denominator unit '${period}'`, () => {
        // Positive control: the period must be a REAL rate period, or this
        // asserts the absence of something that was never registered at all.
        expect(
          has_aggregator({ period, aggregation: 'rate' }),
          `${period} is not a registered rate period`
        ).to.equal(true)
        expect(has_aggregator({ period, aggregation: 'mean' })).to.equal(false)
      })
    }
  })

  describe('capability', () => {
    it('offers mean and rate together, on both measure shapes', () => {
      // The operator reversed an earlier exclusion that made these mutually
      // exclusive. They divide by different things -- games PLAYED against
      // periods CARRYING measure rows -- so a column offers whichever its
      // source supports, normally both, whatever its combine looks like.
      const capability = derive_supports_output({
        denominator_unit_periods: ['game', 'team_play']
      })
      expect(capability.aggregations).to.include('rate')
      expect(capability.aggregations).to.include('mean')
      expect(capability.periods_by_aggregation.mean).to.deep.equal(
        PARTITION_PERIODS
      )
    })

    it('advertises mean on an identity-combine column', () => {
      const def = player_stats.player_receiving_yards_from_plays
      expect(def.supports_output.aggregations).to.include('mean')
    })

    it('advertises mean on a COMBINED column too', () => {
      // This asserted the opposite while a combined measure was withheld: it
      // had no single measure_expr for the period CTE to sum, so nothing was
      // reachable. The period CTE renders the whole COMBINE over the period
      // group now, so a combined measure is aggregable on the same terms as an
      // additive one -- which was always the semantics, per the operator's
      // reversal of the measure-shape exclusion.
      const def = player_stats.player_target_share_from_plays
      expect(def.supports_output.aggregations).to.include('mean')
      expect(def.supports_output.aggregations).to.include('count')
      expect(def.supports_output.periods).to.deep.equal(PARTITION_PERIODS)
    })
  })

  describe('row-axis sanitization', () => {
    const column = (aggregation, period) => ({
      column_id: 'player_receiving_yards_from_plays',
      params: { output: { period, aggregation } }
    })

    it('drops a season mean under a year row axis', () => {
      // The season period IS the row there, so the mean is the value itself.
      const result = normalize_output_param({
        column: column('mean', 'season'),
        row_axes: ['year']
      })
      expect(result.params.output).to.equal(undefined)
    })

    it('keeps a game mean under a year row axis', () => {
      const result = normalize_output_param({
        column: column('mean', 'game'),
        row_axes: ['year']
      })
      expect(result.params.output.aggregation).to.equal('mean')
    })

    it('refuses a season mean under a week row axis', () => {
      expect(() =>
        normalize_output_param({
          column: column('mean', 'season'),
          row_axes: ['week']
        })
      ).to.throw(/season/)
    })
  })
})
