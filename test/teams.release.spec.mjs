/* global describe before beforeEach it */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import knex from '#db'
import league from '#db/seeds/league.mjs'
import { constants } from '#libs-shared'
import { getRoster } from '#libs-server'
import { user1, user2 } from './fixtures/token.mjs'
import {
  notLoggedIn,
  missing,
  invalid,
  addPlayer,
  selectPlayer,
  error,
  checkLastTransaction
} from './utils/index.mjs'

process.env.NODE_ENV = 'test'

chai.should()
chai.use(chai_http)
const expect = chai.expect
const { start } = constants.season

describe('API /teams - release', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  describe('post', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      MockDate.set(start.subtract('1', 'week').toISOString())
      await league(knex)
    })

    it('practice squad player - season', async () => {
      MockDate.set(start.add('1', 'month').day(5).toISOString())

      const teamId = 1
      const leagueId = 1
      const userId = 1
      const player = await selectPlayer()
      await addPlayer({
        player,
        leagueId,
        teamId,
        userId,
        slot: constants.slots.PS
      })

      const res = await chai_request
        .execute(server)
        .post('/api/teams/1/release')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          pid: player.pid,
          teamId,
          leagueId
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      res.body.tid.should.equal(teamId)
      res.body.pid.should.equal(player.pid)
      expect(res.body.slot).to.equal(null)
      res.body.pos.should.equal(player.pos1)
      res.body.transaction.userid.should.equal(userId)
      res.body.transaction.tid.should.equal(teamId)
      res.body.transaction.lid.should.equal(leagueId)
      res.body.transaction.pid.should.equal(player.pid)
      res.body.transaction.type.should.equal(
        constants.transactions.ROSTER_RELEASE
      )
      res.body.transaction.value.should.equal(0)
      res.body.transaction.timestamp.should.equal(Math.round(Date.now() / 1000))

      const rosterRow = await getRoster({ tid: teamId })
      expect(rosterRow.players.length).to.equal(0)

      await checkLastTransaction({
        leagueId,
        type: constants.transactions.ROSTER_RELEASE,
        value: 0,
        pid: player.pid,
        teamId,
        userId
      })
    })

    it('practice squad player - offseason', async () => {
      MockDate.set(start.subtract('1', 'month').toISOString())

      const teamId = 1
      const leagueId = 1
      const userId = 1
      const player = await selectPlayer()
      await addPlayer({
        player,
        leagueId,
        teamId,
        userId,
        slot: constants.slots.PS
      })

      const res = await chai_request
        .execute(server)
        .post('/api/teams/1/release')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          pid: player.pid,
          teamId,
          leagueId
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      res.body.tid.should.equal(teamId)
      res.body.pid.should.equal(player.pid)
      expect(res.body.slot).to.equal(null)
      res.body.pos.should.equal(player.pos1)
      res.body.transaction.userid.should.equal(userId)
      res.body.transaction.tid.should.equal(teamId)
      res.body.transaction.lid.should.equal(leagueId)
      res.body.transaction.pid.should.equal(player.pid)
      res.body.transaction.type.should.equal(
        constants.transactions.ROSTER_RELEASE
      )
      res.body.transaction.value.should.equal(0)
      res.body.transaction.timestamp.should.equal(Math.round(Date.now() / 1000))

      const rosterRow = await getRoster({ tid: teamId })
      expect(rosterRow.players.length).to.equal(0)

      await checkLastTransaction({
        leagueId,
        type: constants.transactions.ROSTER_RELEASE,
        value: 0,
        pid: player.pid,
        teamId,
        userId
      })
    })

    it('active roster player - season', async () => {
      MockDate.set(start.add('1', 'month').toISOString())

      const teamId = 1
      const leagueId = 1
      const userId = 1
      const player = await selectPlayer()
      await addPlayer({
        player,
        leagueId,
        teamId,
        userId,
        slot: constants.slots.BENCH
      })

      const res = await chai_request
        .execute(server)
        .post('/api/teams/1/release')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          pid: player.pid,
          teamId,
          leagueId
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      res.body.tid.should.equal(teamId)
      res.body.pid.should.equal(player.pid)
      expect(res.body.slot).to.equal(null)
      res.body.pos.should.equal(player.pos1)
      res.body.transaction.userid.should.equal(userId)
      res.body.transaction.tid.should.equal(teamId)
      res.body.transaction.lid.should.equal(leagueId)
      res.body.transaction.pid.should.equal(player.pid)
      res.body.transaction.type.should.equal(
        constants.transactions.ROSTER_RELEASE
      )
      res.body.transaction.value.should.equal(0)
      res.body.transaction.timestamp.should.equal(Math.round(Date.now() / 1000))

      const rosterRow = await getRoster({ tid: teamId })
      expect(rosterRow.players.length).to.equal(0)

      await checkLastTransaction({
        leagueId,
        type: constants.transactions.ROSTER_RELEASE,
        value: 0,
        pid: player.pid,
        teamId,
        userId
      })
    })

    it('active roster player - offseason', async () => {
      MockDate.set(start.subtract('1', 'month').toISOString())

      const teamId = 1
      const leagueId = 1
      const userId = 1
      const player = await selectPlayer()
      await addPlayer({
        player,
        leagueId,
        teamId,
        userId,
        slot: constants.slots.BENCH
      })

      const res = await chai_request
        .execute(server)
        .post('/api/teams/1/release')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          pid: player.pid,
          teamId,
          leagueId
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      res.body.tid.should.equal(teamId)
      res.body.pid.should.equal(player.pid)
      expect(res.body.slot).to.equal(null)
      res.body.pos.should.equal(player.pos1)
      res.body.transaction.userid.should.equal(userId)
      res.body.transaction.tid.should.equal(teamId)
      res.body.transaction.lid.should.equal(leagueId)
      res.body.transaction.pid.should.equal(player.pid)
      res.body.transaction.type.should.equal(
        constants.transactions.ROSTER_RELEASE
      )
      res.body.transaction.value.should.equal(0)
      res.body.transaction.timestamp.should.equal(Math.round(Date.now() / 1000))

      const rosterRow = await getRoster({ tid: teamId })
      expect(rosterRow.players.length).to.equal(0)

      await checkLastTransaction({
        leagueId,
        type: constants.transactions.ROSTER_RELEASE,
        value: 0,
        pid: player.pid,
        teamId,
        userId
      })
    })

    it('ir player - offseason', async () => {
      MockDate.set(start.subtract('1', 'month').toISOString())

      const teamId = 1
      const leagueId = 1
      const userId = 1
      const player = await selectPlayer()
      await addPlayer({
        player,
        leagueId,
        teamId,
        userId,
        slot: constants.slots.IR
      })

      const res = await chai_request
        .execute(server)
        .post('/api/teams/1/release')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          pid: player.pid,
          teamId,
          leagueId
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      res.body.tid.should.equal(teamId)
      res.body.pid.should.equal(player.pid)
      expect(res.body.slot).to.equal(null)
      res.body.pos.should.equal(player.pos1)
      res.body.transaction.userid.should.equal(userId)
      res.body.transaction.tid.should.equal(teamId)
      res.body.transaction.lid.should.equal(leagueId)
      res.body.transaction.pid.should.equal(player.pid)
      res.body.transaction.type.should.equal(
        constants.transactions.ROSTER_RELEASE
      )
      res.body.transaction.value.should.equal(0)
      res.body.transaction.timestamp.should.equal(Math.round(Date.now() / 1000))

      const rosterRow = await getRoster({ tid: teamId })
      expect(rosterRow.players.length).to.equal(0)

      await checkLastTransaction({
        leagueId,
        type: constants.transactions.ROSTER_RELEASE,
        value: 0,
        pid: player.pid,
        teamId,
        userId
      })
    })

    it('ir player - season', async () => {
      MockDate.set(start.add('1', 'month').toISOString())

      const teamId = 1
      const leagueId = 1
      const userId = 1
      const player = await selectPlayer()
      await addPlayer({
        player,
        leagueId,
        teamId,
        userId,
        slot: constants.slots.IR
      })

      const res = await chai_request
        .execute(server)
        .post('/api/teams/1/release')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          pid: player.pid,
          teamId,
          leagueId
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      res.body.tid.should.equal(teamId)
      res.body.pid.should.equal(player.pid)
      expect(res.body.slot).to.equal(null)
      res.body.pos.should.equal(player.pos1)
      res.body.transaction.userid.should.equal(userId)
      res.body.transaction.tid.should.equal(teamId)
      res.body.transaction.lid.should.equal(leagueId)
      res.body.transaction.pid.should.equal(player.pid)
      res.body.transaction.type.should.equal(
        constants.transactions.ROSTER_RELEASE
      )
      res.body.transaction.value.should.equal(0)
      res.body.transaction.timestamp.should.equal(Math.round(Date.now() / 1000))

      const rosterRow = await getRoster({ tid: teamId })
      expect(rosterRow.players.length).to.equal(0)

      await checkLastTransaction({
        leagueId,
        type: constants.transactions.ROSTER_RELEASE,
        value: 0,
        pid: player.pid,
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
      MockDate.set(start.subtract('1', 'week').toISOString())
      await league(knex)
    })

    it('not logged in', async () => {
      const request = chai_request.execute(server).post('/api/teams/1/release')
      await notLoggedIn(request)
    })

    it('missing pid', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/release')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId: 1,
          leagueId: 1
        })

      await missing(request, 'pid')
    })

    it('missing teamId', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/release')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          pid: 'x',
          leagueId: 1
        })

      await missing(request, 'teamId')
    })

    it('missing leagueId', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/release')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          pid: 'x',
          teamId: 1
        })

      await missing(request, 'leagueId')
    })

    it('teamId does not belong to userId', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/release')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          pid: 'x',
          leagueId: 1,
          teamId: 1
        })

      await invalid(request, 'teamId')
    })

    it('invalid player - not on team', async () => {
      MockDate.set(start.subtract('1', 'month').toISOString())

      const teamId = 1
      const leagueId = 1
      const player = await selectPlayer()

      const request = chai_request
        .execute(server)
        .post('/api/teams/1/release')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          pid: player.pid,
          teamId,
          leagueId
        })

      await error(request, 'player not on roster')
    })

    it('release player with a poaching claim', async () => {
      MockDate.set(start.add('1', 'month').day(5).toISOString())

      const teamId = 1
      const leagueId = 1
      const userId = 1
      const player = await selectPlayer()
      await addPlayer({
        player,
        leagueId,
        teamId,
        userId,
        slot: constants.slots.PS
      })

      await knex('poaches').insert({
        pid: player.pid,
        userid: 2,
        tid: 2,
        lid: leagueId,
        submitted: Math.round(Date.now() / 1000),
        player_tid: teamId
      })

      const request = chai_request
        .execute(server)
        .post('/api/teams/1/release')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          pid: player.pid,
          teamId,
          leagueId
        })

      await error(request, 'player has a poaching claim')
    })

    it('player is protected', async () => {
      MockDate.set(start.add('1', 'week').toISOString())
      const player = await selectPlayer()
      await addPlayer({
        leagueId: 1,
        player,
        teamId: 1,
        userId: 1,
        slot: constants.slots.PSP
      })
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/release')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          pid: player.pid,
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
