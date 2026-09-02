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
  const period_start = dayjs('2026-09-03T04:00:00Z')
  const period_end = dayjs('2026-09-08T02:00:00Z')

  const compute = (overrides = {}) =>
    calculate_final_block({
      period_start,
      period_end,
      spots_remaining: 69,
      auction_block_notice_minutes: 60,
      auction_final_block_pace_minutes: 2,
      auction_final_block_buffer_hours: 3,
      now: dayjs('2026-09-03T04:00:00Z'),
      ...overrides
    })

  describe('the computation', function () {
    it('reserves pace for every unfilled spot and the buffer behind it', function () {
      const result = compute()

      // 69 spots at 2 minutes is 2.3 hours, plus 3 hours of buffer.
      expect(result.computed_at.toISOString()).to.equal(
        period_end.subtract(138, 'minute').subtract(3, 'hour').toISOString()
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

    // THE ASSERTION THAT WALKS THE CLOCK, and the only shape that can see the
    // defect this replaced. The floor was anchored to `now`, so every read moved
    // the block another hour out and the clock never reached it: on the real
    // 2026 shape the auction's ONLY termination guarantee arrived 55 minutes
    // before the period closed, against a computation that had reserved three
    // and a half hours. Asserting at ONE instant cannot tell that apart from a
    // correct floor -- `now + notice` is what both produce -- which is exactly
    // why it shipped.
    it('is reached by the clock at the time it computes', function () {
      const args = {
        period_start,
        period_end,
        spots_remaining: 47,
        auction_block_notice_minutes: 60,
        auction_final_block_pace_minutes: 2,
        auction_final_block_buffer_hours: 2
      }
      const computed_at = calculate_final_block({
        ...args,
        now: period_start
      }).final_block_at

      let now = period_start
      let convened_at = null
      while (now.isBefore(period_end)) {
        const result = calculate_final_block({ ...args, now })
        if (!now.isBefore(result.final_block_at)) {
          convened_at = now
          break
        }
        now = now.add(5, 'minute')
      }

      expect(
        convened_at,
        'the block is reached inside the period'
      ).to.not.equal(null)
      // Within one step of the computed time, not hours after it.
      expect(
        convened_at.diff(computed_at, 'minute'),
        'reached at the computed time'
      ).to.be.within(0, 5)
    })

    // The property the floor exists for, stated at the boundary where it now
    // binds: notice is owed from when the block becomes KNOWABLE, and that is
    // the period start, because the final block is published from the first read
    // and every term in it is configuration or rosters.
    it('never lands a mandatory block sooner than the notice after the period opens', function () {
      // A window so short the reservation alone pushes the block back to within
      // the first hour of the auction.
      const result = compute({
        now: period_start,
        period_end: period_start.add(3, 'hour'),
        spots_remaining: 20,
        auction_final_block_buffer_hours: 2
      })

      expect(result.is_held_off_by_notice).to.equal(true)
      expect(result.final_block_at.toISOString()).to.equal(
        period_start.add(60, 'minute').toISOString()
      )
      expect(result.final_block_at.isAfter(result.computed_at)).to.equal(true)
    })

    // THE CONTROL on the test above. A block computed comfortably inside the
    // period is NOT held off, and the floor must not touch it -- a floor that
    // fired on every read is the defect, not the fix.
    it('leaves a block computed well inside the period alone', function () {
      const result = compute({ now: period_start, spots_remaining: 47 })

      expect(result.is_held_off_by_notice).to.equal(false)
      expect(result.final_block_at.toISOString()).to.equal(
        result.computed_at.toISOString()
      )
    })

    it('reports a window that was never long enough rather than returning it', function () {
      // The reservation alone exceeds the whole period, so the block computes to
      // before the auction even opened: the window inequality has failed and the
      // termination guarantee is gone.
      const result = compute({
        now: period_start,
        period_end: period_start.add(2, 'hour'),
        spots_remaining: 69,
        auction_final_block_buffer_hours: 3
      })

      expect(result.computed_at.isBefore(period_start)).to.equal(true)
      expect(result.is_in_the_past).to.equal(true)
      expect(result.computed_at.isBefore(result.final_block_at)).to.equal(true)
    })

    // THE CONTROL that separates a failed window from a block that is simply
    // RUNNING. Compared against `now` rather than the period start, every read
    // after the block began reported a failure and pushed it another hour out,
    // which is how the receding horizon survived having a past-case test at all.
    it('does not call a block that has already started a failed window', function () {
      const started = compute({
        now: period_end.subtract(1, 'hour'),
        spots_remaining: 47,
        auction_final_block_buffer_hours: 2
      })

      expect(
        started.computed_at.isBefore(period_end.subtract(1, 'hour'))
      ).to.equal(true)
      expect(started.is_in_the_past, 'running, not failed').to.equal(false)
      expect(started.final_block_at.toISOString()).to.equal(
        started.computed_at.toISOString()
      )
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
        auction_final_block_buffer_hours: 3
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
          .subtract(3, 'hour')
          .toISOString()
      )
    })
  })
})
