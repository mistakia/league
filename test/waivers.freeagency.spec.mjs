/* global describe before it beforeEach */
import chai from 'chai'
import chaiHTTP from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import knex from '#db'

import league from '#db/seeds/league.mjs'
import { constants, getDraftDates } from '#libs-shared'
import { user1 } from './fixtures/token.mjs'
import { getRoster } from '#libs-server'
import {
  addPlayer,
  releasePlayer,
  selectPlayer,
  fillRoster,
  error
} from './utils/index.mjs'

process.env.NODE_ENV = 'test'

chai.should()
chai.use(chaiHTTP)
const { start } = constants.season

describe('API /waivers - free agency', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
    await league(knex)
  })

  describe('put', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      MockDate.set(start.subtract('2', 'month').toISOString())
      await league(knex)
    })

    it('submit waiver for player', async () => {
      MockDate.set(start.add('1', 'week').toISOString())

      const player = await selectPlayer()

      // submit waiver claim
      const teamId = 1
      const leagueId = 1
      const res = await chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          pid: player.pid,
          type: constants.waivers.FREE_AGENCY,
          leagueId
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      res.body.tid.should.equal(teamId)
      res.body.userid.should.equal(1)
      res.body.lid.should.equal(leagueId)
      res.body.pid.should.equal(player.pid)
      res.body.po.should.equal(9999)
      res.body.submitted.should.equal(Math.round(Date.now() / 1000))
      res.body.bid.should.equal(0)
      res.body.type.should.equal(constants.waivers.FREE_AGENCY)
      // eslint-disable-next-line
      res.body.uid.should.exist
    })

    it('submit waiver for released rookie - offseason', async () => {
      MockDate.set(start.subtract('1', 'month').toISOString())
      const leagueId = 1
      const player = await selectPlayer({ rookie: true })
      await addPlayer({
        leagueId,
        player,
        teamId: 2,
        userId: 2,
        slot: constants.slots.PS,
        transaction: constants.transactions.DRAFT,
        value: 3
      })

      MockDate.set(start.subtract('3', 'week').toISOString())
      await releasePlayer({
        leagueId,
        player,
        teamId: 2,
        userId: 2
      })

      MockDate.set(start.subtract('3', 'week').add('4', 'hour').toISOString())

      // submit waiver claim
      const teamId = 1
      const res = await chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          pid: player.pid,
          type: constants.waivers.FREE_AGENCY_PRACTICE,
          leagueId
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      res.body.tid.should.equal(teamId)
      res.body.userid.should.equal(1)
      res.body.lid.should.equal(leagueId)
      res.body.pid.should.equal(player.pid)
      res.body.po.should.equal(9999)
      res.body.submitted.should.equal(Math.round(Date.now() / 1000))
      res.body.bid.should.equal(0)
      res.body.type.should.equal(constants.waivers.FREE_AGENCY_PRACTICE)
      // eslint-disable-next-line
      res.body.uid.should.exist
    })

    it('free agent rookie waiver w/ full active roster', async () => {})

    it('free agent waiver for player not on nfl active roster', async () => {})

    it('multiple same bids for same player, one team', async () => {})

    it('multiple same bids for same player, multiple teams', async () => {})
  })

  describe('errors', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      MockDate.set(start.subtract('2', 'month').toISOString())
      await league(knex)
    })

    it('duplicate waiver claim', async () => {
      MockDate.set(start.subtract('1', 'month').toISOString())
      const leagueId = 1
      const player = await selectPlayer({ rookie: true })
      await addPlayer({
        leagueId,
        player,
        teamId: 2,
        userId: 2,
        slot: constants.slots.PS,
        transaction: constants.transactions.DRAFT,
        value: 3
      })

      MockDate.set(start.subtract('3', 'week').toISOString())
      await releasePlayer({
        leagueId,
        player,
        teamId: 2,
        userId: 2
      })

      MockDate.set(start.subtract('3', 'week').add('4', 'hour').toISOString())
      const teamId = 1
      await chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          pid: player.pid,
          type: constants.waivers.FREE_AGENCY_PRACTICE,
          leagueId
        })

      const request = chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          pid: player.pid,
          type: constants.waivers.FREE_AGENCY_PRACTICE,
          leagueId
        })

      await error(request, 'duplicate waiver claim')
    })

    it('player is on a roster', async () => {
      const players = await knex('player')
        .whereNot('current_nfl_team', 'INA')
        .where('pos1', 'RB')
        .limit(1)

      await addPlayer({ leagueId: 1, player: players[0], teamId: 2, userId: 2 })

      const teamId = 1
      const leagueId = 1
      const request = chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          pid: players[0].pid,
          type: constants.waivers.FREE_AGENCY,
          leagueId
        })

      await error(request, 'player rostered')
    })

    it('player is no longer on waivers - exceeded 24 hours', async () => {
      const players = await knex('player')
        .whereNot('current_nfl_team', 'INA')
        .where('pos1', 'RB')
        .orderByRaw('RANDOM()')
        .limit(1)

      const player = players[0]

      // set time to thursday
      MockDate.set(start.add('1', 'week').day(5).toISOString())

      // add player
      await addPlayer({ leagueId: 1, player, teamId: 2, userId: 2 })

      // set time to 5 mins later
      MockDate.set(constants.season.now.add('5', 'minute').toISOString())

      // release player
      await releasePlayer({ leagueId: 1, player, teamId: 2, userId: 2 })

      // set time to 24 hours and 1 minute later
      MockDate.set(
        constants.season.now.add('24', 'hour').add('1', 'minute').toISOString()
      )

      // submit waiver
      const teamId = 1
      const leagueId = 1
      const request = chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          pid: player.pid,
          type: constants.waivers.FREE_AGENCY,
          leagueId
        })

      await error(request, 'player is not on waivers')
    })

    it('practice waiver for non rookie - offseason', async () => {
      MockDate.set(start.subtract('1', 'month').toISOString())
      const leagueId = 1
      const player = await selectPlayer({ rookie: false })

      // submit waiver claim
      const teamId = 1
      const request = chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          pid: player.pid,
          type: constants.waivers.FREE_AGENCY_PRACTICE,
          leagueId
        })

      await error(
        request,
        'practice squad waivers are not open for non-rookies'
      )
    })

    it('player is no longer on waivers - outside waiver period', async () => {
      MockDate.set(start.add('1', 'month').day(5).toISOString())
      const leagueId = 1
      const player = await selectPlayer()
      const teamId = 1
      const request = chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          pid: player.pid,
          type: constants.waivers.FREE_AGENCY,
          leagueId
        })

      await error(request, 'player is not on waivers')
    })

    it('player is no longer on waivers - outside waiver period - practice', async () => {
      MockDate.set(start.subtract('1', 'month').toISOString())
      const leagueId = 1
      const player = await selectPlayer({ rookie: true })
      await addPlayer({
        leagueId,
        player,
        teamId: 2,
        userId: 2,
        slot: constants.slots.PS,
        transaction: constants.transactions.DRAFT,
        value: 3
      })

      MockDate.set(start.subtract('3', 'week').toISOString())
      await releasePlayer({
        leagueId,
        player,
        teamId: 2,
        userId: 2
      })

      MockDate.set(start.subtract('3', 'week').add('25', 'hour').toISOString())

      // submit waiver claim
      const teamId = 1
      const request = chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          pid: player.pid,
          type: constants.waivers.FREE_AGENCY_PRACTICE,
          leagueId
        })

      await error(request, 'player is not on waivers')
    })

    it('team exceeds roster limits', async () => {
      MockDate.set(start.add('1', 'month').day(2).toISOString())
      const leagueId = 1
      const teamId = 1
      await fillRoster({ leagueId, teamId })
      const roster = await getRoster({ tid: teamId })
      const exclude_pids = roster.players.map((p) => p.pid)
      const player = await selectPlayer({ exclude_pids })
      const request = chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          pid: player.pid,
          type: constants.waivers.FREE_AGENCY,
          leagueId
        })

      await error(request, 'exceeds roster limits')
    })

    it('reserve player violation', async () => {
      MockDate.set(start.add('1', 'week').toISOString())
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

      const player = await selectPlayer({ exclude_pids: [reservePlayer.pid] })
      const request = chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          pid: player.pid,
          type: constants.waivers.FREE_AGENCY,
          leagueId
        })

      await error(request, 'Reserve player violation')
    })

    it('team exceeds available cap', async () => {
      // TODO
    })

    it('invalid player - position', async () => {
      // TODO
    })

    it('practice squad waiver for previously activated player', async () => {
      // TODO
    })

    it('release protected practice squad player', async () => {
      // TODO
    })

    it('rookie free agent waiver w/ full practice squad and no release', async () => {
      const picks = await knex('draft')
      const draftDates = getDraftDates({
        start: constants.season.now.unix(),
        picks: picks.length
      })
      MockDate.set(draftDates.draftEnd.toISOString())
      const leagueId = 1
      const teamId = 1
      await fillRoster({ leagueId, teamId })
      const roster = await getRoster({ tid: teamId })
      const exclude_pids = roster.players.map((p) => p.pid)
      const player = await selectPlayer({ exclude_pids, rookie: true })
      const request = chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          pid: player.pid,
          type: constants.waivers.FREE_AGENCY_PRACTICE,
          leagueId
        })

      await error(request, 'exceeds roster limits')
    })
  })
})
