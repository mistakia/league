/* global describe before beforeEach it */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import knex from '#db'
import league from '#db/seeds/league.mjs'
import {
  current_season,
  roster_slot_types,
  transaction_types
} from '#constants'
import { user1 } from './fixtures/token.mjs'
import {
  addPlayer,
  selectPlayer,
  fillRoster,
  invalid,
  error
} from './utils/index.mjs'

process.env.NODE_ENV = 'test'

chai.should()
chai.use(chai_http)
const expect = chai.expect
const { regular_season_start } = current_season

describe('API /teams - activate', function () {
  before(async function () {
    this.timeout(60 * 1000)

    MockDate.set(regular_season_start.subtract('1', 'week').toISOString())

    await knex.seed.run()
  })

  describe('post', function () {
    beforeEach(async function () {
      await league(knex)
    })

    it('activate and release player', async () => {
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 0

      await fillRoster({ leagueId, teamId })

      const players = await knex('rosters_players').where({
        lid: leagueId,
        tid: teamId,
        week: current_season.week,
        year: current_season.year
      })

      const player1 = players.find(
        (p) => p.slot === roster_slot_types.RESERVE_SHORT_TERM
      )
      const player2 = players.find((p) => p.slot === roster_slot_types.BENCH)

      const res = await chai_request
        .execute(server)
        .post('/api/teams/1/activate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          activate_pid: player1.pid,
          release_pid: player2.pid,
          leagueId
        })

      res.should.have.status(200)

      res.should.be.json

      res.body.tid.should.equal(teamId)
      res.body.pid.should.equal(player1.pid)
      res.body.slot.should.equal(roster_slot_types.BENCH)
      res.body.transaction.userid.should.equal(userId)
      res.body.transaction.tid.should.equal(teamId)
      res.body.transaction.lid.should.equal(leagueId)
      res.body.transaction.pid.should.equal(player1.pid)
      res.body.transaction.type.should.equal(transaction_types.ROSTER_ACTIVATE)
      res.body.transaction.value.should.equal(value)
      res.body.transaction.year.should.equal(current_season.year)
      res.body.transaction.timestamp.should.equal(Math.round(Date.now() / 1000))

      const rosterRows = await knex('rosters_players')
        .where({
          year: current_season.year,
          week: current_season.week,
          pid: player1.pid
        })
        .limit(1)

      const rosterRow = rosterRows[0]
      expect(rosterRow.slot).to.equal(roster_slot_types.BENCH)

      const transactions = await knex('transactions')

      const activateTransaction = transactions.find(
        (t) => t.type === transaction_types.ROSTER_ACTIVATE
      )
      expect(activateTransaction.lid).to.equal(leagueId)
      expect(activateTransaction.type).to.equal(
        transaction_types.ROSTER_ACTIVATE
      )
      expect(activateTransaction.value).to.equal(value)
      expect(activateTransaction.pid).to.equal(player1.pid)
      expect(activateTransaction.tid).to.equal(teamId)
      expect(activateTransaction.userid).to.equal(userId)

      const releaseTransaction = transactions.find(
        (t) => t.type === transaction_types.ROSTER_RELEASE
      )
      expect(releaseTransaction.lid).to.equal(leagueId)
      expect(releaseTransaction.type).to.equal(transaction_types.ROSTER_RELEASE)
      expect(releaseTransaction.value).to.equal(value)
      expect(releaseTransaction.pid).to.equal(player2.pid)
      expect(releaseTransaction.tid).to.equal(teamId)
      expect(releaseTransaction.userid).to.equal(userId)
    })
  })

  describe('errors', function () {
    beforeEach(async function () {
      await league(knex)
    })

    it('invalid release player - does not exist', async () => {
      const player1 = await selectPlayer()
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 2
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player: player1,
        slot: roster_slot_types.RESERVE_SHORT_TERM,
        transaction: transaction_types.DRAFT,
        value
      })

      const request = chai_request
        .execute(server)
        .post('/api/teams/1/activate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          release_pid: 'x',
          activate_pid: player1.pid
        })

      await invalid(request, 'player')
    })

    it('release player not on team', async () => {
      const player1 = await selectPlayer()
      const player2 = await selectPlayer({ exclude_pids: [player1.pid] })
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 2
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player: player1,
        slot: roster_slot_types.RESERVE_SHORT_TERM,
        transaction: transaction_types.DRAFT,
        value
      })

      const request = chai_request
        .execute(server)
        .post('/api/teams/1/activate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          release_pid: player2.pid,
          activate_pid: player1.pid
        })

      await error(request, 'player not on roster')
    })

    it('exceeds roster limits', async () => {
      const teamId = 1
      const leagueId = 1

      await fillRoster({ leagueId, teamId })

      const players = await knex('rosters_players').where({
        lid: leagueId,
        tid: teamId,
        week: current_season.week,
        year: current_season.year
      })

      const player1 = players.find(
        (p) => p.slot === roster_slot_types.RESERVE_SHORT_TERM
      )
      const player2 = players.find(
        (p) =>
          p.slot === roster_slot_types.RESERVE_SHORT_TERM &&
          p.pid !== player1.pid
      )

      const request = chai_request
        .execute(server)
        .post('/api/teams/1/activate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          activate_pid: player1.pid,
          release_pid: player2.pid,
          leagueId
        })

      await error(request, 'exceeds roster limits')
    })

    it('activate player is on active roster', async () => {
      const player1 = await selectPlayer()
      const player2 = await selectPlayer({ exclude_pids: [player1.pid] })
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 2
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player: player1,
        slot: roster_slot_types.BENCH,
        transaction: transaction_types.DRAFT,
        value
      })

      await addPlayer({
        teamId,
        leagueId,
        userId,
        player: player2,
        slot: roster_slot_types.BENCH,
        transaction: transaction_types.DRAFT,
        value
      })

      const request = chai_request
        .execute(server)
        .post('/api/teams/1/activate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          release_pid: player2.pid,
          activate_pid: player1.pid
        })

      await error(request, 'player is on active roster')
    })
  })
})
