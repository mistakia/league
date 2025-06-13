/* global describe before beforeEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/seeds/league.mjs'
import { constants } from '#libs-shared'
import get_super_priority_status from '#libs-server/get-super-priority-status.mjs'
import { selectPlayer } from './utils/index.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect
chai.should()
const { start } = constants.season

describe('LIB - get_super_priority_status', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  beforeEach(async function () {
    this.timeout(60 * 1000)
    MockDate.set(start.subtract('1', 'month').toISOString())
    await league(knex)
  })

  describe('player not poached', function () {
    it('should return not eligible when player was never poached', async () => {
      const player = await selectPlayer({ rookie: false })

      const status = await get_super_priority_status({
        pid: player.pid,
        lid: 1
      })

      expect(status.eligible).to.equal(false)
      expect(status.reason).to.equal('Player was not poached')
      expect(status.original_tid).to.equal(null)
    })
  })

  describe('player was poached but no original team', function () {
    it('should return not eligible when cannot determine original team', async () => {
      const player = await selectPlayer({ rookie: false })

      // Create a poached transaction without prior team transactions
      await knex('transactions').insert({
        pid: player.pid,
        tid: 2,
        lid: 1,
        type: constants.transactions.POACHED,
        value: 0,
        year: constants.year,
        timestamp: Math.round(Date.now() / 1000) - 7 * 24 * 60 * 60, // 1 week ago
        week: constants.week - 1,
        userid: 2
      })

      const status = await get_super_priority_status({
        pid: player.pid,
        lid: 1
      })

      expect(status.eligible).to.equal(false)
      expect(status.reason).to.equal('Cannot determine original team')
      expect(status.original_tid).to.equal(null)
    })
  })

  describe('valid poach with original team', function () {
    let player, poach_timestamp

    beforeEach(async () => {
      player = await selectPlayer({ rookie: false })
      poach_timestamp = Math.round(Date.now() / 1000) - 7 * 24 * 60 * 60 // 1 week ago

      // Create original team transaction (practice squad add)
      await knex('transactions').insert({
        pid: player.pid,
        tid: 1, // Original team
        lid: 1,
        type: constants.transactions.PRACTICE_ADD,
        value: 0,
        year: constants.year,
        timestamp: poach_timestamp - 24 * 60 * 60, // 1 day before poach
        week: constants.week - 1,
        userid: 1
      })

      // Create poached transaction
      await knex('transactions').insert({
        pid: player.pid,
        tid: 2, // Poaching team
        lid: 1,
        type: constants.transactions.POACHED,
        value: 0,
        year: constants.year,
        timestamp: poach_timestamp,
        week: constants.week - 1,
        userid: 2
      })
    })

    it('should return eligible for recently poached player', async () => {
      const status = await get_super_priority_status({
        pid: player.pid,
        lid: 1
      })

      expect(status.eligible).to.equal(true)
      expect(status.original_tid).to.equal(1)
      expect(status.poaching_tid).to.equal(2)
      expect(status.poach_date).to.be.instanceof(Date)
      expect(status.weeks_since_poach).to.equal(1)
    })

    it('should return eligible for PS(D) player', async () => {
      // First create the roster for team 1 before the poach
      const [roster] = await knex('rosters')
        .insert({
          tid: 1, // Original team
          week: constants.week - 2,
          year: constants.year,
          lid: 1
        })
        .returning('uid')

      // Add roster entry showing player was in PS drafted slot
      await knex('rosters_players').insert({
        rid: roster.uid,
        pid: player.pid,
        tid: 1, // Original team
        lid: 1,
        slot: constants.slots.PSD, // PS drafted slot
        pos: player.pos,
        week: constants.week - 2,
        year: constants.year
      })

      const status = await get_super_priority_status({
        pid: player.pid,
        lid: 1
      })

      expect(status.eligible).to.equal(true)
      expect(status.original_tid).to.equal(1)
      expect(status.poaching_tid).to.equal(2)
    })
  })

  describe('disqualifying events', function () {
    let player, poach_timestamp

    beforeEach(async () => {
      player = await selectPlayer({ rookie: false })
      poach_timestamp = Math.round(Date.now() / 1000) - 7 * 24 * 60 * 60 // 1 week ago

      // Setup valid poach scenario
      await knex('transactions').insert([
        {
          pid: player.pid,
          tid: 1,
          lid: 1,
          type: constants.transactions.PRACTICE_ADD,
          value: 0,
          year: constants.year,
          timestamp: poach_timestamp - 24 * 60 * 60,
          week: constants.week - 1,
          userid: 1
        },
        {
          pid: player.pid,
          tid: 2,
          lid: 1,
          type: constants.transactions.POACHED,
          value: 0,
          year: constants.year,
          timestamp: poach_timestamp,
          week: constants.week - 1,
          userid: 2
        }
      ])
    })

    it('should return not eligible when player was traded', async () => {
      // Add trade transaction after poach
      await knex('transactions').insert({
        pid: player.pid,
        tid: 2,
        lid: 1,
        type: constants.transactions.TRADE,
        value: 0,
        year: constants.year,
        timestamp: poach_timestamp + 24 * 60 * 60, // 1 day after poach
        week: constants.week,
        userid: 2
      })

      const status = await get_super_priority_status({
        pid: player.pid,
        lid: 1
      })

      expect(status.eligible).to.equal(false)
      expect(status.reason).to.equal('Player was traded')
      expect(status.original_tid).to.equal(1)
    })

    it('should return not eligible when player was extended', async () => {
      // Add extension transaction after poach
      await knex('transactions').insert({
        pid: player.pid,
        tid: 2,
        lid: 1,
        type: constants.transactions.EXTENSION,
        value: 0,
        year: constants.year,
        timestamp: poach_timestamp + 24 * 60 * 60,
        week: constants.week,
        userid: 2
      })

      const status = await get_super_priority_status({
        pid: player.pid,
        lid: 1
      })

      expect(status.eligible).to.equal(false)
      expect(status.reason).to.equal('Player was extended')
      expect(status.original_tid).to.equal(1)
    })

    it('should return not eligible when player was transition tagged', async () => {
      // Add transition tag transaction after poach
      await knex('transactions').insert({
        pid: player.pid,
        tid: 2,
        lid: 1,
        type: constants.transactions.TRANSITION_TAG,
        value: 0,
        year: constants.year,
        timestamp: poach_timestamp + 24 * 60 * 60,
        week: constants.week,
        userid: 2
      })

      const status = await get_super_priority_status({
        pid: player.pid,
        lid: 1
      })

      expect(status.eligible).to.equal(false)
      expect(status.reason).to.equal('Player was signed (rfa)')
      expect(status.original_tid).to.equal(1)
    })
  })

  describe('time-based disqualifications', function () {
    let player, poach_timestamp

    beforeEach(async () => {
      player = await selectPlayer({ rookie: false })
      poach_timestamp = Math.round(Date.now() / 1000) - 35 * 24 * 60 * 60 // 5 weeks ago

      // Setup valid poach scenario
      await knex('transactions').insert([
        {
          pid: player.pid,
          tid: 1,
          lid: 1,
          type: constants.transactions.PRACTICE_ADD,
          value: 0,
          year: constants.year,
          timestamp: poach_timestamp - 24 * 60 * 60,
          week: constants.week - 5,
          userid: 1
        },
        {
          pid: player.pid,
          tid: 2,
          lid: 1,
          type: constants.transactions.POACHED,
          value: 0,
          year: constants.year,
          timestamp: poach_timestamp,
          week: constants.week - 5,
          userid: 2
        }
      ])
    })

    it('should return not eligible when player rostered for 4+ weeks', async () => {
      // First create the rosters for the weeks we need
      const rosterIds = []
      for (let i = 0; i < 4; i++) {
        const weekNum = constants.week - 4 + i
        const [roster] = await knex('rosters')
          .insert({
            tid: 2, // Poaching team
            week: weekNum,
            year: constants.year,
            lid: 1
          })
          .returning('uid')
        rosterIds.push(roster.uid)
      }

      // Add roster entries for 4 weeks on poaching team
      const rosterEntries = []
      for (let i = 0; i < 4; i++) {
        rosterEntries.push({
          rid: rosterIds[i],
          pid: player.pid,
          tid: 2, // Poaching team
          lid: 1,
          slot: constants.slots.PS,
          pos: player.pos,
          week: constants.week - 4 + i,
          year: constants.year
        })
      }
      await knex('rosters_players').insert(rosterEntries)

      const status = await get_super_priority_status({
        pid: player.pid,
        lid: 1
      })

      expect(status.eligible).to.equal(false)
      expect(status.reason).to.equal('Player rostered for 4+ weeks')
      expect(status.original_tid).to.equal(1)
    })

    it('should return not eligible when player started 1+ games', async () => {
      // First create the roster for the week
      const [roster] = await knex('rosters')
        .insert({
          tid: 2, // Poaching team
          week: constants.week - 1,
          year: constants.year,
          lid: 1
        })
        .returning('uid')

      // Add roster entry in starting slot
      await knex('rosters_players').insert({
        rid: roster.uid,
        pid: player.pid,
        tid: 2, // Poaching team
        lid: 1,
        slot: constants.slots.QB, // Starting slot
        pos: player.pos,
        week: constants.week - 1,
        year: constants.year
      })

      const status = await get_super_priority_status({
        pid: player.pid,
        lid: 1
      })

      expect(status.eligible).to.equal(false)
      expect(status.reason).to.equal('Player started in 1+ games')
      expect(status.original_tid).to.equal(1)
    })
  })

  describe('release_tid parameter', function () {
    let player1, player2, poach_timestamp

    beforeEach(async () => {
      player1 = await selectPlayer({ rookie: false })
      player2 = await selectPlayer({
        rookie: false,
        exclude_pids: [player1.pid]
      })
      poach_timestamp = Math.round(Date.now() / 1000) - 7 * 24 * 60 * 60 // 1 week ago

      // Setup poach scenario for both players from different teams
      await knex('transactions').insert([
        // Player 1 poached from team 1 to team 2
        {
          pid: player1.pid,
          tid: 1,
          lid: 1,
          type: constants.transactions.PRACTICE_ADD,
          value: 0,
          year: constants.year,
          timestamp: poach_timestamp - 24 * 60 * 60,
          week: constants.week - 1,
          userid: 1
        },
        {
          pid: player1.pid,
          tid: 2,
          lid: 1,
          type: constants.transactions.POACHED,
          value: 0,
          year: constants.year,
          timestamp: poach_timestamp,
          week: constants.week - 1,
          userid: 2
        },
        // Player 2 poached from team 3 to team 2
        {
          pid: player2.pid,
          tid: 3,
          lid: 1,
          type: constants.transactions.PRACTICE_ADD,
          value: 0,
          year: constants.year,
          timestamp: poach_timestamp - 24 * 60 * 60,
          week: constants.week - 1,
          userid: 3
        },
        {
          pid: player2.pid,
          tid: 2,
          lid: 1,
          type: constants.transactions.POACHED,
          value: 0,
          year: constants.year,
          timestamp: poach_timestamp,
          week: constants.week - 1,
          userid: 2
        }
      ])
    })

    it('should filter by specific poaching team when release_tid provided', async () => {
      const status = await get_super_priority_status({
        pid: player1.pid,
        lid: 1,
        release_tid: 2 // Only consider poaches by team 2
      })

      expect(status.eligible).to.equal(true)
      expect(status.original_tid).to.equal(1)
      expect(status.poaching_tid).to.equal(2)
    })

    it('should return not eligible when release_tid does not match any poach', async () => {
      const status = await get_super_priority_status({
        pid: player1.pid,
        lid: 1,
        release_tid: 4 // Team 4 never poached this player
      })

      expect(status.eligible).to.equal(false)
      expect(status.reason).to.equal('Player was not poached')
    })
  })

  describe('super_priority table integration', function () {
    let player, poach_timestamp

    beforeEach(async () => {
      player = await selectPlayer({ rookie: false })
      poach_timestamp = Math.round(Date.now() / 1000) - 7 * 24 * 60 * 60 // 1 week ago

      // Setup valid poach scenario
      await knex('transactions').insert([
        {
          pid: player.pid,
          tid: 1,
          lid: 1,
          type: constants.transactions.PRACTICE_ADD,
          value: 0,
          year: constants.year,
          timestamp: poach_timestamp - 24 * 60 * 60,
          week: constants.week - 1,
          userid: 1
        },
        {
          pid: player.pid,
          tid: 2,
          lid: 1,
          type: constants.transactions.POACHED,
          value: 0,
          year: constants.year,
          timestamp: poach_timestamp,
          week: constants.week - 1,
          userid: 2
        }
      ])
    })

    it('should return null super_priority_uid when no record exists', async () => {
      const status = await get_super_priority_status({
        pid: player.pid,
        lid: 1
      })

      expect(status.eligible).to.equal(true)
      expect(status.super_priority_uid).to.equal(null)
    })

    it('should include super_priority_uid when record exists', async () => {
      // Create super_priority record
      const [super_priority_record] = await knex('super_priority')
        .insert({
          pid: player.pid,
          original_tid: 1,
          poaching_tid: 2,
          lid: 1,
          poach_timestamp,
          eligible: 1,
          claimed: 0
        })
        .returning('uid')

      const status = await get_super_priority_status({
        pid: player.pid,
        lid: 1
      })

      expect(status.eligible).to.equal(true)
      expect(status.super_priority_uid).to.equal(super_priority_record.uid)
    })

    it('should return not eligible when record is claimed', async () => {
      // Create claimed super_priority record
      await knex('super_priority').insert({
        pid: player.pid,
        original_tid: 1,
        poaching_tid: 2,
        lid: 1,
        poach_timestamp,
        eligible: 1,
        claimed: 1 // Already claimed
      })

      const status = await get_super_priority_status({
        pid: player.pid,
        lid: 1
      })

      expect(status.eligible).to.equal(false)
      expect(status.reason).to.equal('Super priority already claimed')
      expect(status.original_tid).to.equal(1)
    })
  })
})
