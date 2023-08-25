/* global describe before beforeEach it */
import chai from 'chai'
import chaiHTTP from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import knex from '#db'
import league from '#db/seeds/league.mjs'
import { constants } from '#libs-shared'
import { user1, user2 } from './fixtures/token.mjs'
import {
  addPlayer,
  selectPlayer,
  checkLastTransaction,
  notLoggedIn,
  missing,
  invalid,
  error
} from './utils/index.mjs'

process.env.NODE_ENV = 'test'

chai.should()
chai.use(chaiHTTP)
const expect = chai.expect
const { start } = constants.season

describe('API /teams - activate', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.migrate.forceFreeMigrationsLock()
    await knex.migrate.rollback()
    await knex.migrate.latest()
    await knex.seed.run()
  })

  describe('post', function () {
    before(async function () {
      await league(knex)
    })

    it('drafted player', async () => {
      MockDate.set(start.subtract('1', 'week').toISOString())
      const player = await selectPlayer()
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 2
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player,
        slot: constants.slots.PS,
        transaction: constants.transactions.DRAFT,
        value
      })

      const res = await chai
        .request(server)
        .post('/api/teams/1/activate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          activate_pid: player.pid,
          leagueId
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      res.body.tid.should.equal(teamId)
      res.body.pid.should.equal(player.pid)
      res.body.slot.should.equal(constants.slots.BENCH)
      res.body.transaction.userid.should.equal(userId)
      res.body.transaction.tid.should.equal(teamId)
      res.body.transaction.lid.should.equal(leagueId)
      res.body.transaction.pid.should.equal(player.pid)
      res.body.transaction.type.should.equal(
        constants.transactions.ROSTER_ACTIVATE
      )
      res.body.transaction.value.should.equal(value)
      res.body.transaction.year.should.equal(constants.season.year)
      res.body.transaction.timestamp.should.equal(Math.round(Date.now() / 1000))

      const rosterRows = await knex('rosters_players')
        .where({
          year: constants.season.year,
          week: constants.season.week,
          pid: player.pid
        })
        .limit(1)

      const rosterRow = rosterRows[0]
      expect(rosterRow.slot).to.equal(constants.slots.BENCH)

      await checkLastTransaction({
        leagueId,
        type: constants.transactions.ROSTER_ACTIVATE,
        value,
        year: constants.season.year,
        pid: player.pid,
        teamId,
        userId
      })
    })

    it('added player', async () => {
      // TODO
    })

    it('deactivated player', async () => {
      // TODO
    })
  })

  describe('errors', function () {
    beforeEach(async function () {
      await league(knex)
    })

    it('not logged in', async () => {
      const request = chai.request(server).post('/api/teams/1/activate')
      await notLoggedIn(request)
    })

    it('missing pid', async () => {
      const request = chai
        .request(server)
        .post('/api/teams/1/activate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1
        })

      await missing(request, 'pid')
    })

    it('missing leagueId', async () => {
      const request = chai
        .request(server)
        .post('/api/teams/1/activate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          activate_pid: 'x'
        })

      await missing(request, 'leagueId')
    })

    it('invalid player - does not exist', async () => {
      const request = chai
        .request(server)
        .post('/api/teams/1/activate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          activate_pid: 'x',
          leagueId: 1
        })

      await invalid(request, 'player')
    })

    it('invalid leagueId - does not exist', async () => {
      const request = chai
        .request(server)
        .post('/api/teams/1/activate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          activate_pid: 'x',
          leagueId: 2
        })

      await invalid(request, 'leagueId')
    })

    it('teamId does not belong to userId', async () => {
      const request = chai
        .request(server)
        .post('/api/teams/1/activate')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          activate_pid: 'x',
          leagueId: 1
        })

      await invalid(request, 'teamId')
    })

    it('player not on team', async () => {
      const player = await selectPlayer()
      const request = chai
        .request(server)
        .post('/api/teams/1/activate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          activate_pid: player.pid,
          leagueId: 1
        })

      await invalid(request, 'player')
    })

    it('player not on practice squad', async () => {
      const player = await selectPlayer()
      await addPlayer({ leagueId: 1, player, teamId: 1, userId: 1 })
      const request = chai
        .request(server)
        .post('/api/teams/1/activate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          activate_pid: player.pid,
          leagueId: 1
        })

      await error(request, 'player is on active roster')
    })

    it('player is protected', async () => {
      const player = await selectPlayer()
      await addPlayer({
        leagueId: 1,
        player,
        teamId: 1,
        userId: 1,
        slot: constants.slots.PSP
      })
      const request = chai
        .request(server)
        .post('/api/teams/1/activate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          activate_pid: player.pid,
          leagueId: 1
        })

      await error(request, 'player is protected')
    })

    it('exceed roster limit', async () => {
      // TODO
    })
  })
})
