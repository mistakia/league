/* global describe before it beforeEach */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
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
  missing,
  invalid,
  error,
  notLoggedIn
} from './utils/index.mjs'

process.env.NODE_ENV = 'test'

chai.should()
chai.use(chai_http)
const expect = chai.expect
const { regular_season_start } = constants.season

describe('API /teams - add', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  describe('post', async function () {
    beforeEach(async function () {
      MockDate.set(regular_season_start.subtract('2', 'month').toISOString())
      await league(knex)
    })

    it('free agent - active roster - season', async () => {
      MockDate.set(regular_season_start.add('2', 'week').day(4).toISOString())
      const player = await selectPlayer()

      const teamId = 1
      const leagueId = 1
      const userId = 1
      const res = await chai_request
        .execute(server)
        .post('/api/teams/1/add')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          pid: player.pid,
          leagueId,
          slot: constants.slots.BENCH
        })

      res.should.have.status(200)

      res.should.be.json

      res.body.length.should.equal(1)
      res.body[0].pid.should.equal(player.pid)
      res.body[0].slot.should.equal(constants.slots.BENCH)

      res.body[0].rid.should.exist
      res.body[0].pos.should.equal(player.pos1)
      res.body[0].transaction.userid.should.equal(userId)
      res.body[0].transaction.tid.should.equal(teamId)
      res.body[0].transaction.lid.should.equal(leagueId)
      res.body[0].transaction.pid.should.equal(player.pid)
      res.body[0].transaction.type.should.equal(
        constants.transactions.ROSTER_ADD
      )
      res.body[0].transaction.value.should.equal(0)
      res.body[0].transaction.year.should.equal(constants.season.year)

      const rosters = await knex('rosters_players').where({
        pid: player.pid,
        tid: teamId,
        week: constants.season.week,
        year: constants.season.year
      })

      expect(rosters.length).to.equal(1)
      expect(rosters[0].slot).to.equal(constants.slots.BENCH)
      expect(rosters[0].pid).to.equal(player.pid)
      expect(rosters[0].pos).to.equal(player.pos1)
      expect(rosters[0].tid).to.equal(teamId)
      expect(rosters[0].lid).to.equal(leagueId)
      expect(rosters[0].week).to.equal(constants.season.week)
      expect(rosters[0].year).to.equal(constants.season.year)

      await checkLastTransaction({
        leagueId,
        type: constants.transactions.ROSTER_ADD,
        value: 0,
        year: constants.season.year,
        pid: player.pid,
        teamId,
        userId
      })
    })

    it('rookie free agent - practice squad - offseason', async () => {
      const leagueId = 1
      await knex('seasons')
        .update({
          draft_start: regular_season_start.subtract('1', 'week').unix()
        })
        .where({ lid: leagueId })
      MockDate.set(regular_season_start.subtract('4', 'days').toISOString())
      const player = await selectPlayer({ rookie: true })

      const teamId = 1
      const userId = 1
      const res = await chai_request
        .execute(server)
        .post('/api/teams/1/add')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          pid: player.pid,
          leagueId,
          slot: constants.slots.PS
        })

      res.should.have.status(200)

      res.should.be.json

      res.body.length.should.equal(1)
      res.body[0].pid.should.equal(player.pid)
      res.body[0].slot.should.equal(constants.slots.PS)

      res.body[0].rid.should.exist
      res.body[0].pos.should.equal(player.pos1)
      res.body[0].transaction.userid.should.equal(userId)
      res.body[0].transaction.tid.should.equal(teamId)
      res.body[0].transaction.lid.should.equal(leagueId)
      res.body[0].transaction.pid.should.equal(player.pid)
      res.body[0].transaction.type.should.equal(
        constants.transactions.PRACTICE_ADD
      )
      res.body[0].transaction.value.should.equal(0)
      res.body[0].transaction.year.should.equal(constants.season.year)

      const rosters = await knex('rosters_players').where({
        pid: player.pid,
        tid: teamId,
        week: constants.season.week,
        year: constants.season.year
      })

      expect(rosters.length).to.equal(1)
      expect(rosters[0].slot).to.equal(constants.slots.PS)
      expect(rosters[0].pid).to.equal(player.pid)
      expect(rosters[0].pos).to.equal(player.pos1)
      expect(rosters[0].tid).to.equal(teamId)
      expect(rosters[0].lid).to.equal(leagueId)
      expect(rosters[0].week).to.equal(constants.season.week)
      expect(rosters[0].year).to.equal(constants.season.year)

      await checkLastTransaction({
        leagueId,
        type: constants.transactions.PRACTICE_ADD,
        value: 0,
        year: constants.season.year,
        pid: player.pid,
        teamId,
        userId
      })
    })
  })

  describe('error', function () {
    beforeEach(async function () {
      MockDate.set(regular_season_start.subtract('2', 'month').toISOString())
      await league(knex)
    })

    it('not logged in', async () => {
      const request = chai_request.execute(server).post('/api/teams/1/add')
      await notLoggedIn(request)
    })

    it('missing pid', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/add')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId: 1,
          leagueId: 1,
          slot: constants.slots.PS
        })

      await missing(request, 'pid')
    })

    it('missing leagueId', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/add')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId: 1,
          pid: 'x',
          slot: constants.slots.PS
        })

      await missing(request, 'leagueId')
    })

    it('missing slot', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/add')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId: 1,
          leagueId: 1,
          pid: 'x'
        })

      await missing(request, 'slot')
    })

    it('missing teamId', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/add')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          pid: 'x',
          leagueId: 1,
          slot: constants.slots.PS
        })

      await missing(request, 'teamId')
    })

    it('invalid slot', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/add')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId: 1,
          leagueId: 1,
          pid: 'x',
          slot: 'x'
        })

      await invalid(request, 'slot')
    })

    it('teamId does not belong to userId', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/add')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          teamId: 1,
          pid: 'x',
          leagueId: 1,
          slot: constants.slots.PS
        })

      await invalid(request, 'teamId')
    })

    it('player is not free agent', async () => {
      const player = await selectPlayer()
      await addPlayer({ leagueId: 1, player, teamId: 2, userId: 2 })

      const request = chai_request
        .execute(server)
        .post('/api/teams/1/add')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId: 1,
          pid: player.pid,
          leagueId: 1,
          slot: constants.slots.BENCH
        })

      await error(request, 'player is not a free agent')
    })

    it('add veteran free agent to active roster - offseason', async () => {
      MockDate.set(regular_season_start.subtract('1', 'week').toISOString())
      const player = await selectPlayer({ rookie: false })
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/add')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId: 1,
          pid: player.pid,
          leagueId: 1,
          slot: constants.slots.BENCH
        })

      await error(request, 'veteran free agency not open')
    })

    it('free agent locked', async () => {
      // TODO
    })

    it('free agent has unprocessed waiver claim', async () => {
      MockDate.set(
        regular_season_start.add('2', 'week').day(3).hour(15).toISOString()
      )
      const player = await selectPlayer({ rookie: false })

      await knex('waivers').insert({
        userid: 2,
        pid: player.pid,
        tid: 2,
        lid: 1,
        submitted: Math.round(Date.now() / 1000),
        po: 9999,
        type: constants.waivers.FREE_AGENCY
      })

      const request = chai_request
        .execute(server)
        .post('/api/teams/1/add')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId: 1,
          pid: player.pid,
          leagueId: 1,
          slot: constants.slots.BENCH
        })

      await error(request, 'player has pending waiver claim')
    })

    it('exceeded roster limit', async () => {
      // TODO
    })

    it('reserve player violation', async () => {
      const reservePlayer = await selectPlayer({
        nfl_status: constants.player_nfl_status.ACTIVE
      })
      const teamId = 1
      const leagueId = 1
      await addPlayer({
        leagueId,
        player: reservePlayer,
        teamId,
        slot: constants.slots.IR,
        userId: 1
      })

      const player = await selectPlayer()
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/add')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId: 1,
          pid: player.pid,
          leagueId: 1,
          slot: constants.slots.BENCH
        })

      await error(request, 'Reserve player violation')
    })

    it('player has outstanding practice waiver claim', async () => {
      // TODO
    })

    it('player has outstanding active roster waiver claim', async () => {
      // TODO
    })

    it('release protected practice squad player', async () => {
      // TODO
    })

    it('rookie free agent - before rookie draft has concluded', async () => {
      // TODO
    })

    it('exceeds roster limit - practice squad - preseason', async () => {
      // TODO
    })

    it('free agent on waivers - released within 24 hrs', async () => {
      // TODO
    })

    it('free agent on waivers - waiver period', async () => {
      // TODO
    })
  })
})
