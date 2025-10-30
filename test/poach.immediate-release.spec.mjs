/* global describe before beforeEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import { constants } from '#libs-shared'
import { addPlayer, selectPlayer, fillRoster } from './utils/index.mjs'
import league from '#db/seeds/league.mjs'
import { processPoach } from '#libs-server'

chai.should()
process.env.NODE_ENV = 'test'
const expect = chai.expect
const { regular_season_start } = constants.season

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
        slot: constants.slots.PS,
        transaction: constants.transactions.PRACTICE_ADD,
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
        userid: 2
      })

      // Check that poach transaction was created
      const poach_transaction = await knex('transactions')
        .where({
          pid: player1.pid,
          tid: poachingTeamId,
          lid: leagueId,
          type: constants.transactions.POACHED
        })
        .first()
      expect(poach_transaction).to.not.equal(undefined)

      // Check that release transaction was created immediately after
      const release_transaction = await knex('transactions')
        .where({
          pid: player1.pid,
          tid: poachingTeamId,
          lid: leagueId,
          type: constants.transactions.ROSTER_RELEASE
        })
        .first()
      expect(release_transaction).to.not.equal(undefined)

      // Check timestamps are within 1 second
      const time_difference = Math.abs(
        release_transaction.timestamp - poach_transaction.timestamp
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
          type: constants.waivers.FREE_AGENCY_PRACTICE
        })
        .first()
      expect(waiver).to.not.equal(undefined)
      expect(waiver.po).to.equal(0) // super priority
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
        slot: constants.slots.PS,
        transaction: constants.transactions.PRACTICE_ADD,
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
        userid: 2
      })

      // Check that poach transaction was created
      const poach_transaction = await knex('transactions')
        .where({
          pid: player1.pid,
          tid: poachingTeamId,
          lid: leagueId,
          type: constants.transactions.POACHED
        })
        .first()
      expect(poach_transaction).to.not.equal(undefined)

      // Check that NO release transaction was created
      const release_transaction = await knex('transactions')
        .where({
          pid: player1.pid,
          tid: poachingTeamId,
          lid: leagueId,
          type: constants.transactions.ROSTER_RELEASE
        })
        .first()
      expect(release_transaction).to.equal(undefined)

      // Check player IS on poaching team roster
      const roster_player = await knex('rosters_players')
        .where('tid', poachingTeamId)
        .andWhere('pid', player1.pid)
        .first()
      expect(roster_player).to.not.equal(undefined)
      expect(roster_player.slot).to.equal(constants.slots.BENCH)
    })
  })
})
