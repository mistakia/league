/* global describe before beforeEach it */
import * as chai from 'chai'
import chai_http from 'chai-http'
import MockDate from 'mockdate'

import knex from '#db'

import league from '#db/seeds/league.mjs'
import draftPicks from '#db/seeds/draft-picks.mjs'
import {
  current_season,
  waiver_types,
  roster_slot_types,
  transaction_types
} from '#constants'
import { user1, user2 } from './fixtures/token.mjs'
import {
  notLoggedIn,
  missing,
  invalid,
  create_fresh_waiver,
  cancel_waiver,
  build_cancel_waiver_request,
  addPlayer,
  selectPlayer
} from './utils/index.mjs'

process.env.NODE_ENV = 'test'

chai.should()
chai.use(chai_http)
const { regular_season_start } = current_season

describe('API /waivers - cancel', function () {
  let pid
  let waiverId

  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()

    MockDate.set(regular_season_start.subtract('1', 'month').toISOString())

    await league(knex)
    await draftPicks(knex)

    await knex('seasons')
      .update({
        free_agency_live_auction_start: regular_season_start
          .subtract('1', 'week')
          .unix()
      })
      .where('lid', 1)
  })

  it('cancel poaching waiver', async () => {
    MockDate.set(
      regular_season_start
        .subtract('1', 'month')
        .add('10', 'minute')
        .toISOString()
    )

    // Get a rookie player and add them to practice squad (required for poaching)
    const player = await selectPlayer({ rookie: true })
    pid = player.pid

    // Add player to practice squad on team 1
    await addPlayer({
      leagueId: 1,
      player,
      teamId: 1,
      userId: 1,
      slot: roster_slot_types.PS,
      transaction: transaction_types.DRAFT,
      value: 0
    })

    // Move time forward to allow poaching (24-48 hour window)
    MockDate.set(
      regular_season_start
        .subtract('1', 'month')
        .add('10', 'minute')
        .add('25', 'hours')
        .toISOString()
    )

    // Create and cancel poaching waiver
    const teamId = 2
    const leagueId = 1
    const waiver = await create_fresh_waiver({
      pid,
      teamId,
      leagueId,
      type: waiver_types.POACH,
      token: user2
    })
    waiverId = waiver.uid

    const cancel_result = await cancel_waiver({
      waiverId,
      teamId,
      leagueId,
      token: user2
    })

    cancel_result.uid.should.equal(waiverId)
    cancel_result.tid.should.equal(teamId)
    cancel_result.lid.should.equal(leagueId)
    cancel_result.cancelled.should.equal(Math.round(Date.now() / 1000))
  })

  it('resubmit & cancel poach waiver', async () => {
    const teamId = 2
    const leagueId = 1

    // Create and cancel poaching waiver
    const waiver = await create_fresh_waiver({
      pid,
      teamId,
      leagueId,
      type: waiver_types.POACH,
      token: user2
    })

    const cancel_result = await cancel_waiver({
      waiverId: waiver.uid,
      teamId,
      leagueId,
      token: user2
    })

    cancel_result.uid.should.equal(waiver.uid)
    cancel_result.tid.should.equal(teamId)
    cancel_result.lid.should.equal(leagueId)
    cancel_result.cancelled.should.equal(Math.round(Date.now() / 1000))
  })

  it('cancel free agency waiver', async () => {})

  it('resubmit & cancel free agency waiver', async () => {})

  describe('errors', function () {
    let error_test_waiver_id

    beforeEach(async function () {
      // Use the player from main tests (already on practice squad)
      // If pid isn't set yet, get a fresh rookie player and add to practice squad
      let test_pid = pid
      if (!test_pid) {
        const test_player = await selectPlayer({ rookie: true })
        test_pid = test_player.pid
        // Add player to practice squad (required for poaching)
        await addPlayer({
          leagueId: 1,
          player: test_player,
          teamId: 1,
          userId: 1,
          slot: roster_slot_types.PS,
          transaction: transaction_types.DRAFT,
          value: 0
        })
      }

      // Create a fresh waiver for error tests (automatically cancels any existing ones)
      const waiver = await create_fresh_waiver({
        pid: test_pid,
        teamId: 2,
        leagueId: 1,
        type: waiver_types.POACH,
        token: user2
      })

      error_test_waiver_id = waiver.uid
    })

    it('not logged in', async () => {
      const request = build_cancel_waiver_request({
        waiverId: error_test_waiver_id,
        leagueId: 1
      })
      await notLoggedIn(request)
    })

    it('missing teamId', async () => {
      const request = build_cancel_waiver_request({
        waiverId: error_test_waiver_id,
        leagueId: 1,
        token: user2,
        body: { leagueId: 1 }
      })
      await missing(request, 'teamId')
    })

    it('missing leagueId', async () => {
      const request = build_cancel_waiver_request({
        waiverId: error_test_waiver_id,
        leagueId: 1,
        token: user2,
        body: { teamId: 2 }
      })
      await missing(request, 'leagueId')
    })

    it('invalid teamId', async () => {
      const request = build_cancel_waiver_request({
        waiverId: error_test_waiver_id,
        leagueId: 1,
        token: user2,
        body: { teamId: 'x', leagueId: 1 }
      })
      await invalid(request, 'teamId')
    })

    it('invalid leagueId', async () => {
      const request = build_cancel_waiver_request({
        waiverId: error_test_waiver_id,
        leagueId: 1,
        token: user2,
        body: { teamId: 2, leagueId: 'x' }
      })
      await invalid(request, 'leagueId')
    })

    it('teamId does not belong to userId', async () => {
      const request = build_cancel_waiver_request({
        waiverId: error_test_waiver_id,
        leagueId: 1,
        token: user2,
        body: { teamId: 1, leagueId: 1 }
      })
      await invalid(request, 'teamId')
    })

    it('waiverId does not belong to teamId', async () => {
      const request = build_cancel_waiver_request({
        waiverId: error_test_waiver_id,
        leagueId: 1,
        token: user1,
        body: { teamId: 1, leagueId: 1 }
      })
      await invalid(request, 'waiverId')
    })

    it('waiver already cancelled', async () => {
      // Cancel the waiver first
      await cancel_waiver({
        waiverId: error_test_waiver_id,
        teamId: 2,
        leagueId: 1,
        token: user2
      })

      // Try to cancel again
      const request = build_cancel_waiver_request({
        waiverId: error_test_waiver_id,
        leagueId: 1,
        token: user2,
        body: { teamId: 2, leagueId: 1 }
      })
      await invalid(request, 'waiverId')
    })
  })
})
