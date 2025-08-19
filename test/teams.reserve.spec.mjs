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
  notLoggedIn,
  missing,
  invalid,
  error,
  fillRoster
} from './utils/index.mjs'

process.env.NODE_ENV = 'test'

chai.should()
chai.use(chai_http)
const expect = chai.expect
const { regular_season_start } = constants.season

describe('API /teams - reserve', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  describe('post', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      await league(knex)
    })

    it('move player to reserve - ir', async () => {
      MockDate.set(regular_season_start.subtract('1', 'week').toISOString())
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
        slot: constants.slots.BENCH,
        transaction: constants.transactions.DRAFT,
        value
      })

      await knex('player')
        .update({
          nfl_status: constants.player_nfl_status.INJURED_RESERVE
        })
        .where({
          pid: player.pid
        })

      const res = await chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          reserve_pid: player.pid,
          leagueId,
          slot: constants.slots.IR
        })

      res.should.have.status(200)

      res.should.be.json

      res.body.tid.should.equal(teamId)
      res.body.pid.should.equal(player.pid)
      res.body.slot.should.equal(constants.slots.IR)
      res.body.transaction.userid.should.equal(userId)
      res.body.transaction.tid.should.equal(teamId)
      res.body.transaction.lid.should.equal(leagueId)
      res.body.transaction.pid.should.equal(player.pid)
      res.body.transaction.type.should.equal(constants.transactions.RESERVE_IR)
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
      expect(rosterRow.slot).to.equal(constants.slots.IR)

      await checkLastTransaction({
        leagueId,
        type: constants.transactions.RESERVE_IR,
        value,
        year: constants.season.year,
        pid: player.pid,
        teamId,
        userId
      })
    })

    it('move player from reserve/ir to reserve/cov', async () => {
      // TODO
    })

    // move player to reserve/cov with full reserve slots
  })

  describe('errors', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      await league(knex)
    })

    it('not logged in', async () => {
      const request = chai_request.execute(server).post('/api/teams/1/reserve')
      await notLoggedIn(request)
    })

    it('missing reserve_pid', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          slot: constants.slots.IR
        })

      await missing(request, 'reserve_pid')
    })

    it('missing leagueId', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          reserve_pid: 'x',
          slot: constants.slots.IR
        })

      await missing(request, 'leagueId')
    })

    it('missing slot', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          reserve_pid: 'x'
        })

      await missing(request, 'slot')
    })

    it('invalid slot', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          reserve_pid: 'x',
          slot: 'x'
        })

      await invalid(request, 'slot')
    })

    it('invalid player - non-existant', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          reserve_pid: 'x',
          slot: constants.slots.IR
        })

      await invalid(request, 'player')
    })

    it('invalid player - not on active roster', async () => {
      const player = await selectPlayer()
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          reserve_pid: player.pid,
          slot: constants.slots.IR
        })

      await error(request, 'player not on roster')
    })

    it('teamId does not belong to userId', async () => {
      const player = await selectPlayer()
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          leagueId: 1,
          reserve_pid: player.pid,
          slot: constants.slots.IR
        })

      await invalid(request, 'teamId')
    })

    it('player already on reserve/ir', async () => {
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
        slot: constants.slots.IR,
        transaction: constants.transactions.DRAFT,
        value
      })
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          reserve_pid: player.pid,
          slot: constants.slots.IR
        })

      await error(request, 'player already on reserve')
    })

    it('player already on reserve/cov', async () => {
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
        slot: constants.slots.COV,
        transaction: constants.transactions.DRAFT,
        value
      })
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          reserve_pid: player.pid,
          slot: constants.slots.COV
        })

      await error(request, 'player already on reserve')
    })

    it('player not on reserve/ir', async () => {
      MockDate.set(regular_season_start.add('1', 'week').toISOString())
      const player = await selectPlayer({
        injury_status: null,
        nfl_status: constants.player_nfl_status.ACTIVE
      })
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 2
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player,
        slot: constants.slots.BENCH,
        transaction: constants.transactions.DRAFT,
        value
      })
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          reserve_pid: player.pid,
          slot: constants.slots.IR
        })

      await error(request, 'player not eligible for Reserve')
    })

    it('player not on reserve/cov - no status', async () => {
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
        slot: constants.slots.BENCH,
        transaction: constants.transactions.DRAFT,
        value
      })
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          reserve_pid: player.pid,
          slot: constants.slots.COV
        })

      await error(request, 'player not eligible for Reserve/COV')
    })

    it('player not on reserve/cov - ir', async () => {
      MockDate.set(regular_season_start.add('1', 'week').toISOString())
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
        slot: constants.slots.BENCH,
        transaction: constants.transactions.DRAFT,
        value
      })
      await knex('player')
        .update({
          nfl_status: constants.player_nfl_status.INJURED_RESERVE
        })
        .where({
          pid: player.pid
        })
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          reserve_pid: player.pid,
          slot: constants.slots.COV
        })

      await error(request, 'player not eligible for Reserve/COV')
    })

    it('exceeds ir roster limits', async () => {
      MockDate.set(regular_season_start.subtract('1', 'week').toISOString())
      const teamId = 1
      const leagueId = 1
      await fillRoster({ leagueId, teamId })

      const players = await knex('rosters_players')
        .where({
          lid: leagueId,
          tid: teamId,
          week: constants.season.week,
          year: constants.season.year
        })
        .whereNot('slot', constants.slots.IR)
        .limit(1)

      const pid = players[0].pid
      await knex('player')
        .update({
          nfl_status: constants.player_nfl_status.INJURED_RESERVE
        })
        .where({
          pid
        })
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          reserve_pid: pid,
          slot: constants.slots.IR
        })

      await error(request, 'exceeds roster limits')
    })

    it('player is a locked starter', async () => {
      // TODO
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
      await knex('player')
        .update({
          nfl_status: constants.player_nfl_status.INJURED_RESERVE
        })
        .where({
          pid: player.pid
        })
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          reserve_pid: player.pid,
          slot: constants.slots.IR,
          leagueId: 1
        })

      await error(request, 'protected players are not reserve eligible')
    })

    it('player not rostered on previous week roster', async () => {
      MockDate.set(regular_season_start.add('2', 'week').toISOString())
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
        slot: constants.slots.BENCH,
        transaction: constants.transactions.ROSTER_ADD,
        value
      })

      await knex('player')
        .update({
          nfl_status: constants.player_nfl_status.INJURED_RESERVE
        })
        .where({
          pid: player.pid
        })

      const request = chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          reserve_pid: player.pid,
          leagueId,
          slot: constants.slots.IR
        })

      await error(request, 'not eligible, not rostered long enough')
    })

    it('practice squad player without active poaching claim', async () => {
      const player = await selectPlayer()
      await addPlayer({
        leagueId: 1,
        player,
        teamId: 1,
        userId: 1,
        slot: constants.slots.PS
      })
      await knex('player')
        .update({
          nfl_status: constants.player_nfl_status.INJURED_RESERVE
        })
        .where({
          pid: player.pid
        })

      const request = chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          reserve_pid: player.pid,
          slot: constants.slots.IR,
          leagueId: 1
        })

      await error(
        request,
        'practice squad players can only be placed on reserve if they have an active poaching claim'
      )
    })

    it('practice squad drafted player without active poaching claim', async () => {
      const player = await selectPlayer()
      await addPlayer({
        leagueId: 1,
        player,
        teamId: 1,
        userId: 1,
        slot: constants.slots.PSD
      })
      await knex('player')
        .update({
          nfl_status: constants.player_nfl_status.INJURED_RESERVE
        })
        .where({
          pid: player.pid
        })

      const request = chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          reserve_pid: player.pid,
          slot: constants.slots.IR,
          leagueId: 1
        })

      await error(
        request,
        'practice squad players can only be placed on reserve if they have an active poaching claim'
      )
    })
  })

  describe('practice squad with active poach', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      await league(knex)
    })

    it('practice squad player with active poaching claim can be reserved', async () => {
      MockDate.set(regular_season_start.subtract('1', 'week').toISOString())
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

      // Create active poaching claim
      await knex('poaches').insert({
        userid: 2,
        tid: 2,
        lid: leagueId,
        pid: player.pid,
        player_tid: teamId,
        submitted: Math.round(Date.now() / 1000)
      })

      await knex('player')
        .update({
          nfl_status: constants.player_nfl_status.INJURED_RESERVE
        })
        .where({
          pid: player.pid
        })

      const res = await chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          reserve_pid: player.pid,
          leagueId,
          slot: constants.slots.IR
        })

      res.should.have.status(200)
      res.should.be.json
      res.body.tid.should.equal(teamId)
      res.body.pid.should.equal(player.pid)
      res.body.slot.should.equal(constants.slots.IR)
    })

    it('practice squad drafted player with active poaching claim can be reserved', async () => {
      MockDate.set(regular_season_start.subtract('1', 'week').toISOString())
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
        slot: constants.slots.PSD,
        transaction: constants.transactions.DRAFT,
        value
      })

      // Create active poaching claim
      await knex('poaches').insert({
        userid: 2,
        tid: 2,
        lid: leagueId,
        pid: player.pid,
        player_tid: teamId,
        submitted: Math.round(Date.now() / 1000)
      })

      await knex('player')
        .update({
          nfl_status: constants.player_nfl_status.INJURED_RESERVE
        })
        .where({
          pid: player.pid
        })

      const res = await chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          reserve_pid: player.pid,
          leagueId,
          slot: constants.slots.IR
        })

      res.should.have.status(200)
      res.should.be.json
      res.body.tid.should.equal(teamId)
      res.body.pid.should.equal(player.pid)
      res.body.slot.should.equal(constants.slots.IR)
    })
  })
})
