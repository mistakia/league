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
    it('starts at week 1, because a completed season has no week to preserve', function () {
      MockDate.set('2026-10-20T12:00:00Z')
      expect(
        first_projection_week_to_recompute({ year: current_season.year - 1 })
      ).to.equal(1)
      expect(
        first_projection_week_to_recompute({ year: current_season.year - 3 })
      ).to.equal(1)
    })
  })

  // The bound is never 0, on any clock or any year. `projections_index.week` is
  // a game week and nothing else -- the season-long row lives in
  // `season_projections_index`, which has no `week` column, and
  // `CHECK (week >= 1)` makes 0 unwritable -- so a 0 here would build a row the
  // table rejects.
  //
  // This replaces an "offseason carve-out" leg that asserted the opposite: that
  // the bound returns 0 in the offseason, leaving week 0 unfrozen and inside the
  // recompute range. That was true while week 0 was the season-long slot.
  describe('the floor at week 1', function () {
    it('returns 1 in the offseason, when the raw clock reads week 0', function () {
      MockDate.set('2026-07-29T12:00:00Z')

      expect(current_season.week).to.equal(0)
      expect(
        first_projection_week_to_recompute({ year: current_season.year })
      ).to.equal(1)
    })

    it('never returns 0, across the offseason, preseason and season', function () {
      for (const instant of [
        '2026-02-15T12:00:00Z',
        '2026-07-29T12:00:00Z',
        '2026-08-25T12:00:00Z',
        '2026-09-15T12:00:00Z',
        '2026-12-20T12:00:00Z'
      ]) {
        MockDate.set(instant)
        for (const year of [current_season.year, current_season.year - 2]) {
          expect(
            first_projection_week_to_recompute({ year }),
            `${instant} year=${year}`
          ).to.be.at.least(1)
        }
      }
    })
  })
})
