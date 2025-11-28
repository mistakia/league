/* global describe before it beforeEach */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import knex from '#db'
import league from '#db/seeds/league.mjs'
import {
  current_season,
  roster_slot_types,
  transaction_types,
  player_nfl_status
} from '#constants'
import { user1 } from './fixtures/token.mjs'
import {
  addPlayer,
  selectPlayer,
  checkLastTransaction,
  invalid,
  error
} from './utils/index.mjs'

process.env.NODE_ENV = 'test'

chai.should()
chai.use(chai_http)
const expect = chai.expect
const { regular_season_start } = current_season

describe('API /teams - reserve', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  describe('post', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      await league(knex)
    })

    it('move player to reserve and activate player', async () => {
      MockDate.set(regular_season_start.subtract('1', 'week').toISOString())
      const player1 = await selectPlayer()
      const player2 = await selectPlayer({ exclude_pids: [player1.pid] })
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 2
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player: player1,
        slot: roster_slot_types.BENCH,
        transaction: transaction_types.DRAFT,
        value
      })

      await addPlayer({
        teamId,
        leagueId,
        userId,
        player: player2,
        slot: roster_slot_types.RESERVE_SHORT_TERM,
        transaction: transaction_types.DRAFT,
        value
      })

      await knex('player')
        .update({
          nfl_status: player_nfl_status.INJURED_RESERVE
        })
        .where({
          pid: player1.pid
        })

      const res = await chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          reserve_pid: player1.pid,
          activate_pid: player2.pid,
          leagueId,
          slot: roster_slot_types.RESERVE_SHORT_TERM
        })

      res.should.have.status(200)

      res.should.be.json

      res.body.tid.should.equal(teamId)
      res.body.pid.should.equal(player1.pid)
      res.body.slot.should.equal(roster_slot_types.RESERVE_SHORT_TERM)
      res.body.transaction.userid.should.equal(userId)
      res.body.transaction.tid.should.equal(teamId)
      res.body.transaction.lid.should.equal(leagueId)
      res.body.transaction.pid.should.equal(player1.pid)
      res.body.transaction.type.should.equal(transaction_types.RESERVE_IR)
      res.body.transaction.value.should.equal(value)
      res.body.transaction.year.should.equal(current_season.year)
      res.body.transaction.timestamp.should.equal(Math.round(Date.now() / 1000))

      const rosterRows1 = await knex('rosters_players')
        .where({
          year: current_season.year,
          week: current_season.week,
          pid: player1.pid
        })
        .limit(1)

      const rosterRow1 = rosterRows1[0]
      expect(rosterRow1.slot).to.equal(roster_slot_types.RESERVE_SHORT_TERM)

      const rosterRows2 = await knex('rosters_players')
        .where({
          year: current_season.year,
          week: current_season.week,
          pid: player2.pid
        })
        .limit(1)

      const rosterRow2 = rosterRows2[0]
      expect(rosterRow2.slot).to.equal(roster_slot_types.BENCH)

      await checkLastTransaction({
        leagueId,
        type: transaction_types.RESERVE_IR,
        value,
        year: current_season.year,
        pid: player1.pid,
        teamId,
        userId
      })
    })
  })

  describe('errors', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      await league(knex)
    })

    it('invalid activate player - does not exist', async () => {
      MockDate.set(regular_season_start.subtract('1', 'week').toISOString())
      const player1 = await selectPlayer()
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 2
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player: player1,
        slot: roster_slot_types.BENCH,
        transaction: transaction_types.DRAFT,
        value
      })

      await knex('player')
        .update({
          nfl_status: player_nfl_status.INJURED_RESERVE
        })
        .where({
          pid: player1.pid
        })

      const request = chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          activate_pid: 'x',
          reserve_pid: player1.pid,
          slot: roster_slot_types.RESERVE_SHORT_TERM
        })

      await invalid(request, 'player')
    })

    it('invalid activate player - not on team', async () => {
      MockDate.set(regular_season_start.subtract('1', 'week').toISOString())
      const player1 = await selectPlayer()
      const player2 = await selectPlayer({ exclude_pids: [player1.pid] })
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 2
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player: player1,
        slot: roster_slot_types.BENCH,
        transaction: transaction_types.DRAFT,
        value
      })

      await knex('player')
        .update({
          nfl_status: player_nfl_status.INJURED_RESERVE
        })
        .where({
          pid: player1.pid
        })

      const request = chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          activate_pid: player2.pid,
          reserve_pid: player1.pid,
          slot: roster_slot_types.RESERVE_SHORT_TERM
        })

      await invalid(request, 'player')
    })

    it('invalid activate player - on active roster', async () => {
      MockDate.set(regular_season_start.subtract('1', 'week').toISOString())
      const player1 = await selectPlayer()
      const player2 = await selectPlayer({ exclude_pids: [player1.pid] })
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 2
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player: player1,
        slot: roster_slot_types.BENCH,
        transaction: transaction_types.DRAFT,
        value
      })

      await addPlayer({
        teamId,
        leagueId,
        userId,
        player: player2,
        slot: roster_slot_types.BENCH,
        transaction: transaction_types.DRAFT,
        value
      })

      await knex('player')
        .update({
          nfl_status: player_nfl_status.INJURED_RESERVE
        })
        .where({
          pid: player1.pid
        })

      const request = chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          activate_pid: player2.pid,
          reserve_pid: player1.pid,
          slot: roster_slot_types.RESERVE_SHORT_TERM
        })

      await error(request, 'player is on active roster')
    })

    it('activate player is not on reserve', async () => {
      MockDate.set(regular_season_start.subtract('1', 'week').toISOString())
      const player1 = await selectPlayer()
      const player2 = await selectPlayer({ exclude_pids: [player1.pid] })
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 2
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player: player1,
        slot: roster_slot_types.BENCH,
        transaction: transaction_types.DRAFT,
        value
      })

      await addPlayer({
        teamId,
        leagueId,
        userId,
        player: player2,
        slot: roster_slot_types.COV,
        transaction: transaction_types.DRAFT,
        value
      })

      await knex('player')
        .update({
          nfl_status: player_nfl_status.INJURED_RESERVE
        })
        .where({
          pid: player1.pid
        })

      const request = chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          activate_pid: player2.pid,
          reserve_pid: player1.pid,
          slot: roster_slot_types.RESERVE_SHORT_TERM
        })

      await error(request, 'player is not on reserve')
    })
  })
})
