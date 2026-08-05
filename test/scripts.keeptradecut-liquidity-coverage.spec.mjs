/* global describe it */

import * as chai from 'chai'

import {
  classify_liquidity_coverage,
  MAX_CONSECUTIVE_MISSING_DAYS
} from '#scripts/audit-keeptradecut-liquidity-coverage.mjs'
import {
  classify_liquidity_recovery,
  COVERAGE_COLLAPSE_FRACTION
} from '#scripts/import-keeptradecut-liquidity.mjs'

chai.should()
const expect = chai.expect

const WINDOW_START = '2026-07-01'
const WINDOW_END = '2026-07-10'

const all_days = [
  '2026-07-01',
  '2026-07-02',
  '2026-07-03',
  '2026-07-04',
  '2026-07-05',
  '2026-07-06',
  '2026-07-07',
  '2026-07-08',
  '2026-07-09',
  '2026-07-10'
]

const classify_days = (collected_days) =>
  classify_liquidity_coverage({
    collected_days,
    window_start: WINDOW_START,
    window_end: WINDOW_END
  })

// A healthy recovery run, used as the control that each shortfall case is
// varied from -- so a classifier that stopped finding anything cannot pass by
// reporting clean on every input.
const HEALTHY_RECOVERY = {
  page_player_count: 500,
  eligible_player_count: 460,
  resolved_player_count: 458,
  rows_written: 916,
  reference_rows: 924
}

describe('SCRIPTS keeptradecut liquidity coverage', function () {
  describe('classify_liquidity_coverage', function () {
    it('reports full coverage with no gap', () => {
      const result = classify_days(all_days)
      result.expected_day_count.should.equal(10)
      result.collected_day_count.should.equal(10)
      result.missing_days.should.deep.equal([])
      result.current_gap_streak.should.equal(0)
      result.trailing_miss_rate.should.equal(0)
    })

    it('counts an interior single-day gap without a current streak', () => {
      const result = classify_days(all_days.filter((d) => d !== '2026-07-04'))
      result.missing_days.should.deep.equal(['2026-07-04'])
      result.current_gap_streak.should.equal(0)
      result.trailing_miss_rate.should.equal(0.1)
    })

    it('does not reach the threshold on a single trailing missing day', () => {
      const result = classify_days(all_days.filter((d) => d !== WINDOW_END))
      result.current_gap_streak.should.equal(1)
      result.current_gap_streak.should.be.below(MAX_CONSECUTIVE_MISSING_DAYS)
    })

    it('reaches the threshold on two consecutive trailing missing days', () => {
      const result = classify_days(
        all_days.filter((d) => d !== '2026-07-09' && d !== WINDOW_END)
      )
      result.current_gap_streak.should.equal(2)
      result.current_gap_streak.should.be.at.least(MAX_CONSECUTIVE_MISSING_DAYS)
    })

    it('does not chain a trailing streak across a collected day', () => {
      // 07-08 and 07-10 missing, 07-09 collected: two missing days in the
      // window but the current streak is only the last one.
      const result = classify_days(
        all_days.filter((d) => d !== '2026-07-08' && d !== WINDOW_END)
      )
      result.missing_days.should.deep.equal(['2026-07-08', '2026-07-10'])
      result.current_gap_streak.should.equal(1)
    })

    it('treats a wholly empty window as a full-length streak', () => {
      const result = classify_days([])
      result.collected_day_count.should.equal(0)
      result.current_gap_streak.should.equal(10)
      result.trailing_miss_rate.should.equal(1)
    })

    it('ignores collected days outside the window', () => {
      const result = classify_days([...all_days, '2026-06-30', '2026-07-11'])
      result.collected_day_count.should.equal(10)
      result.missing_days.should.deep.equal([])
    })

    it('handles a single-day window', () => {
      const result = classify_liquidity_coverage({
        collected_days: [],
        window_start: WINDOW_END,
        window_end: WINDOW_END
      })
      result.expected_day_count.should.equal(1)
      result.current_gap_streak.should.equal(1)
    })
  })

  describe('classify_liquidity_recovery', function () {
    it('reports no shortfall on a healthy recovery', () => {
      const result = classify_liquidity_recovery(HEALTHY_RECOVERY)
      result.shortfalls.should.deep.equal([])
      expect(result.coverage_fraction).to.be.above(COVERAGE_COLLAPSE_FRACTION)
    })

    it('fails on an empty page and reports nothing else', () => {
      const result = classify_liquidity_recovery({
        ...HEALTHY_RECOVERY,
        page_player_count: 0
      })
      result.shortfalls.should.have.length(1)
      result.shortfalls[0].should.match(/^domain:/)
      expect(result.coverage_fraction).to.equal(null)
    })

    it('fails when no page player resolves to a pid', () => {
      const result = classify_liquidity_recovery({
        ...HEALTHY_RECOVERY,
        resolved_player_count: 0,
        rows_written: 0
      })
      result.shortfalls
        .some((s) => s.startsWith('resolution:'))
        .should.equal(true)
      result.shortfalls.some((s) => s.startsWith('write:')).should.equal(true)
    })

    it('fails when players resolved but nothing was written', () => {
      const result = classify_liquidity_recovery({
        ...HEALTHY_RECOVERY,
        rows_written: 0
      })
      result.shortfalls.some((s) => s.startsWith('write:')).should.equal(true)
    })

    it('fails on a coverage collapse against the recent reference', () => {
      const result = classify_liquidity_recovery({
        ...HEALTHY_RECOVERY,
        rows_written: 100
      })
      result.shortfalls
        .some((s) => s.startsWith('coverage:'))
        .should.equal(true)
    })

    it('does not apply the coverage floor with no reference to compare against', () => {
      // First-ever collected day: there is no prior day, so the floor has no
      // baseline and must not manufacture a finding.
      const result = classify_liquidity_recovery({
        ...HEALTHY_RECOVERY,
        rows_written: 100,
        reference_rows: 0
      })
      result.shortfalls.should.deep.equal([])
      expect(result.coverage_fraction).to.equal(null)
    })
  })
})
