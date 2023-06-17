/* global describe before it */
import chai from 'chai'
import chaiHTTP from 'chai-http'

import server from '#api'
import knex from '#db'

import league from '#db/seeds/league.mjs'
import { constants } from '#libs-shared'
import { user1, user2 } from './fixtures/token.mjs'
import {
  addPlayer,
  selectPlayer,
  notLoggedIn,
  missing,
  invalid,
  error
} from './utils/index.mjs'

process.env.NODE_ENV = 'test'

chai.should()
chai.use(chaiHTTP)

describe('API /teams - protect', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.migrate.forceFreeMigrationsLock()
    await knex.migrate.rollback()
    await knex.migrate.latest()
    await knex.seed.run()
  })

  describe('post', function () {
    before(async function () {
      this.timeout(60 * 1000)
      await league(knex)
    })

    it('rookie practice squad player', async () => {
      // TODO
    })

    it('veteran free agent practice squad player', async () => {
      // TODO
    })
  })

  describe('errors', function () {
    it('not logged in', async () => {
      const request = chai.request(server).post('/api/teams/1/protect')
      await notLoggedIn(request)
    })

    it('missing pid', async () => {
      const request = chai
        .request(server)
        .post('/api/teams/1/protect')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1
        })

      await missing(request, 'pid')
    })

    it('missing leagueId', async () => {
      const request = chai
        .request(server)
        .post('/api/teams/1/protect')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          pid: 'x'
        })

      await missing(request, 'leagueId')
    })

    it('teamId does not belong to userId', async () => {
      const request = chai
        .request(server)
        .post('/api/teams/1/protect')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          leagueId: 1,
          pid: 'x'
        })

      await invalid(request, 'teamId')
    })

    it('player not on team', async () => {
      const player = await selectPlayer()
      const request = chai
        .request(server)
        .post('/api/teams/1/protect')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          pid: player.pid
        })

      await invalid(request, 'player')
    })

    it('player already protected on practice squad', async () => {
      const player = await selectPlayer({ rookie: true })
      await addPlayer({
        leagueId: 1,
        player,
        teamId: 1,
        userId: 1,
        slot: constants.slots.PSP
      })
      const request = chai
        .request(server)
        .post('/api/teams/1/protect')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          pid: player.pid,
          leagueId: 1
        })

      await error(request, 'player is already protected')
    })

    it('player has a poaching claim', async () => {
      // TODO
    })

    it('during the off-season', async () => {
      // TODO
    })
  })
})
