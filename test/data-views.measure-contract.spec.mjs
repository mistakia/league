/* global describe it */

import * as chai from 'chai'

import { derive_measure } from '#libs-server/data-views/measure/measure-contract.mjs'

const expect = chai.expect

describe('data-views measure-contract', () => {
  describe('derive_measure -- additive', () => {
    it('emits a bare SUM season render when decimals is null', () => {
      const result = derive_measure({
        subject_grain: 'team',
        stat_name: 'rush_yds_from_plays',
        measure: {
          accumulators: { value: { aggregate: 'sum', expr: 'rush_yards' } },
          combine_accumulators: 'identity'
        }
      })
      expect(result.with_select).to.equal('SUM(rush_yards)')
      expect(result.aggregate).to.equal('sum')
      expect(result.decimals).to.equal(null)
      expect(result.measure_expr()).to.equal('rush_yards')
    })

    it('rounds the season render when decimals is set', () => {
      const result = derive_measure({
        subject_grain: 'team',
        stat_name: 'weighted_opportunity_from_plays',
        measure: {
          accumulators: {
            value: {
              aggregate: 'sum',
              expr: 'CASE WHEN bc_pid IS NOT NULL THEN 1 ELSE 0 END'
            }
          },
          combine_accumulators: 'identity',
          decimals: 2
        }
      })
      expect(result.with_select).to.equal(
        'ROUND(SUM(CASE WHEN bc_pid IS NOT NULL THEN 1 ELSE 0 END), 2)'
      )
      expect(result.aggregate).to.equal('sum')
      expect(result.decimals).to.equal(2)
    })
  })

  describe('derive_measure -- a bare distinct count', () => {
    it('emits a bare COUNT(DISTINCT) season render and count_distinct aggregate', () => {
      const result = derive_measure({
        subject_grain: 'team',
        stat_name: 'team_series_count_from_plays',
        measure: {
          accumulators: {
            value: {
              aggregate: 'count_distinct',
              expr: "CONCAT(esbid, '_', series_sequence)"
            }
          },
          combine_accumulators: 'identity'
        }
      })
      expect(result.with_select).to.equal(
        "COUNT(DISTINCT CONCAT(esbid, '_', series_sequence))"
      )
      expect(result.aggregate).to.equal('count_distinct')
      expect(result.measure_expr()).to.equal(
        "CONCAT(esbid, '_', series_sequence)"
      )
    })

    it('defaults decimals to 2 for the rate render but keeps the season render bare', () => {
      const result = derive_measure({
        subject_grain: 'team',
        stat_name: 'team_drive_count_from_plays',
        measure: {
          accumulators: {
            value: {
              aggregate: 'count_distinct',
              expr: "CONCAT(esbid, '_', drive_sequence)"
            }
          },
          combine_accumulators: 'identity'
        }
      })
      expect(result.decimals).to.equal(2)
      // season render is bare regardless of decimals
      expect(result.with_select).to.not.match(/ROUND/)
    })

    it('honors an explicit decimals override', () => {
      const result = derive_measure({
        subject_grain: 'team',
        stat_name: 'team_drive_count_from_plays',
        measure: {
          accumulators: {
            value: {
              aggregate: 'count_distinct',
              expr: "CONCAT(esbid, '_', drive_sequence)"
            }
          },
          combine_accumulators: 'identity',
          decimals: 0
        }
      })
      expect(result.decimals).to.equal(0)
    })
  })

  describe('supports_output derivation', () => {
    it('derives the period list from the SUBJECT GRAIN, not from a declaration', () => {
      const result = derive_measure({
        subject_grain: 'team',
        stat_name: 'rush_yds_from_plays',
        measure: {
          accumulators: { value: { aggregate: 'sum', expr: 'rush_yards' } },
          combine_accumulators: 'identity'
        }
      })
      // All three of the registry's aggregations, `mean` included as of the
      // per-period summary. `sum` is deliberately absent: it is the wire value
      // for NO aggregation and no plugin serves it.
      expect(result.supports_output.aggregations).to.deep.equal([
        'rate',
        'count',
        'mean'
      ])
      expect(result.supports_output.periods.slice(0, 2)).to.deep.equal([
        'game',
        'season'
      ])
      expect(result.supports_output.periods).to.include('team_play')
      // A team subject has no player-action denominator units. This is the
      // second axis the fact source alone could not supply: both from-plays
      // factories read the same `plays` source.
      expect(result.supports_output.periods).to.not.include('player_route')
    })
  })

  describe('fail-fast guard', () => {
    it('throws for an unknown aggregate', () => {
      expect(() =>
        derive_measure({
          subject_grain: 'team',
          stat_name: 'bad_col',
          measure: {
            accumulators: { value: { aggregate: 'average', expr: 'x' } },
            combine_accumulators: 'identity'
          }
        })
      ).to.throw(/unknown aggregate/)
    })

    it('throws for a missing expr', () => {
      expect(() =>
        derive_measure({
          subject_grain: 'team',
          stat_name: 'bad_col',
          measure: {
            accumulators: { value: { aggregate: 'sum' } },
            combine_accumulators: 'identity'
          }
        })
      ).to.throw(/non-empty string expr/)
    })

    it('throws for an absent combine rather than assuming identity', () => {
      expect(() =>
        derive_measure({
          subject_grain: 'team',
          stat_name: 'bad_col',
          measure: {
            accumulators: { value: { aggregate: 'sum', expr: 'x' } }
          }
        })
      ).to.throw(/'identity' or a function/)
    })

    it('throws for an identity combine over two accumulators', () => {
      expect(() =>
        derive_measure({
          subject_grain: 'team',
          stat_name: 'bad_col',
          measure: {
            accumulators: {
              numerator: { aggregate: 'sum', expr: 'a' },
              denominator: { aggregate: 'sum', expr: 'b' }
            },
            combine_accumulators: 'identity'
          }
        })
      ).to.throw(/identity requires exactly one/)
    })

    it('throws for a measure declaring no accumulators', () => {
      expect(() =>
        derive_measure({
          subject_grain: 'team',
          stat_name: 'bad_col',
          measure: { accumulators: {}, combine_accumulators: 'identity' }
        })
      ).to.throw(/declares no accumulators/)
    })

    it('throws for a missing measure object', () => {
      expect(() =>
        derive_measure({
          subject_grain: 'team',
          stat_name: 'bad_col',
          measure: null
        })
      ).to.throw(/requires a measure object/)
    })
  })
})
