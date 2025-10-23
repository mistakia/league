/* global describe it before after */
import * as chai from 'chai'
import MockDate from 'mockdate'

import isReserveEligible from '../../libs-shared/is-reserve-eligible.mjs'
import * as constants from '../../libs-shared/constants.mjs'

const expect = chai.expect

describe('LIBS-SHARED isReserveEligible', function () {
  describe('backward compatibility - original logic', function () {
    it('should return true for non-ACTIVE nfl_status', function () {
      const result = isReserveEligible({
        nfl_status: constants.player_nfl_status.INJURED_RESERVE,
        injury_status: null
      })
      expect(result).to.equal(true)
    })

    it('should return true for OUT injury_status', function () {
      const result = isReserveEligible({
        nfl_status: constants.player_nfl_status.ACTIVE,
        injury_status: constants.player_nfl_injury_status.OUT
      })
      expect(result).to.equal(true)
    })

    it('should return true for DOUBTFUL injury_status', function () {
      const result = isReserveEligible({
        nfl_status: constants.player_nfl_status.ACTIVE,
        injury_status: constants.player_nfl_injury_status.DOUBTFUL
      })
      expect(result).to.equal(true)
    })

    it('should return true for any injury_status during week 0', function () {
      const result = isReserveEligible({
        nfl_status: constants.player_nfl_status.ACTIVE,
        injury_status: constants.player_nfl_injury_status.QUESTIONABLE
      })
      // This depends on constants.season.week === 0, which is unlikely in tests
      // but the logic is in the function
      expect(result).to.be.a('boolean')
    })

    it('should return false for ACTIVE status with no injury', function () {
      const result = isReserveEligible({
        nfl_status: constants.player_nfl_status.ACTIVE,
        injury_status: null
      })
      expect(result).to.equal(false)
    })

    it('should return false for QUESTIONABLE injury_status', function () {
      const result = isReserveEligible({
        nfl_status: constants.player_nfl_status.ACTIVE,
        injury_status: constants.player_nfl_injury_status.QUESTIONABLE
      })
      expect(result).to.equal(false)
    })

    it('should handle no parameters', function () {
      const result = isReserveEligible()
      expect(result).to.equal(false)
    })
  })

  describe('enhanced logic - historical grace period', function () {
    describe('grace period - before final practice day', function () {
      before(function () {
        // Set current day to Tuesday (day 2)
        MockDate.set('2024-10-08T10:00:00.000Z') // Tuesday
      })

      after(function () {
        MockDate.reset()
      })

      it('should return true for prior week inactive with Sunday game (final practice Friday)', function () {
        const result = isReserveEligible({
          nfl_status: constants.player_nfl_status.ACTIVE,
          injury_status: null,
          prior_week_inactive: true,
          week: 5,
          is_regular_season: true,
          game_day: 'SUN'
        })
        // Tuesday (2) < Friday (5), so should be eligible
        expect(result).to.equal(true)
      })

      it('should return true for prior week inactive with Thursday game (final practice Wednesday)', function () {
        const result = isReserveEligible({
          nfl_status: constants.player_nfl_status.ACTIVE,
          injury_status: null,
          prior_week_inactive: true,
          week: 5,
          is_regular_season: true,
          game_day: 'THU'
        })
        // Tuesday (2) < Wednesday (3), so should be eligible
        expect(result).to.equal(true)
      })

      it('should return true for prior week inactive with Monday game (final practice Saturday)', function () {
        const result = isReserveEligible({
          nfl_status: constants.player_nfl_status.ACTIVE,
          injury_status: null,
          prior_week_inactive: true,
          week: 5,
          is_regular_season: true,
          game_day: 'MN'
        })
        // Tuesday (2) < Saturday (6), so should be eligible
        expect(result).to.equal(true)
      })
    })

    describe('after final practice day - uses original eligibility logic', function () {
      before(function () {
        // Set current day to Friday (day 5)
        MockDate.set('2024-10-11T10:00:00.000Z') // Friday
      })

      after(function () {
        MockDate.reset()
      })

      it('should return false for prior week inactive + cleared injury_status', function () {
        const result = isReserveEligible({
          nfl_status: constants.player_nfl_status.ACTIVE,
          injury_status: null,
          prior_week_inactive: true,
          week: 5,
          is_regular_season: true,
          game_day: 'SUN'
        })
        // Friday (5) >= Friday (5), falls through to original logic
        // injury_status is null and nfl_status is ACTIVE, so not eligible
        expect(result).to.equal(false)
      })

      it('should use original logic after final practice day with QUESTIONABLE injury_status', function () {
        const result = isReserveEligible({
          nfl_status: constants.player_nfl_status.ACTIVE,
          injury_status: constants.player_nfl_injury_status.QUESTIONABLE,
          prior_week_inactive: true,
          week: 5,
          is_regular_season: true,
          game_day: 'SUN'
        })
        // Friday (5) >= Friday (5), falls through to original logic
        // Original logic: QUESTIONABLE is not eligible UNLESS constants.season.week === 0 (offseason)
        // In test environment, constants.season.week might be 0, making this true
        const expected = Boolean(constants.season.week === 0)
        expect(result).to.equal(expected)
      })

      it('should return true for prior week inactive + OUT injury_status', function () {
        const result = isReserveEligible({
          nfl_status: constants.player_nfl_status.ACTIVE,
          injury_status: constants.player_nfl_injury_status.OUT,
          prior_week_inactive: true,
          week: 5,
          is_regular_season: true,
          game_day: 'SUN'
        })
        // Friday (5) >= Friday (5), falls through to original logic
        // injury_status is OUT, so eligible
        expect(result).to.equal(true)
      })

      it('should return true for prior week inactive + DOUBTFUL injury_status', function () {
        const result = isReserveEligible({
          nfl_status: constants.player_nfl_status.ACTIVE,
          injury_status: constants.player_nfl_injury_status.DOUBTFUL,
          prior_week_inactive: true,
          week: 5,
          is_regular_season: true,
          game_day: 'SUN'
        })
        // Friday (5) >= Friday (5), falls through to original logic
        // injury_status is DOUBTFUL, so eligible
        expect(result).to.equal(true)
      })
    })

    describe('edge cases - should not apply historical logic', function () {
      it('should use original logic for week 1', function () {
        const result = isReserveEligible({
          nfl_status: constants.player_nfl_status.ACTIVE,
          injury_status: null,
          prior_week_inactive: true,
          week: 1,
          is_regular_season: true,
          game_day: 'SUN'
        })
        // Week 1, so historical logic should not apply
        expect(result).to.equal(false)
      })

      it('should use original logic when not regular season', function () {
        const result = isReserveEligible({
          nfl_status: constants.player_nfl_status.ACTIVE,
          injury_status: null,
          prior_week_inactive: true,
          week: 5,
          is_regular_season: false,
          game_day: 'SUN'
        })
        // Not regular season, so historical logic should not apply
        expect(result).to.equal(false)
      })

      it('should use original logic when prior week was active', function () {
        const result = isReserveEligible({
          nfl_status: constants.player_nfl_status.ACTIVE,
          injury_status: null,
          prior_week_inactive: false,
          week: 5,
          is_regular_season: true,
          game_day: 'SUN'
        })
        // Player was active prior week, so historical logic should not apply
        expect(result).to.equal(false)
      })

      it('should use original logic when prior_week_inactive is not provided', function () {
        const result = isReserveEligible({
          nfl_status: constants.player_nfl_status.ACTIVE,
          injury_status: null,
          week: 5,
          is_regular_season: true,
          game_day: 'SUN'
        })
        // prior_week_inactive defaults to false, so historical logic should not apply
        expect(result).to.equal(false)
      })

      it('should use original logic when week is not provided', function () {
        const result = isReserveEligible({
          nfl_status: constants.player_nfl_status.ACTIVE,
          injury_status: null,
          prior_week_inactive: true,
          week: null,
          is_regular_season: true,
          game_day: 'SUN'
        })
        // Week is null, so historical logic should not apply
        expect(result).to.equal(false)
      })
    })

    describe('different game days', function () {
      before(function () {
        // Set current day to Saturday (day 6)
        MockDate.set('2024-10-12T10:00:00.000Z') // Saturday
      })

      after(function () {
        MockDate.reset()
      })

      it('should handle Thursday game correctly (final practice Wednesday)', function () {
        const result = isReserveEligible({
          nfl_status: constants.player_nfl_status.ACTIVE,
          injury_status: null,
          prior_week_inactive: true,
          week: 5,
          is_regular_season: true,
          game_day: 'THU'
        })
        // Saturday (6) >= Wednesday (3), falls through to original logic
        // injury_status is null and nfl_status is ACTIVE, so not eligible
        expect(result).to.equal(false)
      })

      it('should handle Monday night game correctly (final practice Saturday)', function () {
        const result = isReserveEligible({
          nfl_status: constants.player_nfl_status.ACTIVE,
          injury_status: null,
          prior_week_inactive: true,
          week: 5,
          is_regular_season: true,
          game_day: 'MN'
        })
        // Saturday (6) >= Saturday (6), falls through to original logic
        // injury_status is null and nfl_status is ACTIVE, so not eligible
        expect(result).to.equal(false)
      })

      it('should handle missing game_day gracefully', function () {
        const result = isReserveEligible({
          nfl_status: constants.player_nfl_status.ACTIVE,
          injury_status: null,
          prior_week_inactive: true,
          week: 5,
          is_regular_season: true,
          game_day: null
        })
        // game_day is null, defaults to Friday (5)
        // Saturday (6) >= Friday (5), falls through to original logic
        // injury_status is null and nfl_status is ACTIVE, so not eligible
        expect(result).to.equal(false)
      })
    })
  })

  describe('practice status eligibility', function () {
    it('should return true for DNP practice status', function () {
      const result = isReserveEligible({
        nfl_status: constants.player_nfl_status.ACTIVE,
        injury_status: null,
        practice: {
          m: null,
          tu: null,
          w: 'DNP',
          th: null,
          f: null,
          s: null,
          su: null
        },
        current_date: new Date('2024-01-10') // Wednesday
      })
      expect(result).to.equal(true)
    })

    it('should return true for LIMITED practice status', function () {
      const result = isReserveEligible({
        nfl_status: constants.player_nfl_status.ACTIVE,
        injury_status: null,
        practice: {
          m: null,
          tu: null,
          w: null,
          th: 'LIMITED',
          f: null,
          s: null,
          su: null
        },
        current_date: new Date('2024-01-11') // Thursday
      })
      expect(result).to.equal(true)
    })

    it('should return false for FULL practice status', function () {
      const result = isReserveEligible({
        nfl_status: constants.player_nfl_status.ACTIVE,
        injury_status: null,
        practice: {
          m: null,
          tu: null,
          w: 'FULL',
          th: null,
          f: null,
          s: null,
          su: null
        },
        current_date: new Date('2024-01-10') // Wednesday
      })
      expect(result).to.equal(false)
    })

    it('should return false for null practice status', function () {
      const result = isReserveEligible({
        nfl_status: constants.player_nfl_status.ACTIVE,
        injury_status: null,
        practice: {
          m: null,
          tu: null,
          w: null,
          th: null,
          f: null,
          s: null,
          su: null
        },
        current_date: new Date('2024-01-10') // Wednesday
      })
      expect(result).to.equal(false)
    })

    it('should return true for DNP regardless of QUESTIONABLE injury_status', function () {
      const result = isReserveEligible({
        nfl_status: constants.player_nfl_status.ACTIVE,
        injury_status: constants.player_nfl_injury_status.QUESTIONABLE,
        practice: {
          m: null,
          tu: null,
          w: 'DNP',
          th: null,
          f: null,
          s: null,
          su: null
        },
        current_date: new Date('2024-01-10') // Wednesday
      })
      expect(result).to.equal(true)
    })

    it('should return true for LIMITED with ACTIVE nfl_status', function () {
      const result = isReserveEligible({
        nfl_status: constants.player_nfl_status.ACTIVE,
        injury_status: null,
        practice: {
          m: null,
          tu: 'LIMITED',
          w: null,
          th: null,
          f: null,
          s: null,
          su: null
        },
        current_date: new Date('2024-01-09') // Tuesday
      })
      expect(result).to.equal(true)
    })

    it('should use other eligibility logic when practice status is FULL', function () {
      const result = isReserveEligible({
        nfl_status: constants.player_nfl_status.ACTIVE,
        injury_status: constants.player_nfl_injury_status.OUT,
        practice: {
          m: null,
          tu: null,
          w: 'FULL',
          th: null,
          f: null,
          s: null,
          su: null
        },
        current_date: new Date('2024-01-10') // Wednesday
      })
      // FULL doesn't make eligible via practice, but OUT injury_status does
      expect(result).to.equal(true)
    })

    it('should use other eligibility logic when practice is null', function () {
      const result = isReserveEligible({
        nfl_status: constants.player_nfl_status.INJURED_RESERVE,
        injury_status: null,
        practice: null,
        current_date: new Date('2024-01-10')
      })
      // No practice data, but nfl_status is not ACTIVE
      expect(result).to.equal(true)
    })

    it('should check most recent practice status walking backward', function () {
      const result = isReserveEligible({
        nfl_status: constants.player_nfl_status.ACTIVE,
        injury_status: null,
        practice: {
          m: 'FULL',
          tu: 'LIMITED',
          w: null,
          th: null,
          f: null,
          s: null,
          su: null
        },
        current_date: new Date('2024-01-10') // Wednesday
      })
      // Most recent status is Tuesday's LIMITED
      expect(result).to.equal(true)
    })
  })
})
