/* global describe before it beforeEach */
import * as chai from 'chai'
import { default as chai_http, request as chai_request } from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import knex from '#db'
import league from '#db/seeds/league.mjs'
import { constants } from '#libs-shared'
import { user1, user2 } from './fixtures/token.mjs'
import { getRoster } from '#libs-server'
import { selectPlayer, missing, invalid, notLoggedIn } from './utils/index.mjs'

process.env.NODE_ENV = 'test'
chai.should()
chai.use(chai_http)
const expect = chai.expect
const { start } = constants.season

describe('API /leagues/rosters - add', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  describe('post', function () {
    beforeEach(async function () {
      MockDate.set(start.subtract('2', 'month').toISOString())
      await league(knex)
    })

    it('add player to roster', async () => {
      const player = await selectPlayer()
      const leagueId = 1
      const teamId = 2
      const value = 10
      const res = await chai_request.execute(server)
        .post('/api/leagues/1/rosters')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          pid: player.pid,
          teamId,
          leagueId,
          value
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      res.body.pid.should.equal(player.pid)
      res.body.pos.should.equal(player.pos1)
      res.body.slot.should.equal(constants.slots.BENCH)
      res.body.transaction.userid.should.equal(1)
      res.body.transaction.tid.should.equal(teamId)
      res.body.transaction.lid.should.equal(leagueId)
      res.body.transaction.type.should.equal(constants.transactions.ROSTER_ADD)
      res.body.transaction.value.should.equal(value)

      const rosterRow = await getRoster({ tid: 2 })
      expect(rosterRow.tid).to.equal(teamId)
      expect(rosterRow.lid).to.equal(leagueId)
      expect(rosterRow.players.length).to.equal(1)
      expect(rosterRow.players[0].slot).to.equal(constants.slots.BENCH)
      expect(rosterRow.players[0].pid).to.equal(player.pid)
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
      MockDate.set(start.subtract('2', 'month').toISOString())
      await league(knex)
    })

    it('not logged in', async () => {
      const request = chai_request.execute(server).post('/api/leagues/1/rosters')
      await notLoggedIn(request)
    })

    it('missing pid', async () => {
      const request = chai_request.execute(server)
        .post('/api/leagues/1/rosters')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          teamId: 1
        })

      await missing(request, 'pid')
    })

    it('missing teamId', async () => {
      const request = chai_request.execute(server)
        .post('/api/leagues/1/rosters')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          pid: 'x',
          leagueId: 1
        })

      await missing(request, 'teamId')
    })

    it('missing leagueId', async () => {
      const request = chai_request.execute(server)
        .post('/api/leagues/1/rosters')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          pid: 'x',
          teamId: 1
        })

      await missing(request, 'leagueId')
    })

    it('invalid leagueId', async () => {
      const player = await selectPlayer()
      const request = chai_request.execute(server)
        .post('/api/leagues/2/rosters')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId: 1,
          pid: player.pid,
          leagueId: 2
        })

      await invalid(request, 'leagueId')
    })

    it('invalid player - does not exist', async () => {
      const request = chai_request.execute(server)
        .post('/api/leagues/2/rosters')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          pid: 'x',
          teamId: 1,
          leagueId: 1
        })

      await invalid(request, 'player')
    })

    it('invalid value', async () => {
      const player = await selectPlayer()
      const request = chai_request.execute(server)
        .post('/api/leagues/2/rosters')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          pid: player.pid,
          teamId: 1,
          leagueId: 1,
          value: 'x'
        })

      await invalid(request, 'value')
    })

    it('user is not commish', async () => {
      const player = await selectPlayer()
      const request = chai_request.execute(server)
        .post('/api/leagues/1/rosters')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          pid: player.pid,
          teamId: 1,
          leagueId: 1
        })

      await invalid(request, 'leagueId')
    })

    it('exceeds roster limit', async () => {
      // TODO
    })

    it('exceeds roster cap', async () => {
      // TODO
    })
  })
})
