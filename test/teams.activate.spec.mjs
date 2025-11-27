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
chai.use(chai_http)
const expect = chai.expect
const { regular_season_start } = constants.season

describe('API /teams - activate', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  describe('post', function () {
    before(async function () {
      await league(knex)
    })

    it('drafted player', async () => {
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

      const res = await chai_request
        .execute(server)
        .post('/api/teams/1/activate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          activate_pid: player.pid,
          leagueId
        })

      res.should.have.status(200)

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

    it('activate with deactivate - signed practice squad player', async () => {
      MockDate.set(regular_season_start.subtract('1', 'week').toISOString())
      const activate_player = await selectPlayer({
        exclude_rostered_players: true
      })
      const deactivate_player = await selectPlayer({
        exclude_pids: [activate_player.pid],
        exclude_rostered_players: true
      })
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const activate_value = 2
      const deactivate_value = 3

      // Add player to activate from practice squad
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player: activate_player,
        slot: constants.slots.PS,
        transaction: constants.transactions.PRACTICE_ADD,
        value: activate_value
      })

      // Add player to deactivate on bench (eligible for deactivation)
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player: deactivate_player,
        slot: constants.slots.BENCH,
        transaction: constants.transactions.ROSTER_ADD,
        value: deactivate_value
      })

      const res = await chai_request
        .execute(server)
        .post('/api/teams/1/activate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          activate_pid: activate_player.pid,
          deactivate_pid: deactivate_player.pid,
          leagueId
        })

      res.should.have.status(200)
      res.should.be.json

      // Response should be activate transaction data
      res.body.tid.should.equal(teamId)
      res.body.pid.should.equal(activate_player.pid)
      res.body.slot.should.equal(constants.slots.BENCH)
      res.body.transaction.type.should.equal(
        constants.transactions.ROSTER_ACTIVATE
      )
      res.body.transaction.value.should.equal(activate_value)

      // Verify activated player is now on bench
      const activateRosterRows = await knex('rosters_players')
        .where({
          year: constants.season.year,
          week: constants.season.week,
          pid: activate_player.pid
        })
        .limit(1)
      expect(activateRosterRows[0].slot).to.equal(constants.slots.BENCH)

      // Verify deactivated player is now on practice squad
      const deactivateRosterRows = await knex('rosters_players')
        .where({
          year: constants.season.year,
          week: constants.season.week,
          pid: deactivate_player.pid
        })
        .limit(1)
      expect(deactivateRosterRows[0].slot).to.equal(constants.slots.PS)

      // Verify both transactions were created
      const transactions = await knex('transactions')
        .where({
          lid: leagueId,
          year: constants.season.year
        })
        .whereIn('pid', [activate_player.pid, deactivate_player.pid])
        .orderBy('timestamp', 'desc')

      const activate_transaction = transactions.find(
        (t) =>
          t.pid === activate_player.pid &&
          t.type === constants.transactions.ROSTER_ACTIVATE
      )
      const deactivate_transaction = transactions.find(
        (t) =>
          t.pid === deactivate_player.pid &&
          t.type === constants.transactions.ROSTER_DEACTIVATE
      )

      expect(activate_transaction).to.exist
      expect(deactivate_transaction).to.exist
      expect(deactivate_transaction.value).to.equal(deactivate_value)
    })
  })

  describe('errors', function () {
    beforeEach(async function () {
      await league(knex)
    })

    const exclude_pids = []

    it('not logged in', async () => {
      const request = chai_request.execute(server).post('/api/teams/1/activate')
      await notLoggedIn(request)
    })

    it('missing pid', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/activate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1
        })

      await missing(request, 'pid')
    })

    it('missing leagueId', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/activate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          activate_pid: 'x'
        })

      await missing(request, 'leagueId')
    })

    it('invalid player - does not exist', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/activate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          activate_pid: 'x',
          leagueId: 1
        })

      await invalid(request, 'player')
    })

    it('invalid leagueId - does not exist', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/activate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          activate_pid: 'x',
          leagueId: 2
        })

      await invalid(request, 'leagueId')
    })

    it('teamId does not belong to userId', async () => {
      const request = chai_request
        .execute(server)
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
      exclude_pids.push(player.pid)
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/activate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          activate_pid: player.pid,
          leagueId: 1
        })

      await invalid(request, 'player')
    })

    it('player not on practice squad', async () => {
      const player = await selectPlayer({ exclude_pids })
      exclude_pids.push(player.pid)
      await addPlayer({ leagueId: 1, player, teamId: 1, userId: 1 })
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/activate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          activate_pid: player.pid,
          leagueId: 1
        })

      await error(request, 'player is on active roster')
    })

    it('player is protected', async () => {
      const player = await selectPlayer({ exclude_pids })
      await addPlayer({
        leagueId: 1,
        player,
        teamId: 1,
        userId: 1,
        slot: constants.slots.PSP
      })
      const request = chai_request
        .execute(server)
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

    it('deactivate player already on practice squad', async () => {
      MockDate.set(regular_season_start.subtract('1', 'week').toISOString())
      const activate_player = await selectPlayer({ exclude_pids })
      exclude_pids.push(activate_player.pid)
      const deactivate_player = await selectPlayer({ exclude_pids })
      exclude_pids.push(deactivate_player.pid)

      // Add player to activate from practice squad
      await addPlayer({
        teamId: 1,
        leagueId: 1,
        userId: 1,
        player: activate_player,
        slot: constants.slots.PS,
        transaction: constants.transactions.PRACTICE_ADD,
        value: 1
      })

      // Add player to deactivate already on practice squad (can't deactivate)
      await addPlayer({
        teamId: 1,
        leagueId: 1,
        userId: 1,
        player: deactivate_player,
        slot: constants.slots.PS,
        transaction: constants.transactions.PRACTICE_ADD,
        value: 1
      })

      const request = chai_request
        .execute(server)
        .post('/api/teams/1/activate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          activate_pid: activate_player.pid,
          deactivate_pid: deactivate_player.pid,
          leagueId: 1
        })

      await error(request, 'player is already on practice squad')
    })

    it('deactivate player previously activated', async () => {
      MockDate.set(regular_season_start.add('1', 'month').day(4).toISOString())
      const activate_player = await selectPlayer({ exclude_pids })
      exclude_pids.push(activate_player.pid)
      const deactivate_player = await selectPlayer({ exclude_pids })
      exclude_pids.push(deactivate_player.pid)

      // Add player to activate from practice squad
      await addPlayer({
        teamId: 1,
        leagueId: 1,
        userId: 1,
        player: activate_player,
        slot: constants.slots.PS,
        transaction: constants.transactions.PRACTICE_ADD,
        value: 1
      })

      // Add player to deactivate that was previously activated
      await knex('transactions').insert({
        userid: 1,
        tid: 1,
        lid: 1,
        pid: deactivate_player.pid,
        type: constants.transactions.PRACTICE_ADD,
        value: 2,
        week: constants.season.week,
        year: constants.season.year,
        timestamp: Math.round(Date.now() / 1000) - 10
      })

      await addPlayer({
        teamId: 1,
        leagueId: 1,
        userId: 1,
        player: deactivate_player,
        slot: constants.slots.BENCH,
        transaction: constants.transactions.ROSTER_ACTIVATE,
        value: 2
      })

      const request = chai_request
        .execute(server)
        .post('/api/teams/1/activate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          activate_pid: activate_player.pid,
          deactivate_pid: deactivate_player.pid,
          leagueId: 1
        })

      await error(
        request,
        'player can not be deactivated once previously activated'
      )
    })

    it('deactivate player exceeds 48 hours', async () => {
      MockDate.set(regular_season_start.add('1', 'month').day(4).toISOString())
      const activate_player = await selectPlayer({ exclude_pids })
      exclude_pids.push(activate_player.pid)
      const deactivate_player = await selectPlayer({ exclude_pids })
      exclude_pids.push(deactivate_player.pid)

      const teamId = 1
      const leagueId = 1
      const userId = 1

      // Add player to activate from practice squad
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player: activate_player,
        slot: constants.slots.PS,
        transaction: constants.transactions.PRACTICE_ADD,
        value: 1
      })

      // Add player to deactivate roster entry
      const rosters = await knex('rosters')
        .where({
          week: constants.season.week,
          year: constants.season.year,
          tid: teamId
        })
        .limit(1)
      const rosterId = rosters[0].uid

      // Insert transaction from 49 hours ago
      await knex('transactions').insert({
        userid: userId,
        tid: teamId,
        lid: leagueId,
        pid: deactivate_player.pid,
        type: constants.transactions.ROSTER_ADD,
        value: 1,
        week: constants.season.week,
        year: constants.season.year,
        timestamp: Math.round(Date.now() / 1000) - 60 * 60 * 49 // 49 hours ago
      })

      await knex('rosters_players').insert({
        rid: rosterId,
        pid: deactivate_player.pid,
        slot: constants.slots.BENCH,
        pos: deactivate_player.pos1,
        tag: constants.tags.REGULAR,
        tid: teamId,
        lid: leagueId,
        year: constants.season.year,
        week: constants.season.week
      })

      const request = chai_request
        .execute(server)
        .post('/api/teams/1/activate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          activate_pid: activate_player.pid,
          deactivate_pid: deactivate_player.pid,
          leagueId
        })

      await error(request, 'player has exceeded 48 hours on active roster')
    })
  })
})
