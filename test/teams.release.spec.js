/* global describe before beforeEach it */
process.env.NODE_ENV = 'test'

const chai = require('chai')
const chaiHTTP = require('chai-http')
const MockDate = require('mockdate')

const server = require('../api')
const knex = require('../db')

const league = require('../db/seeds/league')
const { constants } = require('../common')
const { getRoster } = require('../utils')
const { start } = constants.season
const { user1, user2 } = require('./fixtures/token')
const {
  notLoggedIn,
  missing,
  invalid,
  addPlayer,
  selectPlayer,
  error,
  checkLastTransaction
} = require('./utils')

chai.should()
chai.use(chaiHTTP)
const expect = chai.expect

describe('API /teams - release', function () {
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
      MockDate.set(start.clone().subtract('1', 'month').toDate())
      await league(knex)
    })

    it('practice squad player - season', async () => {
      MockDate.set(start.clone().add('1', 'month').day(5).toDate())

      const teamId = 1
      const leagueId = 1
      const userId = 1
      const player = await selectPlayer()
      await addPlayer({ player, leagueId, teamId, userId, slot: constants.slots.PS })

      const res = await chai.request(server)
        .post('/api/teams/1/release')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          player: player.player,
          teamId,
          leagueId
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      res.body.tid.should.equal(teamId)
      res.body.player.should.equal(player.player)
      expect(res.body.slot).to.equal(null)
      res.body.pos.should.equal(player.pos1)
      res.body.transaction.userid.should.equal(userId)
      res.body.transaction.tid.should.equal(teamId)
      res.body.transaction.lid.should.equal(leagueId)
      res.body.transaction.player.should.equal(player.player)
      res.body.transaction.type.should.equal(constants.transactions.ROSTER_RELEASE)
      res.body.transaction.value.should.equal(0)
      res.body.transaction.timestamp.should.equal(Math.round(Date.now() / 1000))

      const rosterRow = await getRoster({ tid: teamId })
      expect(rosterRow.players.length).to.equal(0)

      await checkLastTransaction({
        leagueId,
        type: constants.transactions.ROSTER_RELEASE,
        value: 0,
        player: player.player,
        teamId,
        userId
      })
    })

    it('practice squad player - offseason', async () => {
      MockDate.set(start.clone().subtract('1', 'month').toDate())

      const teamId = 1
      const leagueId = 1
      const userId = 1
      const player = await selectPlayer()
      await addPlayer({ player, leagueId, teamId, userId, slot: constants.slots.PS })

      const res = await chai.request(server)
        .post('/api/teams/1/release')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          player: player.player,
          teamId,
          leagueId
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      res.body.tid.should.equal(teamId)
      res.body.player.should.equal(player.player)
      expect(res.body.slot).to.equal(null)
      res.body.pos.should.equal(player.pos1)
      res.body.transaction.userid.should.equal(userId)
      res.body.transaction.tid.should.equal(teamId)
      res.body.transaction.lid.should.equal(leagueId)
      res.body.transaction.player.should.equal(player.player)
      res.body.transaction.type.should.equal(constants.transactions.ROSTER_RELEASE)
      res.body.transaction.value.should.equal(0)
      res.body.transaction.timestamp.should.equal(Math.round(Date.now() / 1000))

      const rosterRow = await getRoster({ tid: teamId })
      expect(rosterRow.players.length).to.equal(0)

      await checkLastTransaction({
        leagueId,
        type: constants.transactions.ROSTER_RELEASE,
        value: 0,
        player: player.player,
        teamId,
        userId
      })
    })

    it('active roster player - season', async () => {
      MockDate.set(start.clone().add('1', 'month').toDate())

      const teamId = 1
      const leagueId = 1
      const userId = 1
      const player = await selectPlayer()
      await addPlayer({ player, leagueId, teamId, userId, slot: constants.slots.BENCH })

      const res = await chai.request(server)
        .post('/api/teams/1/release')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          player: player.player,
          teamId,
          leagueId
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      res.body.tid.should.equal(teamId)
      res.body.player.should.equal(player.player)
      expect(res.body.slot).to.equal(null)
      res.body.pos.should.equal(player.pos1)
      res.body.transaction.userid.should.equal(userId)
      res.body.transaction.tid.should.equal(teamId)
      res.body.transaction.lid.should.equal(leagueId)
      res.body.transaction.player.should.equal(player.player)
      res.body.transaction.type.should.equal(constants.transactions.ROSTER_RELEASE)
      res.body.transaction.value.should.equal(0)
      res.body.transaction.timestamp.should.equal(Math.round(Date.now() / 1000))

      const rosterRow = await getRoster({ tid: teamId })
      expect(rosterRow.players.length).to.equal(0)

      await checkLastTransaction({
        leagueId,
        type: constants.transactions.ROSTER_RELEASE,
        value: 0,
        player: player.player,
        teamId,
        userId
      })
    })

    it('active roster player - offseason', async () => {
      MockDate.set(start.clone().subtract('1', 'month').toDate())

      const teamId = 1
      const leagueId = 1
      const userId = 1
      const player = await selectPlayer()
      await addPlayer({ player, leagueId, teamId, userId, slot: constants.slots.BENCH })

      const res = await chai.request(server)
        .post('/api/teams/1/release')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          player: player.player,
          teamId,
          leagueId
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      res.body.tid.should.equal(teamId)
      res.body.player.should.equal(player.player)
      expect(res.body.slot).to.equal(null)
      res.body.pos.should.equal(player.pos1)
      res.body.transaction.userid.should.equal(userId)
      res.body.transaction.tid.should.equal(teamId)
      res.body.transaction.lid.should.equal(leagueId)
      res.body.transaction.player.should.equal(player.player)
      res.body.transaction.type.should.equal(constants.transactions.ROSTER_RELEASE)
      res.body.transaction.value.should.equal(0)
      res.body.transaction.timestamp.should.equal(Math.round(Date.now() / 1000))

      const rosterRow = await getRoster({ tid: teamId })
      expect(rosterRow.players.length).to.equal(0)

      await checkLastTransaction({
        leagueId,
        type: constants.transactions.ROSTER_RELEASE,
        value: 0,
        player: player.player,
        teamId,
        userId
      })
    })

    it('ir player - offseason', async () => {
      MockDate.set(start.clone().subtract('1', 'month').toDate())

      const teamId = 1
      const leagueId = 1
      const userId = 1
      const player = await selectPlayer()
      await addPlayer({ player, leagueId, teamId, userId, slot: constants.slots.IR })

      const res = await chai.request(server)
        .post('/api/teams/1/release')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          player: player.player,
          teamId,
          leagueId
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      res.body.tid.should.equal(teamId)
      res.body.player.should.equal(player.player)
      expect(res.body.slot).to.equal(null)
      res.body.pos.should.equal(player.pos1)
      res.body.transaction.userid.should.equal(userId)
      res.body.transaction.tid.should.equal(teamId)
      res.body.transaction.lid.should.equal(leagueId)
      res.body.transaction.player.should.equal(player.player)
      res.body.transaction.type.should.equal(constants.transactions.ROSTER_RELEASE)
      res.body.transaction.value.should.equal(0)
      res.body.transaction.timestamp.should.equal(Math.round(Date.now() / 1000))

      const rosterRow = await getRoster({ tid: teamId })
      expect(rosterRow.players.length).to.equal(0)

      await checkLastTransaction({
        leagueId,
        type: constants.transactions.ROSTER_RELEASE,
        value: 0,
        player: player.player,
        teamId,
        userId
      })
    })

    it('ir player - season', async () => {
      MockDate.set(start.clone().add('1', 'month').toDate())

      const teamId = 1
      const leagueId = 1
      const userId = 1
      const player = await selectPlayer()
      await addPlayer({ player, leagueId, teamId, userId, slot: constants.slots.IR })

      const res = await chai.request(server)
        .post('/api/teams/1/release')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          player: player.player,
          teamId,
          leagueId
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      res.body.tid.should.equal(teamId)
      res.body.player.should.equal(player.player)
      expect(res.body.slot).to.equal(null)
      res.body.pos.should.equal(player.pos1)
      res.body.transaction.userid.should.equal(userId)
      res.body.transaction.tid.should.equal(teamId)
      res.body.transaction.lid.should.equal(leagueId)
      res.body.transaction.player.should.equal(player.player)
      res.body.transaction.type.should.equal(constants.transactions.ROSTER_RELEASE)
      res.body.transaction.value.should.equal(0)
      res.body.transaction.timestamp.should.equal(Math.round(Date.now() / 1000))

      const rosterRow = await getRoster({ tid: teamId })
      expect(rosterRow.players.length).to.equal(0)

      await checkLastTransaction({
        leagueId,
        type: constants.transactions.ROSTER_RELEASE,
        value: 0,
        player: player.player,
        teamId,
        userId
      })
    })

    it('locked active roster player - season', async () => {
      // TODO
    })

    it('covid player - season', async () => {
      // TODO
    })
  })

  describe('errors', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      MockDate.set(start.clone().subtract('1', 'month').toDate())
      await league(knex)
    })

    it('not logged in', async () => {
      const request = chai.request(server).post('/api/teams/1/release')
      await notLoggedIn(request)
    })

    it('missing player', async () => {
      const request = chai.request(server).post('/api/teams/1/release')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId: 1,
          leagueId: 1
        })

      await missing(request, 'player')
    })

    it('missing teamId', async () => {
      const request = chai.request(server).post('/api/teams/1/release')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          player: 'x',
          leagueId: 1
        })

      await missing(request, 'teamId')
    })

    it('missing leagueId', async () => {
      const request = chai.request(server).post('/api/teams/1/release')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          player: 'x',
          teamId: 1
        })

      await missing(request, 'leagueId')
    })

    it('teamId does not belong to userId', async () => {
      const request = chai.request(server).post('/api/teams/1/release')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          player: 'x',
          leagueId: 1,
          teamId: 1
        })

      await invalid(request, 'teamId')
    })

    it('invalid player - not on team', async () => {
      MockDate.set(start.clone().subtract('1', 'month').toDate())

      const teamId = 1
      const leagueId = 1
      const player = await selectPlayer()

      const request = chai.request(server)
        .post('/api/teams/1/release')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          player: player.player,
          teamId,
          leagueId
        })

      await error(request, 'player not on roster')
    })

    it('release player with a poaching claim', async () => {
      MockDate.set(start.clone().add('1', 'month').day(5).toDate())

      const teamId = 1
      const leagueId = 1
      const userId = 1
      const player = await selectPlayer()
      await addPlayer({ player, leagueId, teamId, userId, slot: constants.slots.PS })

      await knex('poaches').insert({
        player: player.player,
        userid: 2,
        tid: 2,
        lid: leagueId,
        submitted: Math.round(Date.now() / 1000)
      })

      const request = chai.request(server)
        .post('/api/teams/1/release')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          player: player.player,
          teamId,
          leagueId
        })

      await error(request, 'player has a poaching claim')
    })

    it('player is protected', async () => {
      const player = await selectPlayer()
      await addPlayer({ leagueId: 1, player, teamId: 1, userId: 1, slot: constants.slots.PSP })
      const request = chai.request(server).post('/api/teams/1/release')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          player: player.player,
          teamId: 1,
          leagueId: 1
        })

      await error(request, 'player is protected')
    })

    it('release locked starter', async () => {
      // TODO
    })

    it('release poached player - offseason', async () => {
      // TODO
    })

    it('release player after final week - locked', async () => {
      // TODO
    })
  })
})
