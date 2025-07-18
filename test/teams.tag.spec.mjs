/* global describe before it */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'

import server from '#api'
import knex from '#db'
import league from '#db/seeds/league.mjs'
import { getRoster } from '#libs-server'
import { constants } from '#libs-shared'
import { user1, user2 } from './fixtures/token.mjs'
import {
  selectPlayer,
  addPlayer,
  notLoggedIn,
  missing,
  invalid,
  error
} from './utils/index.mjs'

process.env.NODE_ENV = 'test'

chai.should()
chai.use(chai_http)
// const expect = chai.expect

describe('API /teams - tag', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  describe('post', function () {
    before(async function () {
      await league(knex)
    })

    it('active roster - offseason', async () => {
      // TODO
    })

    it('active roster - season', async () => {
      // TODO
    })

    it('franchise tag', async () => {
      // TODO
    })

    it('rookie tag', async () => {
      // TODO
    })

    it('cancel existing restricted free agency bid', async () => {
      // TODO
    })
  })

  describe('errors', function () {
    const exclude_pids = []

    it('not logged in', async () => {
      const request = chai_request.execute(server).post('/api/teams/1/tag')
      await notLoggedIn(request)
    })

    it('missing tag', async () => {
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const player = await selectPlayer()
      exclude_pids.push(player.pid)
      await addPlayer({
        player,
        leagueId,
        teamId,
        userId,
        slot: constants.slots.BENCH
      })

      const request = chai_request
        .execute(server)
        .post('/api/teams/1/tag')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          pid: player.pid
        })

      await missing(request, 'tag')
    })

    it('missing pid', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/tag')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          tag: constants.tags.REGULAR,
          leagueId: 1
        })

      await missing(request, 'pid')
    })

    it('missing leagueId', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/tag')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          tag: constants.tags.REGULAR,
          pid: 'x'
        })

      await missing(request, 'leagueId')
    })

    it('invalid player - does not exist', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/tag')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          tag: constants.tags.REGULAR,
          pid: 'x',
          leagueId: 1
        })

      await invalid(request, 'player')
    })

    it('invalid tag - does not exist', async () => {
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const player = await selectPlayer({ exclude_pids })
      await addPlayer({
        player,
        leagueId,
        teamId,
        userId,
        slot: constants.slots.BENCH
      })

      const request = chai_request
        .execute(server)
        .post('/api/teams/1/tag')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          tag: 'x',
          pid: player.pid,
          leagueId: 1
        })

      await invalid(request, 'tag')
    })

    it('invalid leagueId - does not exist', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/tag')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          tag: constants.tags.REGULAR,
          pid: 'x',
          leagueId: 2
        })

      await invalid(request, 'leagueId')
    })

    it('teamId does not belong to userId', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/tag')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          tag: constants.tags.REGULAR,
          pid: 'x',
          leagueId: 1
        })

      await invalid(request, 'teamId')
    })

    it('player not on team', async () => {
      const roster = await getRoster({ tid: 1 })
      const rostered_pids = roster.players.map((p) => p.pid)
      const player = await selectPlayer({
        exclude_pids: [...rostered_pids, ...exclude_pids]
      })
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/tag')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          tag: constants.tags.REGULAR,
          pid: player.pid,
          leagueId: 1
        })

      await invalid(request, 'player')
    })

    it('offseason & tag deadline passed', async () => {
      // TODO
    })

    it('reserve violation', async () => {
      // TODO
    })

    it('exceeds consecutive franchise tag limit', async () => {
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const current_year = constants.season.year

      // Select a player that is not yet on the roster
      const player = await selectPlayer({ exclude_pids })
      exclude_pids.push(player.pid)

      // Add player to the team
      await addPlayer({
        player,
        leagueId,
        teamId,
        userId,
        slot: constants.slots.BENCH
      })

      // Insert franchise tag transactions for the two previous years
      const two_years_ago = current_year - 2
      const one_year_ago = current_year - 1

      // Add franchise tag transaction from two years ago
      await knex('transactions').insert({
        userid: userId,
        tid: teamId,
        lid: leagueId,
        pid: player.pid,
        type: constants.transactions.FRANCHISE_TAG,
        value: 0,
        week: 0,
        year: two_years_ago,
        timestamp: Math.round(Date.now() / 1000) - 63072000 // Approx 2 years ago
      })

      // Add franchise tag transaction from one year ago
      await knex('transactions').insert({
        userid: userId,
        tid: teamId,
        lid: leagueId,
        pid: player.pid,
        type: constants.transactions.FRANCHISE_TAG,
        value: 0,
        week: 0,
        year: one_year_ago,
        timestamp: Math.round(Date.now() / 1000) - 31536000 // Approx 1 year ago
      })

      // Attempt to add a franchise tag for the current year
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/tag')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          tag: constants.tags.FRANCHISE,
          pid: player.pid,
          leagueId
        })

      // Expect an error stating player cannot be franchise tagged three years in a row
      await error(
        request,
        'player cannot be franchise tagged for three consecutive years'
      )
    })
  })
})
