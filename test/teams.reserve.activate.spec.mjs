/* global describe before it beforeEach */
process.env.NODE_ENV = 'test'

import chai from 'chai'
import chaiHTTP from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import knex from '#db'
import league from '#db/seeds/league.mjs'
import { constants } from '#common'
import { user1 } from './fixtures/token.mjs'
import {
  addPlayer,
  selectPlayer,
  checkLastTransaction,
  invalid,
  error
} from './utils/index.mjs'

chai.should()
chai.use(chaiHTTP)
const expect = chai.expect
const { start } = constants.season

describe('API /teams - reserve', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.migrate.forceFreeMigrationsLock()
    await knex.migrate.rollback()
    await knex.migrate.latest()
    await knex.seed.run()
  })

  describe('post', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      await league(knex)
    })

    it('move player to reserve and activate player', async () => {
      MockDate.set(start.subtract('1', 'week').toDate())
      const player1 = await selectPlayer()
      const player2 = await selectPlayer()
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 2
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player: player1,
        slot: constants.slots.BENCH,
        transaction: constants.transactions.DRAFT,
        value
      })

      await addPlayer({
        teamId,
        leagueId,
        userId,
        player: player2,
        slot: constants.slots.IR,
        transaction: constants.transactions.DRAFT,
        value
      })

      await knex('player')
        .update({
          status: 'Injured Reserve'
        })
        .where({
          player: player1.player
        })

      const res = await chai
        .request(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          player: player1.player,
          activate: player2.player,
          leagueId,
          slot: constants.slots.IR
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      res.body.tid.should.equal(teamId)
      res.body.player.should.equal(player1.player)
      res.body.slot.should.equal(constants.slots.IR)
      res.body.transaction.userid.should.equal(userId)
      res.body.transaction.tid.should.equal(teamId)
      res.body.transaction.lid.should.equal(leagueId)
      res.body.transaction.player.should.equal(player1.player)
      res.body.transaction.type.should.equal(constants.transactions.RESERVE_IR)
      res.body.transaction.value.should.equal(value)
      res.body.transaction.year.should.equal(constants.season.year)
      res.body.transaction.timestamp.should.equal(Math.round(Date.now() / 1000))

      const rosterRows1 = await knex('rosters_players')
        .join('rosters', 'rosters_players.rid', 'rosters.uid')
        .where({
          year: constants.season.year,
          week: constants.season.week,
          player: player1.player
        })
        .limit(1)

      const rosterRow1 = rosterRows1[0]
      expect(rosterRow1.slot).to.equal(constants.slots.IR)

      const rosterRows2 = await knex('rosters_players')
        .join('rosters', 'rosters_players.rid', 'rosters.uid')
        .where({
          year: constants.season.year,
          week: constants.season.week,
          player: player2.player
        })
        .limit(1)

      const rosterRow2 = rosterRows2[0]
      expect(rosterRow2.slot).to.equal(constants.slots.BENCH)

      await checkLastTransaction({
        leagueId,
        type: constants.transactions.RESERVE_IR,
        value,
        year: constants.season.year,
        player: player1.player,
        teamId,
        userId
      })
    })
  })

  describe('errors', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      await league(knex)
      await knex('players').del()
    })

    it('invalid activate player - does not exist', async () => {
      MockDate.set(start.subtract('1', 'week').toDate())
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
        slot: constants.slots.BENCH,
        transaction: constants.transactions.DRAFT,
        value
      })

      await knex('player')
        .update({
          status: 'Injured Reserve'
        })
        .where({
          player: player1.player
        })

      const request = chai
        .request(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          activate: 'x',
          player: player1.player,
          slot: constants.slots.IR
        })

      await invalid(request, 'player')
    })

    it('invalid activate player - not on team', async () => {
      MockDate.set(start.subtract('1', 'week').toDate())
      const player1 = await selectPlayer()
      const player2 = await selectPlayer()
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 2
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player: player1,
        slot: constants.slots.BENCH,
        transaction: constants.transactions.DRAFT,
        value
      })

      await knex('player')
        .update({
          status: 'Injured Reserve'
        })
        .where({
          player: player1.player
        })

      const request = chai
        .request(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          activate: player2.player,
          player: player1.player,
          slot: constants.slots.IR
        })

      await invalid(request, 'player')
    })

    it('invalid activate player - on active roster', async () => {
      MockDate.set(start.subtract('1', 'week').toDate())
      const player1 = await selectPlayer()
      const player2 = await selectPlayer()
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 2
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player: player1,
        slot: constants.slots.BENCH,
        transaction: constants.transactions.DRAFT,
        value
      })

      await addPlayer({
        teamId,
        leagueId,
        userId,
        player: player2,
        slot: constants.slots.BENCH,
        transaction: constants.transactions.DRAFT,
        value
      })

      await knex('player')
        .update({
          status: 'Injured Reserve'
        })
        .where({
          player: player1.player
        })

      const request = chai
        .request(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          activate: player2.player,
          player: player1.player,
          slot: constants.slots.IR
        })

      await error(request, 'player is on active roster')
    })

    it('activate player is not on reserve', async () => {
      MockDate.set(start.subtract('1', 'week').toDate())
      const player1 = await selectPlayer()
      const player2 = await selectPlayer()
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 2
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player: player1,
        slot: constants.slots.BENCH,
        transaction: constants.transactions.DRAFT,
        value
      })

      await addPlayer({
        teamId,
        leagueId,
        userId,
        player: player2,
        slot: constants.slots.COV,
        transaction: constants.transactions.DRAFT,
        value
      })

      await knex('player')
        .update({
          status: 'Injured Reserve'
        })
        .where({
          player: player1.player
        })

      const request = chai
        .request(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          activate: player2.player,
          player: player1.player,
          slot: constants.slots.IR
        })

      await error(request, 'player is not on reserve')
    })
  })
})
