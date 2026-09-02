/* global describe before beforeEach afterEach it */
import * as chai from 'chai'
import dayjs from 'dayjs'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { current_season } from '#constants'
import {
  calculate_final_block,
  get_auction_final_block
} from '#libs-server/auction-final-block.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

const league_id = 1
const season_year = current_season.year

// THE FINAL BLOCK IS THE AUCTION'S ONLY TERMINATION GUARANTEE.
//
// Election mode carries no clock at all: a nomination nobody elects on and a
// turn nobody takes both sit indefinitely, and nothing in the design pushes
// either. So if this computation is wrong the auction has no mechanism that
// makes it end before the Regular Season -- which is why the past case raises a
// signal rather than failing quietly.
describe('auction final block', function () {
  const period_end = dayjs('2026-09-08T02:00:00Z')

  const compute = (overrides = {}) =>
    calculate_final_block({
      period_end,
      spots_remaining: 69,
      auction_block_notice_minutes: 60,
      auction_final_block_pace_minutes: 2,
      auction_final_block_buffer_hours: 12,
      now: dayjs('2026-09-03T04:00:00Z'),
      ...overrides
    })

  describe('the computation', function () {
    it('reserves pace for every unfilled spot and the buffer behind it', function () {
      const result = compute()

      // 69 spots at 2 minutes is 2.3 hours, plus 12 hours of buffer.
      expect(result.computed_at.toISOString()).to.equal(
        period_end.subtract(138, 'minute').subtract(12, 'hour').toISOString()
      )
      expect(result.final_block_at.toISOString()).to.equal(
        result.computed_at.toISOString()
      )
      expect(result.is_in_the_past).to.equal(false)
      expect(result.is_held_off_by_notice).to.equal(false)
    })

    it('moves later as spots fill, which is the only direction the auction moves it', function () {
      const early = compute({ spots_remaining: 69 })
      const late = compute({ spots_remaining: 20 })

      expect(late.computed_at.isAfter(early.computed_at)).to.equal(true)
    })

    // The design stated this as "the announced time locks once inside the notice
    // threshold". The property it protects is that nobody is pulled into a
    // MANDATORY live block on less notice than the league configured, and the
    // floor delivers that without an announcement record to disagree with.
    it('never announces a block sooner than the configured notice', function () {
      // Computed lands 12.5h before the period end, which is inside the hour
      // of notice from a now sitting 13h out -- close enough to be sooner than
      // the notice allows, but not so close that it is already past.
      const now = period_end.subtract(13, 'hour')
      const result = compute({ now, spots_remaining: 15 })

      expect(result.is_held_off_by_notice).to.equal(true)
      expect(result.final_block_at.toISOString()).to.equal(
        now.add(60, 'minute').toISOString()
      )
      expect(result.final_block_at.isAfter(result.computed_at)).to.equal(true)
    })

    it('reports a computation that lands in the past rather than returning it', function () {
      // A window far too short for the board it has to place: the reservation
      // alone exceeds what is left of the period.
      const result = compute({
        now: period_end.subtract(1, 'hour'),
        spots_remaining: 69
      })

      expect(result.is_in_the_past).to.equal(true)
      expect(result.computed_at.isBefore(result.final_block_at)).to.equal(true)
    })
  })

  describe('against a live league', function () {
    before(async function () {
      this.timeout(60 * 1000)
      await knex.seed.run()
    })

    afterEach(function () {
      MockDate.reset()
    })

    beforeEach(async function () {
      this.timeout(60 * 1000)
      MockDate.set(
        current_season.regular_season_start.subtract('1', 'month').toISOString()
      )
      await league(knex)
    })

    it('returns null for a league with no free agency period', async function () {
      this.timeout(60 * 1000)
      await knex('seasons')
        .where({ lid: league_id, season_year })
        .update({ free_agency_period_start: null })

      expect(await get_auction_final_block({ lid: league_id })).to.equal(null)
    })

    it('reads the tunables and the rosters rather than taking them as arguments', async function () {
      this.timeout(60 * 1000)

      const period_start = current_season.regular_season_start.subtract(
        2,
        'months'
      )
      const configured_end = current_season.regular_season_start
      await knex('seasons').where({ lid: league_id, season_year }).update({
        free_agency_period_start: period_start.toDate(),
        free_agency_period_end: configured_end.toDate(),
        auction_block_notice_minutes: 60,
        auction_final_block_pace_minutes: 2,
        auction_final_block_buffer_hours: 12
      })

      const result = await get_auction_final_block({ lid: league_id })

      expect(result).to.exist
      // The spots count comes from the rosters, so assert the RELATION rather
      // than a number the fixture is free to change: the block sits exactly the
      // buffer plus its own pace reservation before the period end.
      expect(result.spots_remaining).to.be.at.least(1)
      expect(result.computed_at.toISOString()).to.equal(
        dayjs(configured_end.toDate())
          .subtract(result.spots_remaining * 2, 'minute')
          .subtract(12, 'hour')
          .toISOString()
      )
    })
  })
})
