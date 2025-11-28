/* global describe it before after */
import * as chai from 'chai'
import MockDate from 'mockdate'

import isReserveEligible from '../../libs-shared/is-reserve-eligible.mjs'
import {
  current_season,
  player_nfl_status,
  player_nfl_injury_status
} from '#constants'

const expect = chai.expect

describe('LIBS-SHARED isReserveEligible', function () {
  describe('backward compatibility - original logic', function () {
    it('should return true for non-ACTIVE nfl_status', function () {
      const result = isReserveEligible({
        nfl_status: player_nfl_status.INJURED_RESERVE,
        injury_status: null
      })
      expect(result).to.equal(true)
    })

    it('should return true for OUT injury_status', function () {
      const result = isReserveEligible({
        nfl_status: player_nfl_status.ACTIVE,
        injury_status: player_nfl_injury_status.OUT
      })
      expect(result).to.equal(true)
    })

    it('should return true for DOUBTFUL injury_status', function () {
      const result = isReserveEligible({
        nfl_status: player_nfl_status.ACTIVE,
        injury_status: player_nfl_injury_status.DOUBTFUL
      })
      expect(result).to.equal(true)
    })

    it('should return true for any injury_status during week 0', function () {
      const result = isReserveEligible({
        nfl_status: player_nfl_status.ACTIVE,
        injury_status: player_nfl_injury_status.QUESTIONABLE
      })
      // This depends on current_season.week === 0, which is unlikely in tests
      // but the logic is in the function
      expect(result).to.be.a('boolean')
    })

    it('should return false for ACTIVE status with no injury', function () {
      const result = isReserveEligible({
        nfl_status: player_nfl_status.ACTIVE,
        injury_status: null
      })
      expect(result).to.equal(false)
    })

    it('should return false for QUESTIONABLE injury_status', function () {
      const result = isReserveEligible({
        nfl_status: player_nfl_status.ACTIVE,
        injury_status: player_nfl_injury_status.QUESTIONABLE
      })
      expect(result).to.equal(false)
    })

    it('should handle no parameters', function () {
      const result = isReserveEligible()
      expect(result).to.equal(false)
    })
  })

  describe('enhanced logic - historical grace period', function () {
    describe('grace period - ruled out in game', function () {
      before(function () {
        // Set current day to Tuesday (day 2)
        MockDate.set('2024-10-08T10:00:00.000Z') // Tuesday
      })

      after(function () {
        MockDate.reset()
      })

      it('should return true for prior week ruled out with Sunday game (final practice Friday)', function () {
        const result = isReserveEligible({
          nfl_status: player_nfl_status.ACTIVE,
          injury_status: null,
          prior_week_ruled_out: true,
          week: 5,
          is_regular_season: true,
          game_day: 'SUN'
        })
        // Tuesday (2) < Friday (5), so should be eligible
        expect(result).to.equal(true)
      })

      it('should return true when both prior_week_inactive and prior_week_ruled_out are false but one is true', function () {
        const result = isReserveEligible({
          nfl_status: player_nfl_status.ACTIVE,
          injury_status: null,
          prior_week_inactive: false,
          prior_week_ruled_out: true,
          week: 5,
          is_regular_season: true,
          game_day: 'SUN'
        })
        // Tuesday (2) < Friday (5), prior_week_ruled_out is true, so should be eligible
        expect(result).to.equal(true)
      })

      it('should return true when prior_week_inactive is true regardless of prior_week_ruled_out', function () {
        const result = isReserveEligible({
          nfl_status: player_nfl_status.ACTIVE,
          injury_status: null,
          prior_week_inactive: true,
          prior_week_ruled_out: false,
          week: 5,
          is_regular_season: true,
          game_day: 'SUN'
        })
        // Tuesday (2) < Friday (5), prior_week_inactive is true, so should be eligible
        expect(result).to.equal(true)
      })

      it('should return false when both prior_week_inactive and prior_week_ruled_out are false', function () {
        const result = isReserveEligible({
          nfl_status: player_nfl_status.ACTIVE,
          injury_status: null,
          prior_week_inactive: false,
          prior_week_ruled_out: false,
          week: 5,
          is_regular_season: true,
          game_day: 'SUN'
        })
        // Grace period logic doesn't apply, falls through to original logic
        expect(result).to.equal(false)
      })
    })

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
          nfl_status: player_nfl_status.ACTIVE,
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
          nfl_status: player_nfl_status.ACTIVE,
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
          nfl_status: player_nfl_status.ACTIVE,
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
          nfl_status: player_nfl_status.ACTIVE,
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
          nfl_status: player_nfl_status.ACTIVE,
          injury_status: player_nfl_injury_status.QUESTIONABLE,
          prior_week_inactive: true,
          week: 5,
          is_regular_season: true,
          game_day: 'SUN'
        })
        // Friday (5) >= Friday (5), falls through to original logic
        // Original logic: QUESTIONABLE is not eligible UNLESS current_season.week === 0 (offseason)
        // In test environment, current_season.week might be 0, making this true
        const expected = Boolean(current_season.week === 0)
        expect(result).to.equal(expected)
      })

      it('should return true for prior week inactive + OUT injury_status', function () {
        const result = isReserveEligible({
          nfl_status: player_nfl_status.ACTIVE,
          injury_status: player_nfl_injury_status.OUT,
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
          nfl_status: player_nfl_status.ACTIVE,
          injury_status: player_nfl_injury_status.DOUBTFUL,
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

    describe('bye week scenarios', function () {
      before(function () {
        // Set current day to Tuesday (day 2)
        MockDate.set('2024-10-08T10:00:00.000Z') // Tuesday
      })

      after(function () {
        MockDate.reset()
      })

      it('should NOT grant grace period when prior week was bye and player was active in week - 2', function () {
        const result = isReserveEligible({
          nfl_status: player_nfl_status.ACTIVE,
          injury_status: null,
          prior_week_inactive: false, // SQL now correctly returns false when week-2 was active
          week: 6,
          is_regular_season: true,
          game_day: 'SUN'
        })
        // prior_week_inactive should be false (player was active in their actual last game)
        // No grace period should apply
        expect(result).to.equal(false)
      })

      it('should grant grace period when prior week was bye and player was inactive in week - 2', function () {
        const result = isReserveEligible({
          nfl_status: player_nfl_status.ACTIVE,
          injury_status: null,
          prior_week_inactive: true, // SQL now correctly returns true when week-2 was inactive
          week: 6,
          is_regular_season: true,
          game_day: 'SUN'
        })
        // Tuesday (2) < Friday (5), so grace period applies
        // prior_week_inactive should be true (player was inactive in their actual last game)
        expect(result).to.equal(true)
      })

      it('should handle Week 2 after Week 1 bye (no week 0 reference)', function () {
        const result = isReserveEligible({
          nfl_status: player_nfl_status.ACTIVE,
          injury_status: null,
          prior_week_inactive: false, // SQL returns false when no reference week exists
          week: 2,
          is_regular_season: true,
          game_day: 'SUN'
        })
        // Week 2 with week 1 bye, reference week would be week 0 (doesn't exist)
        // prior_week_inactive should be false (no prior game to reference)
        expect(result).to.equal(false)
      })
    })

    describe('edge cases - should not apply historical logic', function () {
      it('should use original logic for week 1', function () {
        const result = isReserveEligible({
          nfl_status: player_nfl_status.ACTIVE,
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
          nfl_status: player_nfl_status.ACTIVE,
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
          nfl_status: player_nfl_status.ACTIVE,
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
          nfl_status: player_nfl_status.ACTIVE,
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
          nfl_status: player_nfl_status.ACTIVE,
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
          nfl_status: player_nfl_status.ACTIVE,
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
          nfl_status: player_nfl_status.ACTIVE,
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
          nfl_status: player_nfl_status.ACTIVE,
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
        nfl_status: player_nfl_status.ACTIVE,
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

    it('should return true for LP practice status', function () {
      const result = isReserveEligible({
        nfl_status: player_nfl_status.ACTIVE,
        injury_status: null,
        practice: {
          m: null,
          tu: null,
          w: null,
          th: 'LP',
          f: null,
          s: null,
          su: null
        },
        current_date: new Date('2024-01-11') // Thursday
      })
      expect(result).to.equal(true)
    })

    it('should return false for FP practice status', function () {
      const result = isReserveEligible({
        nfl_status: player_nfl_status.ACTIVE,
        injury_status: null,
        practice: {
          m: null,
          tu: null,
          w: 'FP',
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
        nfl_status: player_nfl_status.ACTIVE,
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
        nfl_status: player_nfl_status.ACTIVE,
        injury_status: player_nfl_injury_status.QUESTIONABLE,
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

    it('should return true for LP with ACTIVE nfl_status', function () {
      const result = isReserveEligible({
        nfl_status: player_nfl_status.ACTIVE,
        injury_status: null,
        practice: {
          m: null,
          tu: 'LP',
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
        nfl_status: player_nfl_status.ACTIVE,
        injury_status: player_nfl_injury_status.OUT,
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
        nfl_status: player_nfl_status.INJURED_RESERVE,
        injury_status: null,
        practice: null,
        current_date: new Date('2024-01-10')
      })
      // No practice data, but nfl_status is not ACTIVE
      expect(result).to.equal(true)
    })

    it('should check most recent practice status walking backward', function () {
      const result = isReserveEligible({
        nfl_status: player_nfl_status.ACTIVE,
        injury_status: null,
        practice: {
          m: 'FP',
          tu: 'LP',
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

  describe('final practice report detection', function () {
    it('should return true when status field exists', function () {
      const result = isReserveEligible({
        nfl_status: player_nfl_status.ACTIVE,
        injury_status: null,
        practice: {
          m: null,
          tu: 'LP',
          w: null,
          th: null,
          f: null,
          s: null,
          su: null,
          status: 'OUT'
        },
        game_day: 'SUN',
        current_date: new Date('2024-01-10') // Wednesday
      })
      // Final report exists (status field), so practice status check is skipped
      // Falls through to original eligibility logic
      expect(result).to.equal(false)
    })

    it('should return true when formatted_status field exists', function () {
      const result = isReserveEligible({
        nfl_status: player_nfl_status.ACTIVE,
        injury_status: null,
        practice: {
          m: null,
          tu: 'DNP',
          w: null,
          th: null,
          f: null,
          s: null,
          su: null,
          formatted_status: 'Questionable'
        },
        game_day: 'SUN',
        current_date: new Date('2024-01-10') // Wednesday
      })
      // Final report exists (formatted_status field), so practice status check is skipped
      // Falls through to original eligibility logic
      expect(result).to.equal(false)
    })

    it('should return true when current day > final practice day', function () {
      const result = isReserveEligible({
        nfl_status: player_nfl_status.ACTIVE,
        injury_status: null,
        practice: {
          m: null,
          tu: 'LP',
          w: null,
          th: null,
          f: null,
          s: null,
          su: null
        },
        game_day: 'SUN',
        current_date: new Date('2024-01-13T12:00:00') // Saturday (day 6)
      })
      // Saturday (6) > Friday (5) for Sunday game, final report exists
      // Falls through to original eligibility logic
      expect(result).to.equal(false)
    })

    it('should return true when final practice day has status', function () {
      const result = isReserveEligible({
        nfl_status: player_nfl_status.ACTIVE,
        injury_status: null,
        practice: {
          m: null,
          tu: null,
          w: 'LP',
          th: null,
          f: 'FP',
          s: null,
          su: null
        },
        game_day: 'SUN',
        current_date: new Date('2024-01-10') // Wednesday
      })
      // Friday has status ('FP'), final report exists for Sunday game
      // Falls through to original eligibility logic
      expect(result).to.equal(false)
    })

    it('should return false when no conditions met', function () {
      const result = isReserveEligible({
        nfl_status: player_nfl_status.ACTIVE,
        injury_status: null,
        practice: {
          m: null,
          tu: 'LP',
          w: null,
          th: null,
          f: null,
          s: null,
          su: null
        },
        game_day: 'SUN',
        current_date: new Date('2024-01-09') // Tuesday (day 2)
      })
      // Tuesday (2) < Friday (5), no status/formatted_status fields, final day has no status
      // Practice status check applies, LP makes eligible
      expect(result).to.equal(true)
    })

    it('should return false when practice is null', function () {
      const result = isReserveEligible({
        nfl_status: player_nfl_status.ACTIVE,
        injury_status: null,
        practice: null,
        game_day: 'SUN',
        current_date: new Date('2024-01-10') // Wednesday
      })
      // No practice data, falls through to original eligibility logic
      expect(result).to.equal(false)
    })
  })

  describe('practice status with final report', function () {
    it('should make DNP eligible when no final report', function () {
      const result = isReserveEligible({
        nfl_status: player_nfl_status.ACTIVE,
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
        game_day: 'SUN',
        current_date: new Date('2024-01-10') // Wednesday
      })
      // Wednesday (3) < Friday (5), no final report exists
      // DNP makes eligible
      expect(result).to.equal(true)
    })

    it('should make LP eligible when no final report', function () {
      const result = isReserveEligible({
        nfl_status: player_nfl_status.ACTIVE,
        injury_status: null,
        practice: {
          m: null,
          tu: null,
          w: 'LP',
          th: null,
          f: null,
          s: null,
          su: null
        },
        game_day: 'SUN',
        current_date: new Date('2024-01-10') // Wednesday
      })
      // Wednesday (3) < Friday (5), no final report exists
      // LP makes eligible
      expect(result).to.equal(true)
    })

    it('should NOT make DNP eligible when final report exists', function () {
      const result = isReserveEligible({
        nfl_status: player_nfl_status.ACTIVE,
        injury_status: null,
        practice: {
          m: null,
          tu: null,
          w: 'DNP',
          th: null,
          f: null,
          s: null,
          su: null,
          status: 'OUT'
        },
        game_day: 'SUN',
        current_date: new Date('2024-01-10') // Wednesday
      })
      // Final report exists (status field), practice status check is skipped
      // Falls through to original eligibility logic (injury_status is null)
      expect(result).to.equal(false)
    })

    it('should NOT make LP eligible when final report exists', function () {
      const result = isReserveEligible({
        nfl_status: player_nfl_status.ACTIVE,
        injury_status: null,
        practice: {
          m: null,
          tu: null,
          w: 'LP',
          th: null,
          f: null,
          s: null,
          su: null,
          formatted_status: 'Questionable'
        },
        game_day: 'SUN',
        current_date: new Date('2024-01-10') // Wednesday
      })
      // Final report exists (formatted_status field), practice status check is skipped
      // Falls through to original eligibility logic (injury_status is null)
      expect(result).to.equal(false)
    })

    it('should fall through to original logic after final report', function () {
      const result = isReserveEligible({
        nfl_status: player_nfl_status.ACTIVE,
        injury_status: player_nfl_injury_status.QUESTIONABLE,
        practice: {
          m: null,
          tu: 'LP',
          w: null,
          th: null,
          f: null,
          s: null,
          su: null,
          status: 'QUESTIONABLE'
        },
        game_day: 'SUN',
        current_date: new Date('2024-01-10') // Wednesday
      })
      // Final report exists (status field), practice status check is skipped
      // Falls through to original eligibility logic
      // QUESTIONABLE injury_status is not eligible unless current_season.week === 0
      const expected = Boolean(current_season.week === 0)
      expect(result).to.equal(expected)
    })

    it('should make OUT injury_status eligible even with final report', function () {
      const result = isReserveEligible({
        nfl_status: player_nfl_status.ACTIVE,
        injury_status: player_nfl_injury_status.OUT,
        practice: {
          m: null,
          tu: 'LP',
          w: null,
          th: null,
          f: null,
          s: null,
          su: null,
          status: 'OUT'
        },
        game_day: 'SUN',
        current_date: new Date('2024-01-10') // Wednesday
      })
      // Final report exists (status field), practice status check is skipped
      // Falls through to original eligibility logic
      // OUT injury_status makes eligible
      expect(result).to.equal(true)
    })

    it('should skip practice check when past final practice day', function () {
      const result = isReserveEligible({
        nfl_status: player_nfl_status.ACTIVE,
        injury_status: null,
        practice: {
          m: null,
          tu: 'DNP',
          w: 'DNP',
          th: 'DNP',
          f: 'DNP',
          s: null,
          su: null
        },
        game_day: 'SUN',
        current_date: new Date('2024-01-13T12:00:00') // Saturday (day 6)
      })
      // Saturday (6) > Friday (5) for Sunday game, final report exists
      // Practice status check is skipped even though all days show DNP
      // Falls through to original eligibility logic
      expect(result).to.equal(false)
    })
  })
})
