/* global describe before beforeEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/seeds/league.mjs'
import {
  roster_slot_types,
  transaction_types,
  current_season
} from '#constants'
import { addPlayer, selectPlayer } from './utils/index.mjs'
import run from '#scripts/process-poaching-claims.mjs'

process.env.NODE_ENV = 'test'

chai.should()
const expect = chai.expect
const { regular_season_start } = current_season

describe('SCRIPTS /waivers - poach window blocking (bug fix verification)', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  /**
   * This test suite verifies the fix for the bug where the Saturday 6pm - Tuesday 3pm EST
   * blocking window was calculated incorrectly on Tuesday and Wed-Fri.
   *
   * The bug was in process-poaching-claims.mjs where the window calculation used:
   *   const start_window = (now.day() < 2 ? now.subtract(1, 'week') : now).day(6)...
   *   const end_window = (now.day() < 2 ? now.day(2) : now.add('1', 'week').day(2))...
   *
   * This failed because:
   * - On Tuesday (day 2), it would calculate the window as "this Saturday to next Tuesday"
   * - On Wed-Fri (days 3-5), it would also calculate "this Saturday to next Tuesday"
   * - Both scenarios would create a future window instead of checking the current/past window
   *
   * The fix uses a simple day/hour check instead of date arithmetic:
   *   const in_window = (day === 6 && hour >= 18) || day === 0 || day === 1 || (day === 2 && hour < 15)
   */

  describe('blocking window during regular season', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      await league(knex)
    })

    it('should block processing on Saturday at 6pm', async () => {
      const saturday_6pm = regular_season_start.add('3', 'week').day(6).hour(18)

      const player = await selectPlayer({ rookie: true })
      await addPlayer({
        leagueId: 1,
        player,
        teamId: 1,
        userId: 1,
        slot: roster_slot_types.PS,
        transaction: transaction_types.DRAFT,
        value: 1
      })

      // Submit claim 3 days ago so it's older than 48 hours
      await knex('poaches').insert({
        userid: 2,
        tid: 2,
        lid: 1,
        pid: player.pid,
        player_tid: 1,
        submitted: saturday_6pm.subtract('3', 'days').unix()
      })

      MockDate.set(saturday_6pm.toISOString())

      let error
      try {
        await run()
      } catch (err) {
        error = err
      }

      // Should complete without error (returns early when in window)
      expect(error).to.equal(undefined)

      // Verify claim was NOT processed
      const poaches = await knex('poaches')
      expect(poaches.length).to.equal(1)
      expect(poaches[0].processed).to.equal(null)
    })

    it('should block processing on Sunday afternoon', async () => {
      const sunday_2pm = regular_season_start.add('3', 'week').day(0).hour(14)

      const player = await selectPlayer({ rookie: true })
      await addPlayer({
        leagueId: 1,
        player,
        teamId: 1,
        userId: 1,
        slot: roster_slot_types.PS,
        transaction: transaction_types.DRAFT,
        value: 1
      })

      // Submit claim 3 days ago so it's older than 48 hours
      await knex('poaches').insert({
        userid: 2,
        tid: 2,
        lid: 1,
        pid: player.pid,
        player_tid: 1,
        submitted: sunday_2pm.subtract('3', 'days').unix()
      })

      MockDate.set(sunday_2pm.toISOString())

      let error
      try {
        await run()
      } catch (err) {
        error = err
      }

      // Should complete without error (returns early when in window)
      expect(error).to.equal(undefined)

      const poaches = await knex('poaches')
      expect(poaches.length).to.equal(1)
      expect(poaches[0].processed).to.equal(null)
    })

    it('should block processing on Monday morning', async () => {
      const monday_9am = regular_season_start.add('3', 'week').day(1).hour(9)

      const player = await selectPlayer({ rookie: true })
      await addPlayer({
        leagueId: 1,
        player,
        teamId: 1,
        userId: 1,
        slot: roster_slot_types.PS,
        transaction: transaction_types.DRAFT,
        value: 1
      })

      // Submit claim 3 days ago so it's older than 48 hours
      await knex('poaches').insert({
        userid: 2,
        tid: 2,
        lid: 1,
        pid: player.pid,
        player_tid: 1,
        submitted: monday_9am.subtract('3', 'days').unix()
      })

      MockDate.set(monday_9am.toISOString())

      let error
      try {
        await run()
      } catch (err) {
        error = err
      }

      // Should complete without error (returns early when in window)
      expect(error).to.equal(undefined)

      const poaches = await knex('poaches')
      expect(poaches.length).to.equal(1)
      expect(poaches[0].processed).to.equal(null)
    })

    it('should block processing on Tuesday at 2pm (CRITICAL BUG FIX TEST)', async () => {
      // This test specifically verifies the bug fix for Tuesday
      // The old code would calculate a future window on Tuesday, allowing processing incorrectly
      const tuesday_2pm = regular_season_start.add('3', 'week').day(2).hour(14)

      const player = await selectPlayer({ rookie: true })
      await addPlayer({
        leagueId: 1,
        player,
        teamId: 1,
        userId: 1,
        slot: roster_slot_types.PS,
        transaction: transaction_types.DRAFT,
        value: 1
      })

      // Submit claim 3 days ago so it's older than 48 hours
      await knex('poaches').insert({
        userid: 2,
        tid: 2,
        lid: 1,
        pid: player.pid,
        player_tid: 1,
        submitted: tuesday_2pm.subtract('3', 'days').unix()
      })

      MockDate.set(tuesday_2pm.toISOString())

      let error
      try {
        await run()
      } catch (err) {
        error = err
      }

      // Should complete without error (returns early when in window)
      expect(error).to.equal(undefined)

      const poaches = await knex('poaches')
      expect(poaches.length).to.equal(1)
      expect(poaches[0].processed).to.equal(null)
    })

    it('should allow processing on Tuesday at 3pm (CRITICAL BUG FIX TEST)', async () => {
      // This test verifies the window ends correctly at 3pm on Tuesday
      const tuesday_3pm = regular_season_start.add('3', 'week').day(2).hour(15)

      const player = await selectPlayer({ rookie: true })
      await addPlayer({
        leagueId: 1,
        player,
        teamId: 1,
        userId: 1,
        slot: roster_slot_types.PS,
        transaction: transaction_types.DRAFT,
        value: 1
      })

      // Submit claim 3 days ago so it's older than 48 hours
      await knex('poaches').insert({
        userid: 2,
        tid: 2,
        lid: 1,
        pid: player.pid,
        player_tid: 1,
        submitted: tuesday_3pm.subtract('3', 'days').unix()
      })

      MockDate.set(tuesday_3pm.toISOString())

      let error
      try {
        await run()
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      // Verify claim WAS processed
      const poaches = await knex('poaches')
      expect(poaches.length).to.equal(1)
      expect(poaches[0].processed).to.not.equal(null)
      expect(poaches[0].succ).to.equal(true)
    })

    it('should allow processing on Wednesday (CRITICAL BUG FIX TEST)', async () => {
      // This test verifies the fix for Wednesday
      // The old code would calculate a future window on Wed-Fri, blocking incorrectly
      const wednesday_noon = regular_season_start
        .add('3', 'week')
        .day(3)
        .hour(12)

      const player = await selectPlayer({ rookie: true })
      await addPlayer({
        leagueId: 1,
        player,
        teamId: 1,
        userId: 1,
        slot: roster_slot_types.PS,
        transaction: transaction_types.DRAFT,
        value: 1
      })

      // Submit claim 3 days ago so it's older than 48 hours
      await knex('poaches').insert({
        userid: 2,
        tid: 2,
        lid: 1,
        pid: player.pid,
        player_tid: 1,
        submitted: wednesday_noon.subtract('3', 'days').unix()
      })

      MockDate.set(wednesday_noon.toISOString())

      let error
      try {
        await run()
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      const poaches = await knex('poaches')
      expect(poaches.length).to.equal(1)
      expect(poaches[0].processed).to.not.equal(null)
      expect(poaches[0].succ).to.equal(true)
    })

    it('should allow processing on Thursday (CRITICAL BUG FIX TEST)', async () => {
      const thursday_noon = regular_season_start
        .add('3', 'week')
        .day(4)
        .hour(12)

      const player = await selectPlayer({ rookie: true })
      await addPlayer({
        leagueId: 1,
        player,
        teamId: 1,
        userId: 1,
        slot: roster_slot_types.PS,
        transaction: transaction_types.DRAFT,
        value: 1
      })

      // Submit claim 3 days ago so it's older than 48 hours
      await knex('poaches').insert({
        userid: 2,
        tid: 2,
        lid: 1,
        pid: player.pid,
        player_tid: 1,
        submitted: thursday_noon.subtract('3', 'days').unix()
      })

      MockDate.set(thursday_noon.toISOString())

      let error
      try {
        await run()
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      const poaches = await knex('poaches')
      expect(poaches.length).to.equal(1)
      expect(poaches[0].processed).to.not.equal(null)
      expect(poaches[0].succ).to.equal(true)
    })

    it('should allow processing on Friday (CRITICAL BUG FIX TEST)', async () => {
      const friday_noon = regular_season_start.add('3', 'week').day(5).hour(12)

      const player = await selectPlayer({ rookie: true })
      await addPlayer({
        leagueId: 1,
        player,
        teamId: 1,
        userId: 1,
        slot: roster_slot_types.PS,
        transaction: transaction_types.DRAFT,
        value: 1
      })

      // Submit claim 3 days ago so it's older than 48 hours
      await knex('poaches').insert({
        userid: 2,
        tid: 2,
        lid: 1,
        pid: player.pid,
        player_tid: 1,
        submitted: friday_noon.subtract('3', 'days').unix()
      })

      MockDate.set(friday_noon.toISOString())

      let error
      try {
        await run()
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      const poaches = await knex('poaches')
      expect(poaches.length).to.equal(1)
      expect(poaches[0].processed).to.not.equal(null)
      expect(poaches[0].succ).to.equal(true)
    })

    it('should allow processing on Saturday before 6pm', async () => {
      const saturday_5pm = regular_season_start.add('3', 'week').day(6).hour(17)

      const player = await selectPlayer({ rookie: true })
      await addPlayer({
        leagueId: 1,
        player,
        teamId: 1,
        userId: 1,
        slot: roster_slot_types.PS,
        transaction: transaction_types.DRAFT,
        value: 1
      })

      // Submit claim 3 days ago so it's older than 48 hours
      await knex('poaches').insert({
        userid: 2,
        tid: 2,
        lid: 1,
        pid: player.pid,
        player_tid: 1,
        submitted: saturday_5pm.subtract('3', 'days').unix()
      })

      MockDate.set(saturday_5pm.toISOString())

      let error
      try {
        await run()
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      const poaches = await knex('poaches')
      expect(poaches.length).to.equal(1)
      expect(poaches[0].processed).to.not.equal(null)
      expect(poaches[0].succ).to.equal(true)
    })
  })
})
