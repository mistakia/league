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
const { notLoggedIn, missing, invalid, addPlayer, error } = require('./utils')

chai.should()
chai.use(chaiHTTP)
const expect = chai.expect

describe('API /waivers - update', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.migrate.forceFreeMigrationsLock()
    await knex.migrate.rollback()
    await knex.migrate.latest()
    await knex.seed.run()
  })

  describe('put', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      MockDate.set(start.clone().subtract('1', 'month').toDate())
      await league(knex)
    })

    it('change order for single waiver', async () => {
      MockDate.set(start.clone().add('1', 'week').toDate())

      const players = await knex('player').whereNot('cteam', 'INA').limit(1)
      const playerId = players[0].player

      // submit waiver claim
      const teamId = 1
      const leagueId = 1
      const submitRes = await chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          player: playerId,
          type: constants.waivers.FREE_AGENCY,
          leagueId
        })

      const waiverId = submitRes.body.uid

      // reorder waiver claim
      const res = await chai
        .request(server)
        .put('/api/leagues/1/waivers/order')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          leagueId,
          waivers: [waiverId]
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      res.body.should.be.an('array')
      expect(res.body[0]).to.equal(waiverId)
    })

    it('change order for two waivers', async () => {
      MockDate.set(start.clone().add('1', 'week').toDate())

      const players = await knex('player').whereNot('cteam', 'INA').limit(2)
      const playerId1 = players[0].player
      const playerId2 = players[1].player

      // submit waiver claim #1
      const teamId = 1
      const leagueId = 1
      const submitRes1 = await chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          player: playerId1,
          type: constants.waivers.FREE_AGENCY,
          leagueId
        })

      const waiverId1 = submitRes1.body.uid

      // submit waiver claim #2
      const submitRes2 = await chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          player: playerId2,
          type: constants.waivers.FREE_AGENCY,
          leagueId
        })

      const waiverId2 = submitRes2.body.uid

      // reorder waiver claim
      const res = await chai
        .request(server)
        .put('/api/leagues/1/waivers/order')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          leagueId,
          waivers: [waiverId2, waiverId1]
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      res.body.should.be.an('array')
      expect(res.body[0]).to.equal(waiverId2)
      expect(res.body[1]).to.equal(waiverId1)
    })

    it('change order for three waivers', async () => {
      MockDate.set(start.clone().add('1', 'week').toDate())

      const players = await knex('player').whereNot('cteam', 'INA').limit(3)
      const playerId1 = players[0].player
      const playerId2 = players[1].player
      const playerId3 = players[2].player

      // submit waiver claim #1
      const teamId = 1
      const leagueId = 1
      const submitRes1 = await chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          player: playerId1,
          type: constants.waivers.FREE_AGENCY,
          leagueId
        })

      const waiverId1 = submitRes1.body.uid

      // submit waiver claim #1
      const submitRes2 = await chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          player: playerId2,
          type: constants.waivers.FREE_AGENCY,
          leagueId
        })

      const waiverId2 = submitRes2.body.uid

      // submit waiver claim #1
      const submitRes3 = await chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          player: playerId3,
          type: constants.waivers.FREE_AGENCY,
          leagueId
        })

      const waiverId3 = submitRes3.body.uid

      // reorder waiver claim
      const res = await chai
        .request(server)
        .put('/api/leagues/1/waivers/order')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          leagueId,
          waivers: [waiverId3, waiverId1, waiverId2]
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      res.body.should.be.an('array')
      expect(res.body[0]).to.equal(waiverId3)
      expect(res.body[1]).to.equal(waiverId1)
      expect(res.body[2]).to.equal(waiverId2)
    })

    it('update bid', async () => {
      MockDate.set(start.clone().add('1', 'week').toDate())

      const players = await knex('player').whereNot('cteam', 'INA').limit(1)
      const playerId = players[0].player

      // submit waiver claim
      const teamId = 1
      const leagueId = 1
      const submitRes = await chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          player: playerId,
          type: constants.waivers.FREE_AGENCY,
          leagueId
        })

      const waiverId = submitRes.body.uid

      // update bid
      const bid = 10
      const res = await chai
        .request(server)
        .put(`/api/leagues/1/waivers/${waiverId}`)
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          leagueId,
          bid
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json
      res.body.bid.should.equal(bid)

      const waivers = await knex('waivers')
        .where({ uid: res.body.uid })
        .limit(1)
      expect(waivers.length).to.equal(1)
      expect(waivers[0].bid).to.equal(bid)
    })

    it('update drop', async () => {
      MockDate.set(start.clone().add('1', 'week').toDate())

      const players = await knex('player')
        .whereNot('cteam', 'INA')
        .where('pos1', 'WR')
        .limit(2)
      const playerId = players[0].player
      const dropPlayer = players[1]

      // submit waiver claim
      const teamId = 1
      const leagueId = 1
      const submitRes = await chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          player: playerId,
          type: constants.waivers.FREE_AGENCY,
          leagueId
        })

      const waiverId = submitRes.body.uid

      // insert drop player into roster
      await addPlayer({ leagueId, player: dropPlayer, teamId, userId: 1 })

      // update drop
      const res = await chai
        .request(server)
        .put(`/api/leagues/1/waivers/${waiverId}`)
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          leagueId,
          drop: dropPlayer.player
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json
      res.body.drop.should.equal(dropPlayer.player)

      const waivers = await knex('waivers')
        .where({ uid: res.body.uid })
        .limit(1)
      expect(waivers.length).to.equal(1)
      expect(waivers[0].drop).to.equal(dropPlayer.player)
    })
  })

  describe('errors', function () {
    let waiverId
    before(async function () {
      this.timeout(60 * 1000)
      MockDate.set(start.clone().subtract('1', 'month').toDate())
      await league(knex)

      MockDate.set(start.clone().add('1', 'week').toDate())

      const players = await knex('player').whereNot('cteam', 'INA').limit(1)
      const playerId = players[0].player

      // submit waiver claim
      const teamId = 1
      const leagueId = 1
      const submitRes = await chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          player: playerId,
          type: constants.waivers.FREE_AGENCY,
          leagueId
        })

      waiverId = submitRes.body.uid
    })

    it('not logged in', async () => {
      const request = chai
        .request(server)
        .put(`/api/leagues/1/waivers/${waiverId}`)
      await notLoggedIn(request)
    })

    it('missing teamId', async () => {
      const request = chai
        .request(server)
        .put(`/api/leagues/1/waivers/${waiverId}`)
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          bid: 10
        })

      await missing(request, 'teamId')
    })

    it('missing leagueId', async () => {
      const request = chai
        .request(server)
        .put(`/api/leagues/1/waivers/${waiverId}`)
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId: 1,
          bid: 10
        })

      await missing(request, 'leagueId')
    })

    it('invalid drop', async () => {
      const request = chai
        .request(server)
        .put(`/api/leagues/1/waivers/${waiverId}`)
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId: 1,
          leagueId: 1,
          drop: 'x'
        })

      await invalid(request, 'drop')
    })

    it('invalid bid', async () => {
      const request = chai
        .request(server)
        .put(`/api/leagues/1/waivers/${waiverId}`)
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId: 1,
          leagueId: 1,
          bid: 'x'
        })

      await invalid(request, 'bid')
    })

    it('invalid teamId', async () => {
      const request = chai
        .request(server)
        .put(`/api/leagues/1/waivers/${waiverId}`)
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId: 'x',
          leagueId: 1,
          field: 'bid',
          value: 10
        })

      await invalid(request, 'teamId')
    })

    it('invalid leagueId', async () => {
      const request = chai
        .request(server)
        .put(`/api/leagues/1/waivers/${waiverId}`)
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId: 1,
          leagueId: 'x',
          field: 'bid',
          value: 10
        })

      await invalid(request, 'leagueId')
    })

    it('invalid bid - negative', async () => {
      const request = chai
        .request(server)
        .put(`/api/leagues/1/waivers/${waiverId}`)
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId: 1,
          leagueId: 1,
          bid: -1
        })

      await invalid(request, 'bid')
    })

    it('invalid bid - exceed cap', async () => {
      const request = chai
        .request(server)
        .put(`/api/leagues/1/waivers/${waiverId}`)
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId: 1,
          leagueId: 1,
          bid: 201
        })

      await error(request, 'bid exceeds available faab')
    })

    it('teamId does not belong to userId', async () => {
      const request = chai
        .request(server)
        .put(`/api/leagues/1/waivers/${waiverId}`)
        .set('Authorization', `Bearer ${user2}`)
        .send({
          teamId: 1,
          leagueId: 1,
          bid: 1
        })

      await invalid(request, 'teamId')
    })

    it('waiverId does not belong to teamId', async () => {
      const request = chai
        .request(server)
        .put(`/api/leagues/1/waivers/${waiverId}`)
        .set('Authorization', `Bearer ${user2}`)
        .send({
          teamId: 2,
          leagueId: 1,
          bid: 5
        })

      await invalid(request, 'waiverId')
    })

    it('waiverId is cancelled', async () => {
      // cancel waiver request
      await chai
        .request(server)
        .post(`/api/leagues/1/waivers/${waiverId}/cancel`)
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId: 1,
          leagueId: 1
        })

      const request = chai
        .request(server)
        .put(`/api/leagues/1/waivers/${waiverId}`)
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId: 1,
          leagueId: 1,
          bid: 1
        })

      await invalid(request, 'waiverId')
    })

    it('drop player not on team', async () => {
      MockDate.set(start.clone().add('1', 'week').toDate())

      const players = await knex('player')
        .whereNot('cteam', 'INA')
        .where('pos1', 'WR')
        .limit(2)
      const playerId = players[0].player
      const dropPlayerId = players[1].player

      // submit waiver claim
      const teamId = 1
      const leagueId = 1
      const submitRes = await chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          player: playerId,
          type: constants.waivers.FREE_AGENCY,
          leagueId
        })

      waiverId = submitRes.body.uid

      const request = chai
        .request(server)
        .put(`/api/leagues/1/waivers/${waiverId}`)
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId: 1,
          leagueId: 1,
          drop: dropPlayerId
        })

      await invalid(request, 'drop')
    })

    it('bid exceeds available cap', async () => {
      // TODO
    })

    it('drop player exceeds roster limits', async () => {
      // TODO
    })
  })
})
