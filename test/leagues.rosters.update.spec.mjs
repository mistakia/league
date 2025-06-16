/* global describe before it beforeEach */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import knex from '#db'

import league from '#db/seeds/league.mjs'
import { constants } from '#libs-shared'
import { user1, user2 } from './fixtures/token.mjs'
import { getRoster } from '#libs-server'
import {
  addPlayer,
  selectPlayer,
  missing,
  invalid,
  error,
  notLoggedIn
} from './utils/index.mjs'

process.env.NODE_ENV = 'test'
const { regular_season_start } = constants.season
chai.should()
chai.use(chai_http)
const expect = chai.expect

describe('API /leagues/rosters - update', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  describe('put', function () {
    beforeEach(async function () {
      MockDate.set(regular_season_start.subtract('2', 'month').toISOString())
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
      const res = await chai_request
        .execute(server)
        .put('/api/leagues/1/rosters')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          pid: player.pid,
          teamId,
          leagueId,
          value
        })

      res.should.have.status(200)

      res.should.be.json

      res.body.value.should.equal(value)

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
      MockDate.set(regular_season_start.subtract('2', 'month').toISOString())
      await league(knex)
    })

    it('not logged in', async () => {
      const request = chai_request.execute(server).put('/api/leagues/1/rosters')
      await notLoggedIn(request)
    })

    it('missing pid', async () => {
      const request = chai_request
        .execute(server)
        .put('/api/leagues/1/rosters')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          value: 2,
          teamId: 1
        })

      await missing(request, 'pid')
    })

    it('missing teamId', async () => {
      const request = chai_request
        .execute(server)
        .put('/api/leagues/1/rosters')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          pid: 'x',
          value: 2,
          leagueId: 1
        })

      await missing(request, 'teamId')
    })

    it('missing leagueId', async () => {
      const request = chai_request
        .execute(server)
        .put('/api/leagues/1/rosters')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          pid: 'x',
          value: 2,
          teamId: 1
        })

      await missing(request, 'leagueId')
    })

    it('missing value', async () => {
      const request = chai_request
        .execute(server)
        .put('/api/leagues/1/rosters')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          pid: 'x',
          teamId: 1
        })

      await missing(request, 'value')
    })

    it('invalid leagueId', async () => {
      const player = await selectPlayer()
      const request = chai_request
        .execute(server)
        .put('/api/leagues/2/rosters')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId: 1,
          value: 2,
          pid: player.pid,
          leagueId: 2
        })

      await invalid(request, 'leagueId')
    })

    it('invalid player - does not exist', async () => {
      const request = chai_request
        .execute(server)
        .put('/api/leagues/2/rosters')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          pid: 'x',
          value: 2,
          teamId: 1,
          leagueId: 1
        })

      await invalid(request, 'player')
    })

    it('user is not commish', async () => {
      const player = await selectPlayer()
      const request = chai_request
        .execute(server)
        .put('/api/leagues/1/rosters')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          pid: player.pid,
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
      const request = chai_request
        .execute(server)
        .put('/api/leagues/1/rosters')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          pid: player.pid,
          teamId,
          leagueId,
          value
        })

      await error(request, 'exceeds cap space')
    })
  })
})
