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
const { getRoster } = require('../utils')
const {
  addPlayer,
  selectPlayer,
  missing,
  invalid,
  error,
  notLoggedIn
} = require('./utils')

chai.should()
chai.use(chaiHTTP)
const expect = chai.expect

describe('API /leagues/rosters - update', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.migrate.forceFreeMigrationsLock()
    await knex.migrate.rollback()
    await knex.migrate.latest()
    await knex.seed.run()
  })

  describe('put', function () {
    beforeEach(async function () {
      MockDate.set(start.subtract('2', 'month').toDate())
      await league(knex)
    })

    it('add player to roster', async () => {
      const leagueId = 1
      const teamId = 2
      const player = await selectPlayer()
      await addPlayer({
        leagueId,
        teamId,
        player,
        userId: 1,
        value: 198
      })

      const value = 10
      const res = await chai
        .request(server)
        .put('/api/leagues/1/rosters')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          player: player.player,
          teamId,
          leagueId,
          value
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      res.body.value.should.equal(value)

      const rosterRow = await getRoster({ tid: 2 })
      expect(rosterRow.tid).to.equal(teamId)
      expect(rosterRow.lid).to.equal(leagueId)
      expect(rosterRow.players.length).to.equal(1)
      expect(rosterRow.players[0].slot).to.equal(constants.slots.BENCH)
      expect(rosterRow.players[0].player).to.equal(player.player)
      expect(rosterRow.players[0].pos).to.equal(player.pos1)
      expect(rosterRow.players[0].userid).to.equal(1)
      expect(rosterRow.players[0].tid).to.equal(teamId)
      expect(rosterRow.players[0].lid).to.equal(leagueId)
      expect(rosterRow.players[0].type).to.equal(
        constants.transactions.ROSTER_ADD
      )
      expect(rosterRow.players[0].value).to.equal(value)
      expect(rosterRow.players[0].year).to.equal(constants.season.year)
    })
  })

  describe('errors', function () {
    beforeEach(async function () {
      MockDate.set(start.subtract('2', 'month').toDate())
      await league(knex)
    })

    it('not logged in', async () => {
      const request = chai.request(server).put('/api/leagues/1/rosters')
      await notLoggedIn(request)
    })

    it('missing player', async () => {
      const request = chai
        .request(server)
        .put('/api/leagues/1/rosters')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          value: 2,
          teamId: 1
        })

      await missing(request, 'player')
    })

    it('missing teamId', async () => {
      const request = chai
        .request(server)
        .put('/api/leagues/1/rosters')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          player: 'x',
          value: 2,
          leagueId: 1
        })

      await missing(request, 'teamId')
    })

    it('missing leagueId', async () => {
      const request = chai
        .request(server)
        .put('/api/leagues/1/rosters')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          player: 'x',
          value: 2,
          teamId: 1
        })

      await missing(request, 'leagueId')
    })

    it('missing value', async () => {
      const request = chai
        .request(server)
        .put('/api/leagues/1/rosters')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          player: 'x',
          teamId: 1
        })

      await missing(request, 'value')
    })

    it('invalid leagueId', async () => {
      const player = await selectPlayer()
      const request = chai
        .request(server)
        .put('/api/leagues/2/rosters')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId: 1,
          value: 2,
          player: player.player,
          leagueId: 2
        })

      await invalid(request, 'leagueId')
    })

    it('invalid player - does not exist', async () => {
      const request = chai
        .request(server)
        .put('/api/leagues/2/rosters')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          player: 'x',
          value: 2,
          teamId: 1,
          leagueId: 1
        })

      await invalid(request, 'player')
    })

    it('user is not commish', async () => {
      const player = await selectPlayer()
      const request = chai
        .request(server)
        .put('/api/leagues/1/rosters')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          player: player.player,
          value: 2,
          teamId: 1,
          leagueId: 1
        })

      await invalid(request, 'leagueId')
    })

    it('exceeds roster limit', async () => {
      // TODO
    })

    it('exceeds roster cap', async () => {
      const leagueId = 1
      const teamId = 2
      const player = await selectPlayer()
      await addPlayer({
        leagueId,
        teamId,
        player,
        userId: 1,
        value: 10
      })

      const value = 201
      const request = chai
        .request(server)
        .put('/api/leagues/1/rosters')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          player: player.player,
          teamId,
          leagueId,
          value
        })

      await error(request, 'exceeds cap space')
    })
  })
})
