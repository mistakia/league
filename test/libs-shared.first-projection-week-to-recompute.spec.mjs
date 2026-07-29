/* global describe it after */
import * as chai from 'chai'
import MockDate from 'mockdate'

import first_projection_week_to_recompute from '#libs-shared/first-projection-week-to-recompute.mjs'
import { current_season } from '#constants'

const expect = chai.expect

// This spec exists to protect a point-in-time guarantee that nothing else in
// the codebase enforces. `process-projections` recomputes only weeks from
// `current_season.week` onward, which is why a completed week's
// `projections_index` row still holds the projection as it stood at gametime,
// and why 2020-2023 weekly projections are usable as backtest features.
//
// Lowering that bound to 0 would overwrite every completed week with today's
// projections. It would not throw, and `projections_index` has no timestamp
// column, so the damage would be both silent and undetectable after the fact.
// If a change makes this file fail, the change is destroying history -- the
// spec is not the thing that is wrong.
describe('libs-shared/first-projection-week-to-recompute', function () {
  after(() => MockDate.reset())

  describe('the current season', function () {
    it('starts at the current week, so completed weeks are never recomputed', function () {
      MockDate.set('2026-10-20T12:00:00Z')
      const year = current_season.year
      const first_week = first_projection_week_to_recompute({ year })

      expect(first_week).to.equal(current_season.week)
      expect(first_week).to.be.above(
        0,
        'mid-season must not recompute from week 0'
      )
    })

    it('excludes every week already played', function () {
      MockDate.set('2026-10-20T12:00:00Z')
      const first_week = first_projection_week_to_recompute({
        year: current_season.year
      })

      // The loop in process-projections runs `for (week = first_week; ...)`,
      // so any week strictly below first_week is left untouched. Assert the
      // set of protected weeks is non-empty and contains no live week.
      const protected_weeks = []
      for (let week = 1; week < first_week; week++) protected_weeks.push(week)

      expect(protected_weeks).to.not.be.empty
      expect(protected_weeks).to.not.include(current_season.week)
      expect(Math.max(...protected_weeks)).to.equal(current_season.week - 1)
    })
  })

  describe('past seasons', function () {
    it('starts at 0, because a completed season has no week to preserve', function () {
      MockDate.set('2026-10-20T12:00:00Z')
      expect(
        first_projection_week_to_recompute({ year: current_season.year - 1 })
      ).to.equal(0)
      expect(
        first_projection_week_to_recompute({ year: current_season.year - 3 })
      ).to.equal(0)
    })
  })

  describe('the offseason carve-out', function () {
    // Week 0 is the season-long grain and is NOT frozen: in the offseason
    // current_season.week is 0, so week 0 sits inside the recompute range and
    // is rewritten on every run. This is why a past season's week-0 row
    // reflects the END of that season rather than its preseason, and why it
    // must not be used as a preseason feature.
    it('recomputes from week 0 in the offseason, leaving week 0 unfrozen', function () {
      MockDate.set('2026-07-29T12:00:00Z')

      expect(current_season.week).to.equal(0)
      expect(
        first_projection_week_to_recompute({ year: current_season.year })
      ).to.equal(0)
    })
  })
})
