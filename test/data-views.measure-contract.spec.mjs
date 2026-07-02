/* global describe it */

import * as chai from 'chai'

import {
  derive_measure,
  derive_periods_from_rate_types
} from '#libs-server/data-views/measure-contract.mjs'

const expect = chai.expect

const TEAM_RATE_TYPES = [
  'per_game',
  'per_team_half',
  'per_team_quarter',
  'per_team_play',
  'per_team_pass_play',
  'per_team_rush_play',
  'per_team_drive',
  'per_team_series'
]

describe('data-views measure-contract', () => {
  describe('derive_measure -- additive', () => {
    it('emits a bare SUM season render when decimals is null', () => {
      const result = derive_measure({
        stat_name: 'rush_yds_from_plays',
        measure: { kind: 'additive', expr: 'rush_yds' },
        supported_rate_types: TEAM_RATE_TYPES
      })
      expect(result.with_select).to.equal('SUM(rush_yds)')
      expect(result.aggregate).to.equal('sum')
      expect(result.decimals).to.equal(null)
      expect(result.measure_expr()).to.equal('rush_yds')
    })

    it('rounds the season render when decimals is set', () => {
      const result = derive_measure({
        stat_name: 'weighted_opportunity_from_plays',
        measure: {
          kind: 'additive',
          expr: 'CASE WHEN bc_pid IS NOT NULL THEN 1 ELSE 0 END',
          decimals: 2
        },
        supported_rate_types: TEAM_RATE_TYPES
      })
      expect(result.with_select).to.equal(
        'ROUND(SUM(CASE WHEN bc_pid IS NOT NULL THEN 1 ELSE 0 END), 2)'
      )
      expect(result.aggregate).to.equal('sum')
      expect(result.decimals).to.equal(2)
    })
  })

  describe('derive_measure -- distinct_count', () => {
    it('emits a bare COUNT(DISTINCT) season render and count_distinct aggregate', () => {
      const result = derive_measure({
        stat_name: 'team_series_count_from_plays',
        measure: {
          kind: 'distinct_count',
          expr: "CONCAT(esbid, '_', series_seq)"
        },
        supported_rate_types: TEAM_RATE_TYPES
      })
      expect(result.with_select).to.equal(
        "COUNT(DISTINCT CONCAT(esbid, '_', series_seq))"
      )
      expect(result.aggregate).to.equal('count_distinct')
      expect(result.measure_expr()).to.equal("CONCAT(esbid, '_', series_seq)")
    })

    it('defaults decimals to 2 for the rate render but keeps the season render bare', () => {
      const result = derive_measure({
        stat_name: 'team_drive_count_from_plays',
        measure: {
          kind: 'distinct_count',
          expr: "CONCAT(esbid, '_', drive_seq)"
        },
        supported_rate_types: TEAM_RATE_TYPES
      })
      expect(result.decimals).to.equal(2)
      // season render is bare regardless of decimals
      expect(result.with_select).to.not.match(/ROUND/)
    })

    it('honors an explicit decimals override', () => {
      const result = derive_measure({
        stat_name: 'team_drive_count_from_plays',
        measure: {
          kind: 'distinct_count',
          expr: "CONCAT(esbid, '_', drive_seq)",
          decimals: 0
        },
        supported_rate_types: TEAM_RATE_TYPES
      })
      expect(result.decimals).to.equal(0)
    })
  })

  describe('supports_output derivation', () => {
    it('prepends game/season to the canonical period list and echoes supported_rate_types', () => {
      const result = derive_measure({
        stat_name: 'rush_yds_from_plays',
        measure: { kind: 'additive', expr: 'rush_yds' },
        supported_rate_types: TEAM_RATE_TYPES
      })
      expect(result.supports_output.aggregations).to.deep.equal([
        'rate',
        'count'
      ])
      expect(result.supports_output.periods.slice(0, 2)).to.deep.equal([
        'game',
        'season'
      ])
      expect(result.supports_output.periods).to.include('team_play')
      expect(result.supported_rate_types).to.deep.equal(TEAM_RATE_TYPES)
    })
  })

  describe('derive_periods_from_rate_types', () => {
    it('strips the per_ prefix', () => {
      expect(
        derive_periods_from_rate_types(['per_game', 'per_team_play'])
      ).to.deep.equal(['game', 'team_play'])
    })
  })

  describe('fail-fast guard', () => {
    it('throws for an unknown measure kind', () => {
      expect(() =>
        derive_measure({
          stat_name: 'bad_col',
          measure: { kind: 'average', expr: 'x' },
          supported_rate_types: TEAM_RATE_TYPES
        })
      ).to.throw(/unknown measure kind/)
    })

    it('throws for a missing expr', () => {
      expect(() =>
        derive_measure({
          stat_name: 'bad_col',
          measure: { kind: 'additive' },
          supported_rate_types: TEAM_RATE_TYPES
        })
      ).to.throw(/non-empty string expr/)
    })

    it('throws for a missing measure object', () => {
      expect(() =>
        derive_measure({
          stat_name: 'bad_col',
          measure: null,
          supported_rate_types: TEAM_RATE_TYPES
        })
      ).to.throw(/requires a measure object/)
    })
  })
})
