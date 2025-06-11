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
  notLoggedIn
} from './utils/index.mjs'

process.env.NODE_ENV = 'test'
const { start } = constants.season
chai.should()
chai.use(chai_http)
const expect = chai.expect

describe('API /leagues/rosters - delete', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  describe('delete', function () {
    beforeEach(async function () {
      MockDate.set(start.subtract('2', 'month').toISOString())
      await league(knex)
    })

    it('remove player to roster', async () => {
      const leagueId = 1
      const teamId = 2
      const player = await selectPlayer()
      await addPlayer({
        leagueId,
        teamId,
        player,
        userId: 1
      })

      const res = await chai_request
        .execute(server)
        .delete('/api/leagues/1/rosters')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          pid: player.pid,
          teamId,
          leagueId
        })

      res.should.have.status(200)

      res.should.be.json

      res.body.roster.should.equal(1)
      res.body.transaction.should.equal(1)

      const rosterRow = await getRoster({ tid: 2 })

      expect(rosterRow.players.length).to.equal(0)
    })
  })

  describe('errors', function () {
    beforeEach(async function () {
      MockDate.set(start.subtract('2', 'month').toISOString())
      await league(knex)
    })

    it('not logged in', async () => {
      const request = chai_request
        .execute(server)
        .delete('/api/leagues/1/rosters')
      await notLoggedIn(request)
    })

    it('missing pid', async () => {
      const request = chai_request
        .execute(server)
        .delete('/api/leagues/1/rosters')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          teamId: 1
        })

      await missing(request, 'pid')
    })

    it('missing teamId', async () => {
      const request = chai_request
        .execute(server)
        .delete('/api/leagues/1/rosters')
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
        .delete('/api/leagues/1/rosters')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          pid: 'x',
          teamId: 1
        })

      await missing(request, 'leagueId')
    })

    it('invalid leagueId', async () => {
      const player = await selectPlayer()
      const request = chai_request
        .execute(server)
        .delete('/api/leagues/2/rosters')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId: 1,
          pid: player.pid,
          leagueId: 2
        })

      await invalid(request, 'leagueId')
    })

    it('invalid player - does not exist', async () => {
      const request = chai_request
        .execute(server)
        .delete('/api/leagues/2/rosters')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          pid: 'x',
          teamId: 1,
          leagueId: 1
        })

      await invalid(request, 'player')
    })

    it('user is not commish', async () => {
      const player = await selectPlayer()
      const request = chai_request
        .execute(server)
        .delete('/api/leagues/1/rosters')
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
