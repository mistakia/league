/* global describe before beforeEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import {
  roster_slot_types,
  transaction_types,
  waiver_types,
  current_season
} from '#constants'
import { addPlayer, selectPlayer, fillRoster } from './utils/index.mjs'
import league from '#db/fixtures/league.mjs'
import { processPoach } from '#libs-server'

chai.should()
process.env.NODE_ENV = 'test'
const expect = chai.expect
const { regular_season_start } = current_season

describe('LIBS-SERVER processPoach - immediate release', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  describe('poach with insufficient roster space', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      MockDate.set(regular_season_start.subtract('2', 'month').toISOString())
      await league(knex)
    })

    it('should poach and immediately release when no roster space', async () => {
      const player1 = await selectPlayer({ pos: 'WR' })
      const teamId = 1
      const leagueId = 1
      const userId = 1

      // Add player to team 1 practice squad
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player: player1,
        slot: roster_slot_types.PS,
        transaction: transaction_types.PRACTICE_ADD,
        value: 0
      })

      // Fill team 2 roster completely (no available space)
      const poachingTeamId = 2
      await fillRoster({ teamId: poachingTeamId, leagueId })

      // Process the poach with no roster space
      await processPoach({
        pid: player1.pid,
        release: [],
        lid: leagueId,
        tid: poachingTeamId,
        user_id: 2
      })

      // Check that poach transaction was created
      const poach_transaction = await knex('transactions')
        .where({
          pid: player1.pid,
          tid: poachingTeamId,
          lid: leagueId,
          type: transaction_types.POACHED
        })
        .first()
      expect(poach_transaction).to.not.equal(undefined)

      // Check that release transaction was created immediately after
      const release_transaction = await knex('transactions')
        .where({
          pid: player1.pid,
          tid: poachingTeamId,
          lid: leagueId,
          type: transaction_types.ROSTER_RELEASE
        })
        .first()
      expect(release_transaction).to.not.equal(undefined)

      // Check timestamps are within 1 second
      const time_difference = Math.abs(
        (release_transaction.occurred_at - poach_transaction.occurred_at) / 1000
      )
      expect(time_difference).to.be.lessThan(1)

      // Check player is on waivers (not on poaching team roster)
      const roster_player = await knex('rosters_players')
        .where('tid', poachingTeamId)
        .andWhere('pid', player1.pid)
        .first()
      expect(roster_player).to.equal(undefined)

      // Check super priority waiver was created for original team
      const waiver = await knex('waivers')
        .where({
          pid: player1.pid,
          tid: teamId,
          lid: leagueId,
          type: waiver_types.FREE_AGENCY_PRACTICE
        })
        .first()
      expect(waiver).to.not.equal(undefined)
      expect(waiver.priority_order).to.equal(0) // super priority
      expect(waiver.super_priority).to.equal(1)
    })

    it('should poach normally when roster space is available', async () => {
      const player1 = await selectPlayer({ pos: 'WR' })
      const teamId = 1
      const leagueId = 1
      const userId = 1

      // Add player to team 1 practice squad
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player: player1,
        slot: roster_slot_types.PS,
        transaction: transaction_types.PRACTICE_ADD,
        value: 0
      })

      // Team 2 has available roster space
      const poachingTeamId = 2

      // Process the poach with available space
      await processPoach({
        pid: player1.pid,
        release: [],
        lid: leagueId,
        tid: poachingTeamId,
        user_id: 2
      })

      // Check that poach transaction was created
      const poach_transaction = await knex('transactions')
        .where({
          pid: player1.pid,
          tid: poachingTeamId,
          lid: leagueId,
          type: transaction_types.POACHED
        })
        .first()
      expect(poach_transaction).to.not.equal(undefined)

      // Check that NO release transaction was created
      const release_transaction = await knex('transactions')
        .where({
          pid: player1.pid,
          tid: poachingTeamId,
          lid: leagueId,
          type: transaction_types.ROSTER_RELEASE
        })
        .first()
      expect(release_transaction).to.equal(undefined)

      // Check player IS on poaching team roster
      const roster_player = await knex('rosters_players')
        .where('tid', poachingTeamId)
        .andWhere('pid', player1.pid)
        .first()
      expect(roster_player).to.not.equal(undefined)
      expect(roster_player.slot).to.equal(roster_slot_types.BENCH)
    })
  })

  // The super-priority waiver insert in handle_super_priority_on_release used
  // to sit OUTSIDE both record branches, so a release that found an already
  // eligible record ran neither the insert nor the update branch and still
  // wrote a waiver. The existing coverage above could not see it: it asserts
  // the waiver with `.first()`, which reads identically whether one row or two
  // were written.
  //
  // The three cases below are a set. The guard keys on a waiver being PENDING
  // rather than on one merely existing, and only the third case can tell those
  // two rules apart -- a blunt "any waiver" check passes the first two and
  // silently swallows an entitlement the original team is genuinely owed.
  describe('super priority waiver is not duplicated', function () {
    const leagueId = 1
    const originalTeamId = 1
    const poachingTeamId = 2

    beforeEach(async function () {
      this.timeout(60 * 1000)
      MockDate.set(regular_season_start.subtract('2', 'month').toISOString())
      await league(knex)
    })

    // Drives a real poach-into-immediate-release, which is the only path that
    // reaches the insert, rather than calling the unexported helper directly.
    const poach_and_immediately_release = async () => {
      const player1 = await selectPlayer({ pos: 'WR' })

      await addPlayer({
        teamId: originalTeamId,
        leagueId,
        userId: 1,
        player: player1,
        slot: roster_slot_types.PS,
        transaction: transaction_types.PRACTICE_ADD,
        value: 0
      })

      await fillRoster({ teamId: poachingTeamId, leagueId })

      await processPoach({
        pid: player1.pid,
        release: [],
        lid: leagueId,
        tid: poachingTeamId,
        user_id: 2
      })

      return player1
    }

    const super_priority_waivers_for = (pid) =>
      knex('waivers').where({
        pid,
        tid: originalTeamId,
        lid: leagueId,
        type: waiver_types.FREE_AGENCY_PRACTICE,
        super_priority: 1
      })

    it('writes exactly one waiver on a first release', async () => {
      // The positive control. Without it the two cases below would also pass on
      // an implementation that had stopped writing waivers altogether.
      const player1 = await poach_and_immediately_release()

      const waivers = await super_priority_waivers_for(player1.pid)
      expect(waivers).to.have.lengthOf(1)
    })

    it('writes no second waiver while the first is still pending', async () => {
      const player1 = await selectPlayer({ pos: 'WR' })

      await addPlayer({
        teamId: originalTeamId,
        leagueId,
        userId: 1,
        player: player1,
        slot: roster_slot_types.PS,
        transaction: transaction_types.PRACTICE_ADD,
        value: 0
      })
      await fillRoster({ teamId: poachingTeamId, leagueId })

      // An unresolved waiver from an earlier release in the same cycle.
      await knex('waivers').insert({
        user_id: 0,
        pid: player1.pid,
        tid: originalTeamId,
        lid: leagueId,
        submitted: new Date(),
        bid_amount: 0,
        priority_order: 0,
        type: waiver_types.FREE_AGENCY_PRACTICE,
        super_priority: 1
      })

      await processPoach({
        pid: player1.pid,
        release: [],
        lid: leagueId,
        tid: poachingTeamId,
        user_id: 2
      })

      const waivers = await super_priority_waivers_for(player1.pid)
      expect(waivers).to.have.lengthOf(1)
      expect(waivers[0].processed).to.equal(null)
    })

    it('writes a new waiver when the earlier one has already resolved', async () => {
      // The case that makes the `processed`/`cancelled` guard load-bearing. A
      // repeat release whose earlier waiver resolved is a NEW entitlement --
      // the original team's chance was never consumed and they are owed
      // another. A guard keyed on any waiver at all would swallow it.
      const player1 = await selectPlayer({ pos: 'WR' })

      await addPlayer({
        teamId: originalTeamId,
        leagueId,
        userId: 1,
        player: player1,
        slot: roster_slot_types.PS,
        transaction: transaction_types.PRACTICE_ADD,
        value: 0
      })
      await fillRoster({ teamId: poachingTeamId, leagueId })

      await knex('waivers').insert({
        user_id: 0,
        pid: player1.pid,
        tid: originalTeamId,
        lid: leagueId,
        submitted: new Date(),
        bid_amount: 0,
        priority_order: 0,
        type: waiver_types.FREE_AGENCY_PRACTICE,
        super_priority: 1,
        processed: new Date(),
        is_successful: 0,
        reason: 'no practice squad space'
      })

      await processPoach({
        pid: player1.pid,
        release: [],
        lid: leagueId,
        tid: poachingTeamId,
        user_id: 2
      })

      const waivers = await super_priority_waivers_for(player1.pid)
      expect(waivers).to.have.lengthOf(2)
      expect(waivers.filter((w) => w.processed === null)).to.have.lengthOf(1)
    })
  })
})
