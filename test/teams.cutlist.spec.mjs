/* global describe before beforeEach it */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import knex from '#db'
import league from '#db/seeds/league.mjs'
import { constants } from '#libs-shared'
import { user1, user2 } from './fixtures/token.mjs'
import {
  selectPlayer,
  addPlayer,
  notLoggedIn,
  missing,
  invalid
} from './utils/index.mjs'

process.env.NODE_ENV = 'test'

chai.should()
chai.use(chai_http)
const expect = chai.expect
const { regular_season_start } = constants.season

describe('API /teams - cutlist', function () {
  before(async function () {
    this.timeout(60 * 1000)

    MockDate.set(regular_season_start.subtract('1', 'month').toISOString())

    await knex.seed.run()
  })

  describe('post', function () {
    beforeEach(async function () {
      await league(knex)
    })

    it('one player', async () => {
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
        .post('/api/teams/1/cutlist')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          pids: player.pid
        })

      res.should.have.status(200)

      res.should.be.json

      res.body.length.should.equal(1)
      res.body[0].should.equal(player.pid)

      const players = await knex('league_cutlist').orderBy('order', 'asc')
      expect(players.length).to.equal(1)
      expect(players[0].pid).to.equal(player.pid)
      expect(players[0].tid).to.equal(teamId)
      expect(players[0].order).to.equal(0)
    })

    it('multiple player', async () => {
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const player1 = await selectPlayer()
      await addPlayer({
        player: player1,
        leagueId,
        teamId,
        userId,
        slot: constants.slots.BENCH
      })

      const player2 = await selectPlayer({ exclude_pids: [player1.pid] })
      await addPlayer({
        player: player2,
        leagueId,
        teamId,
        userId,
        slot: constants.slots.BENCH
      })

      const pids = [player1.pid, player2.pid]
      const res = await chai_request
        .execute(server)
        .post('/api/teams/1/cutlist')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          pids
        })

      res.should.have.status(200)

      res.should.be.json

      res.body.length.should.equal(2)
      res.body.should.deep.equal(pids)

      const cutlist = await knex('league_cutlist').orderBy('order', 'asc')
      expect(cutlist.length).to.equal(2)
      expect(cutlist[0].pid).to.equal(player1.pid)
      expect(cutlist[0].tid).to.equal(teamId)
      expect(cutlist[0].order).to.equal(0)
      expect(cutlist[1].pid).to.equal(player2.pid)
      expect(cutlist[1].tid).to.equal(teamId)
      expect(cutlist[1].order).to.equal(1)
    })

    it('update', async () => {
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const player1 = await selectPlayer()
      await addPlayer({
        player: player1,
        leagueId,
        teamId,
        userId,
        slot: constants.slots.BENCH
      })

      const player2 = await selectPlayer({ exclude_pids: [player1.pid] })
      await addPlayer({
        player: player2,
        leagueId,
        teamId,
        userId,
        slot: constants.slots.BENCH
      })

      const res1 = await chai_request
        .execute(server)
        .post('/api/teams/1/cutlist')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          pids: [player2.pid, player1.pid]
        })

      res1.should.have.status(200)

      res1.should.be.json

      const pids = [player1.pid, player2.pid]
      const res2 = await chai_request
        .execute(server)
        .post('/api/teams/1/cutlist')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          pids
        })

      res2.body.length.should.equal(2)
      res2.body.should.deep.equal(pids)

      const cutlist = await knex('league_cutlist').orderBy('order', 'asc')
      expect(cutlist.length).to.equal(2)
      expect(cutlist[0].order).to.equal(0)
      expect(cutlist[0].pid).to.equal(player1.pid)
      expect(cutlist[0].tid).to.equal(teamId)
      expect(cutlist[1].order).to.equal(1)
      expect(cutlist[1].pid).to.equal(player2.pid)
      expect(cutlist[1].tid).to.equal(teamId)
    })

    it('delete', async () => {
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const player1 = await selectPlayer()
      await addPlayer({
        player: player1,
        leagueId,
        teamId,
        userId,
        slot: constants.slots.BENCH
      })

      const player2 = await selectPlayer({ exclude_pids: [player1.pid] })
      await addPlayer({
        player: player2,
        leagueId,
        teamId,
        userId,
        slot: constants.slots.BENCH
      })

      const res1 = await chai_request
        .execute(server)
        .post('/api/teams/1/cutlist')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          pids: [player2.pid, player1.pid]
        })

      res1.should.have.status(200)

      res1.should.be.json

      const res2 = await chai_request
        .execute(server)
        .post('/api/teams/1/cutlist')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          pids: []
        })

      res2.body.length.should.equal(0)

      const cutlist = await knex('league_cutlist')
      expect(cutlist.length).to.equal(0)
    })
  })

  describe('errors', function () {
    beforeEach(async function () {
      await league(knex)
    })

    it('not logged in', async () => {
      const request = chai_request.execute(server).post('/api/teams/1/cutlist')
      await notLoggedIn(request)
    })

    it('missing pids', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/cutlist')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1
        })

      await missing(request, 'pids')
    })

    it('missing leagueId', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/cutlist')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          pids: 'x'
        })

      await missing(request, 'leagueId')
    })

    it('invalid player - does not exist', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/cutlist')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          pids: 'x',
          leagueId: 1
        })

      await invalid(request, 'player')
    })

    it('invalid player - player is restricted free agent', async () => {
      // TODO
    })

    it('invalid leagueId - does not exist', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/cutlist')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          pids: 'x',
          leagueId: 2
        })

      await invalid(request, 'leagueId')
    })

    it('teamId does not belong to userId', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/cutlist')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          pids: 'x',
          leagueId: 1
        })

      await invalid(request, 'teamId')
    })

    it('player not on team', async () => {
      const player = await selectPlayer()
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/cutlist')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          pids: player.pid,
          leagueId: 1
        })

      await invalid(request, 'player')
    })
  })
})
