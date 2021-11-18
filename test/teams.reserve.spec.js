/* global describe before it beforeEach */
process.env.NODE_ENV = 'test'

const chai = require('chai')
const chaiHTTP = require('chai-http')
const MockDate = require('mockdate')

const server = require('../api')
const knex = require('../db')

const league = require('../db/seeds/league')
const { constants } = require('../common')
const { start } = constants.season
const { user1, user2 } = require('./fixtures/token')
const {
  addPlayer,
  selectPlayer,
  checkLastTransaction,
  notLoggedIn,
  missing,
  invalid,
  error,
  fillRoster
} = require('./utils')

chai.should()
chai.use(chaiHTTP)
const expect = chai.expect

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

    it('move player to reserve - ir', async () => {
      MockDate.set(start.subtract('1', 'week').toDate())
      const player = await selectPlayer()
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 2
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player,
        slot: constants.slots.BENCH,
        transaction: constants.transactions.DRAFT,
        value
      })

      await knex('player')
        .update({
          status: 'Injured Reserve'
        })
        .where({
          player: player.player
        })

      const res = await chai
        .request(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          player: player.player,
          leagueId,
          slot: constants.slots.IR
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      res.body.tid.should.equal(teamId)
      res.body.player.should.equal(player.player)
      res.body.slot.should.equal(constants.slots.IR)
      res.body.transaction.userid.should.equal(userId)
      res.body.transaction.tid.should.equal(teamId)
      res.body.transaction.lid.should.equal(leagueId)
      res.body.transaction.player.should.equal(player.player)
      res.body.transaction.type.should.equal(constants.transactions.RESERVE_IR)
      res.body.transaction.value.should.equal(value)
      res.body.transaction.year.should.equal(constants.season.year)
      res.body.transaction.timestamp.should.equal(Math.round(Date.now() / 1000))

      const rosterRows = await knex('rosters_players')
        .join('rosters', 'rosters_players.rid', 'rosters.uid')
        .where({
          year: constants.season.year,
          week: constants.season.week,
          player: player.player
        })
        .limit(1)

      const rosterRow = rosterRows[0]
      expect(rosterRow.slot).to.equal(constants.slots.IR)

      await checkLastTransaction({
        leagueId,
        type: constants.transactions.RESERVE_IR,
        value,
        year: constants.season.year,
        player: player.player,
        teamId,
        userId
      })
    })

    it('move player from reserve/ir to reserve/cov', async () => {
      // TODO
    })
  })

  describe('errors', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      await league(knex)
      await knex('players').del()
    })

    it('not logged in', async () => {
      const request = chai.request(server).post('/api/teams/1/reserve')
      await notLoggedIn(request)
    })

    it('missing player', async () => {
      const request = chai
        .request(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          slot: constants.slots.IR
        })

      await missing(request, 'player')
    })

    it('missing leagueId', async () => {
      const request = chai
        .request(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          player: 'x',
          slot: constants.slots.IR
        })

      await missing(request, 'leagueId')
    })

    it('missing slot', async () => {
      const request = chai
        .request(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          player: 'x'
        })

      await missing(request, 'slot')
    })

    it('invalid slot', async () => {
      const request = chai
        .request(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          player: 'x',
          slot: 'x'
        })

      await invalid(request, 'slot')
    })

    it('invalid player - non-existant', async () => {
      const request = chai
        .request(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          player: 'x',
          slot: constants.slots.IR
        })

      await invalid(request, 'player')
    })

    it('invalid player - not on active roster', async () => {
      const player = await selectPlayer()
      const request = chai
        .request(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          player: player.player,
          slot: constants.slots.IR
        })

      await error(request, 'player not on roster')
    })

    it('teamId does not belong to userId', async () => {
      const player = await selectPlayer()
      const request = chai
        .request(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          leagueId: 1,
          player: player.player,
          slot: constants.slots.IR
        })

      await invalid(request, 'teamId')
    })

    it('player already on reserve/ir', async () => {
      const player = await selectPlayer()
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 2
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player,
        slot: constants.slots.IR,
        transaction: constants.transactions.DRAFT,
        value
      })
      const request = chai
        .request(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          player: player.player,
          slot: constants.slots.IR
        })

      await error(request, 'player already on reserve')
    })

    it('player already on reserve/cov', async () => {
      const player = await selectPlayer()
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 2
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player,
        slot: constants.slots.COV,
        transaction: constants.transactions.DRAFT,
        value
      })
      const request = chai
        .request(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          player: player.player,
          slot: constants.slots.COV
        })

      await error(request, 'player already on reserve')
    })

    it('player not on reserve/ir', async () => {
      MockDate.set(start.add('1', 'week').toDate())
      const player = await selectPlayer()
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 2
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player,
        slot: constants.slots.BENCH,
        transaction: constants.transactions.DRAFT,
        value
      })
      const request = chai
        .request(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          player: player.player,
          slot: constants.slots.IR
        })

      await error(request, 'player not eligible for Reserve')
    })

    it('player not on reserve/cov - no status', async () => {
      const player = await selectPlayer()
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 2
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player,
        slot: constants.slots.BENCH,
        transaction: constants.transactions.DRAFT,
        value
      })
      const request = chai
        .request(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          player: player.player,
          slot: constants.slots.COV
        })

      await error(request, 'player not eligible for Reserve/COV')
    })

    it('player not on reserve/cov - ir', async () => {
      MockDate.set(start.add('1', 'week').toDate())
      const player = await selectPlayer()
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 2
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player,
        slot: constants.slots.BENCH,
        transaction: constants.transactions.DRAFT,
        value
      })
      await knex('player')
        .update({
          status: 'Injured Reserve'
        })
        .where({
          player: player.player
        })
      const request = chai
        .request(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          player: player.player,
          slot: constants.slots.COV
        })

      await error(request, 'player not eligible for Reserve/COV')
    })

    it('exceeds ir roster limits', async () => {
      MockDate.set(start.subtract('1', 'week').toDate())
      const teamId = 1
      const leagueId = 1
      await fillRoster({ leagueId, teamId })

      const players = await knex('rosters_players')
        .join('rosters', 'rosters_players.rid', 'rosters.uid')
        .where({
          lid: leagueId,
          tid: teamId,
          week: constants.season.week,
          year: constants.season.year
        })
        .whereNot('slot', constants.slots.IR)
        .limit(1)

      const player = players[0].player
      await knex('player')
        .update({
          status: 'Injured Reserve'
        })
        .where({
          player
        })
      const request = chai
        .request(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          player,
          slot: constants.slots.IR
        })

      await error(request, 'exceeds roster limits')
    })

    it('player is a locked starter', async () => {
      // TODO
    })

    it('player is protected', async () => {
      const player = await selectPlayer()
      await addPlayer({
        leagueId: 1,
        player,
        teamId: 1,
        userId: 1,
        slot: constants.slots.PSP
      })
      await knex('player')
        .update({
          status: 'Injured Reserve'
        })
        .where({
          player: player.player
        })
      const request = chai
        .request(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          player: player.player,
          slot: constants.slots.IR,
          leagueId: 1
        })

      await error(request, 'protected players are not reserve eligible')
    })

    it('player not rostered on previous week roster', async () => {
      MockDate.set(start.add('2', 'week').toDate())
      const player = await selectPlayer()
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 2
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player,
        slot: constants.slots.BENCH,
        transaction: constants.transactions.ROSTER_ADD,
        value
      })

      await knex('player')
        .update({
          status: 'Injured Reserve'
        })
        .where({
          player: player.player
        })

      const request = chai
        .request(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          player: player.player,
          leagueId,
          slot: constants.slots.IR
        })

      await error(request, 'not eligible, not rostered long enough')
    })
  })
})
