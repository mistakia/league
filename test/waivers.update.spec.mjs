/* global describe before it beforeEach */
import chai from 'chai'
import chaiHTTP from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import knex from '#db'

import league from '#db/seeds/league.mjs'
import { constants } from '#libs-shared'
import { user1, user2 } from './fixtures/token.mjs'
import {
  notLoggedIn,
  missing,
  invalid,
  addPlayer,
  error
} from './utils/index.mjs'

process.env.NODE_ENV = 'test'

chai.should()
chai.use(chaiHTTP)
const expect = chai.expect
const { start } = constants.season

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
      MockDate.set(start.subtract('1', 'month').toISOString())
      await league(knex)
    })

    it('change order for single waiver', async () => {
      MockDate.set(start.add('1', 'week').toISOString())

      const players = await knex('player').whereNot('cteam', 'INA').limit(1)
      const pid = players[0].pid

      // submit waiver claim
      const teamId = 1
      const leagueId = 1
      const submitRes = await chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          pid,
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
      MockDate.set(start.add('1', 'week').toISOString())

      const players = await knex('player').whereNot('cteam', 'INA').limit(2)
      const pid1 = players[0].pid
      const pid2 = players[1].pid

      // submit waiver claim #1
      const teamId = 1
      const leagueId = 1
      const submitRes1 = await chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          pid: pid1,
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
          pid: pid2,
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
      MockDate.set(start.add('1', 'week').toISOString())

      const players = await knex('player').whereNot('cteam', 'INA').limit(3)
      const pid1 = players[0].pid
      const pid2 = players[1].pid
      const pid3 = players[2].pid

      // submit waiver claim #1
      const teamId = 1
      const leagueId = 1
      const submitRes1 = await chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          pid: pid1,
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
          pid: pid2,
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
          pid: pid3,
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
      MockDate.set(start.add('1', 'week').toISOString())

      const players = await knex('player').whereNot('cteam', 'INA').limit(1)
      const pid = players[0].pid

      // submit waiver claim
      const teamId = 1
      const leagueId = 1
      const submitRes = await chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          pid,
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

    it('update release', async () => {
      MockDate.set(start.add('1', 'week').toISOString())

      const players = await knex('player')
        .whereNot('cteam', 'INA')
        .where('pos1', 'WR')
        .limit(2)
      const pid = players[0].pid
      const releasePlayer = players[1]

      // submit waiver claim
      const teamId = 1
      const leagueId = 1
      const submitRes = await chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          pid,
          type: constants.waivers.FREE_AGENCY,
          leagueId
        })

      const waiverId = submitRes.body.uid

      // insert release player into roster
      await addPlayer({ leagueId, player: releasePlayer, teamId, userId: 1 })

      // update release
      const res = await chai
        .request(server)
        .put(`/api/leagues/1/waivers/${waiverId}`)
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          leagueId,
          release: releasePlayer.pid
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json
      res.body.release.should.deep.equal([releasePlayer.pid])

      const waivers = await knex('waiver_releases')
        .where({ waiverid: res.body.uid })
        .limit(1)
      expect(waivers.length).to.equal(1)
      expect(waivers[0].pid).to.equal(releasePlayer.pid)
    })
  })

  describe('errors', function () {
    let waiverId
    before(async function () {
      this.timeout(60 * 1000)
      MockDate.set(start.subtract('1', 'month').toISOString())
      await league(knex)

      MockDate.set(start.add('1', 'week').toISOString())

      const players = await knex('player').whereNot('cteam', 'INA').limit(1)
      const pid = players[0].pid

      // submit waiver claim
      const teamId = 1
      const leagueId = 1
      const submitRes = await chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          pid,
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

    it('invalid release', async () => {
      const request = chai
        .request(server)
        .put(`/api/leagues/1/waivers/${waiverId}`)
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId: 1,
          leagueId: 1,
          release: 'x'
        })

      await invalid(request, 'release')
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

    it('release player not on team', async () => {
      MockDate.set(start.add('1', 'week').toISOString())

      const players = await knex('player')
        .whereNot('cteam', 'INA')
        .where('pos1', 'WR')
        .limit(2)
      const pid = players[0].pid
      const releasePlayerId = players[1].pid

      // submit waiver claim
      const teamId = 1
      const leagueId = 1
      const submitRes = await chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          pid,
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
          release: releasePlayerId
        })

      await invalid(request, 'release')
    })

    it('bid exceeds available cap', async () => {
      // TODO
    })

    it('release player exceeds roster limits', async () => {
      // TODO
    })
  })
})
