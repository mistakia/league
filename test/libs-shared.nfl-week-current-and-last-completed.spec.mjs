/* global describe, it, afterEach */

import * as chai from 'chai'
import MockDate from 'mockdate'

import { current_season } from '#constants'
import {
  current_nfl_week_params,
  current_nfl_week_identifier,
  last_completed_nfl_week_params,
  last_completed_nfl_week_identifier,
  nfl_week_offset_params
} from '#libs-shared/nfl-week-identifier.mjs'
import { set_date_for_week } from './fixtures/postseason.mjs'

const expect = chai.expect

// The offseason clock: `regular_season_start` itself, where `current_season.week`
// is 0 and `nfl_seas_type` is PRE. `set_date_for_week` maps a non-POST type to a
// bare week offset, so week 0 IS the offseason instant.
const set_offseason_date = () =>
  set_date_for_week({ seas_type: 'PRE', week: 0 })

describe('LIBS-SHARED current / last-completed NFL week pair', function () {
  afterEach(() => {
    MockDate.reset()
  })

  describe('current_nfl_week_params anchors on the current season', function () {
    it('offseason returns REG week 1 of the CURRENT year, not the last completed one', function () {
      set_offseason_date()
      const params = current_nfl_week_params()
      expect(params.year).to.equal(current_season.year)
      expect(params.seas_type).to.equal('REG')
      expect(params.week).to.equal(1)
      // The half the old suffix regexes never pinned.
      expect(params.year).to.not.equal(
        current_season.last_completed_season_year
      )
      expect(current_nfl_week_identifier()).to.equal(
        `${current_season.year}_REG_WEEK_1`
      )
    })

    it('live REG week returns that week of the current year', function () {
      set_date_for_week({ seas_type: 'REG', week: 3 })
      expect(current_nfl_week_identifier()).to.equal(
        `${current_season.year}_REG_WEEK_3`
      )
    })

    it('POST returns the postseason week of the current year', function () {
      set_date_for_week({ seas_type: 'POST', week: 2 })
      expect(current_nfl_week_identifier()).to.equal(
        `${current_season.year}_POST_WEEK_2`
      )
    })
  })

  describe('last_completed_nfl_week_params is one step back', function () {
    it('offseason returns the prior season POST week 4', function () {
      set_offseason_date()
      const params = last_completed_nfl_week_params()
      expect(params.year).to.equal(current_season.year - 1)
      expect(params.seas_type).to.equal('POST')
      expect(params.week).to.equal(4)
      expect(last_completed_nfl_week_identifier()).to.equal(
        `${current_season.year - 1}_POST_WEEK_4`
      )
    })

    it('live REG week 3 returns REG week 2 of the same year', function () {
      set_date_for_week({ seas_type: 'REG', week: 3 })
      expect(last_completed_nfl_week_identifier()).to.equal(
        `${current_season.year}_REG_WEEK_2`
      )
    })

    it('POST week 1 returns the final REG week of the same year', function () {
      set_date_for_week({ seas_type: 'POST', week: 1 })
      const params = last_completed_nfl_week_params()
      expect(params.year).to.equal(current_season.year)
      expect(params.seas_type).to.equal('REG')
      expect(params.week).to.be.at.least(17)
    })
  })

  describe('the cross-column invariant', function () {
    // The week member's year equals the season member in its own column.
    it('holds in the offseason', function () {
      set_offseason_date()
      expect(current_nfl_week_params().year).to.equal(current_season.year)
      expect(last_completed_nfl_week_params().year).to.equal(
        current_season.last_completed_season_year
      )
    })

    it('holds mid regular season', function () {
      set_date_for_week({ seas_type: 'REG', week: 5 })
      expect(current_nfl_week_params().year).to.equal(current_season.year)
      expect(last_completed_nfl_week_params().year).to.equal(
        current_season.last_completed_season_year
      )
    })

    it('holds in the postseason', function () {
      set_date_for_week({ seas_type: 'POST', week: 2 })
      expect(current_nfl_week_params().year).to.equal(current_season.year)
      expect(last_completed_nfl_week_params().year).to.equal(
        current_season.last_completed_season_year
      )
    })

    // The one instant the two granularities disagree, pinned so the divergence
    // is documented rather than silently unpinned. `last_completed_season_year`
    // flips on the week counter, which reaches 1 on the Tuesday BEFORE the
    // Thursday opener -- so it already reads the new year while no game of that
    // year has finished, and the week-granularity helper correctly still points
    // at the prior season's Super Bowl.
    it('diverges during live REG week 1, by the season getter reading ahead', function () {
      set_date_for_week({ seas_type: 'REG', week: 1 })
      expect(current_season.last_completed_season_year).to.equal(
        current_season.year
      )
      expect(last_completed_nfl_week_params().year).to.equal(
        current_season.year - 1
      )
    })
  })

  describe('last_n_nfl_weeks no longer collapses at the season boundary', function () {
    it('offseason walks back into the prior season instead of stopping', function () {
      set_offseason_date()
      const weeks = [0, 1, 2, 3].map((i) =>
        nfl_week_offset_params({ offset: -i })
      )
      expect(weeks.every((w) => w !== null)).to.equal(true)
      expect(
        new Set(weeks.map((w) => `${w.year}_${w.seas_type}_${w.week}`)).size
      ).to.equal(4)
    })

    it('live REG week 1 walks back into the prior season instead of stopping', function () {
      set_date_for_week({ seas_type: 'REG', week: 1 })
      const weeks = [0, 1, 2, 3].map((i) =>
        nfl_week_offset_params({ offset: -i })
      )
      expect(weeks.every((w) => w !== null)).to.equal(true)
      expect(
        new Set(weeks.map((w) => `${w.year}_${w.seas_type}_${w.week}`)).size
      ).to.equal(4)
    })
  })
})
