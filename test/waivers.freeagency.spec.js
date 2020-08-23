/* global describe before it beforeEach */
process.env.NODE_ENV = 'test'

const chai = require('chai')
const chaiHTTP = require('chai-http')
const MockDate = require('mockdate')
const moment = require('moment')

const server = require('../api')
const knex = require('../db')

const league = require('../db/seeds/league')
const { constants } = require('../common')
const { start } = constants.season
const { user1 } = require('./fixtures/token')
const {
  addPlayer,
  dropPlayer,
  selectPlayer,
  fillRoster,
  error
} = require('./utils')

chai.should()
chai.use(chaiHTTP)

describe('API /waivers - free agency', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.migrate.forceFreeMigrationsLock()
    await knex.migrate.rollback()
    await knex.migrate.latest()
    await knex.seed.run()
  })

  describe('put', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      MockDate.set(start.clone().subtract('2', 'month').toDate())
      await league(knex)
    })

    it('submit waiver for player', async () => {
      MockDate.set(start.clone().add('1', 'week').toDate())

      const player = await selectPlayer()

      // submit waiver claim
      const teamId = 1
      const leagueId = 1
      const res = await chai.request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          player: player.player,
          type: constants.waivers.FREE_AGENCY,
          leagueId
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      res.body.tid.should.equal(teamId)
      res.body.userid.should.equal(1)
      res.body.lid.should.equal(leagueId)
      res.body.player.should.equal(player.player)
      res.body.po.should.equal(9999)
      res.body.submitted.should.equal(Math.round(Date.now() / 1000))
      res.body.bid.should.equal(0)
      res.body.type.should.equal(constants.waivers.FREE_AGENCY)
      // eslint-disable-next-line
      res.body.uid.should.exist
    })

    it('submit waiver for released rookie - offseason', async () => {
      MockDate.set(start.clone().subtract('1', 'month').toDate())
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

      MockDate.set(start.clone().subtract('3', 'week').toDate())
      await dropPlayer({
        leagueId,
        player,
        teamId: 2,
        userId: 2
      })

      MockDate.set(start.clone().subtract('3', 'week').add('4', 'hour').toDate())

      // submit waiver claim
      const teamId = 1
      const res = await chai.request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          player: player.player,
          type: constants.waivers.FREE_AGENCY_PRACTICE,
          leagueId
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      res.body.tid.should.equal(teamId)
      res.body.userid.should.equal(1)
      res.body.lid.should.equal(leagueId)
      res.body.player.should.equal(player.player)
      res.body.po.should.equal(9999)
      res.body.submitted.should.equal(Math.round(Date.now() / 1000))
      res.body.bid.should.equal(0)
      res.body.type.should.equal(constants.waivers.FREE_AGENCY_PRACTICE)
      // eslint-disable-next-line
      res.body.uid.should.exist
    })

    it('free agent rookie waiver w/ full active roster', async () => {

    })
  })

  describe('errors', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      MockDate.set(start.clone().subtract('2', 'month').toDate())
      await league(knex)
    })

    it('duplicate waiver claim', async () => {
      MockDate.set(start.clone().subtract('1', 'month').toDate())
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

      MockDate.set(start.clone().subtract('3', 'week').toDate())
      await dropPlayer({
        leagueId,
        player,
        teamId: 2,
        userId: 2
      })

      MockDate.set(start.clone().subtract('3', 'week').add('4', 'hour').toDate())
      const teamId = 1
      await chai.request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          player: player.player,
          type: constants.waivers.FREE_AGENCY,
          leagueId
        })

      const request = chai.request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          player: player.player,
          type: constants.waivers.FREE_AGENCY,
          leagueId
        })

      await error(request, 'duplicate waiver claim')
    })

    it('player is on a roster', async () => {
      const players = await knex('player')
        .whereNot('cteam', 'INA')
        .where('pos1', 'RB')
        .limit(1)

      await addPlayer({ leagueId: 1, player: players[0], teamId: 2, userId: 2 })

      const teamId = 1
      const leagueId = 1
      const request = chai.request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          player: players[0].player,
          type: constants.waivers.FREE_AGENCY,
          leagueId
        })

      await error(request, 'player rostered')
    })

    it('player is no longer on waivers - exceeded 24 hours', async () => {
      const players = await knex('player')
        .whereNot('cteam', 'INA')
        .where('pos1', 'RB')
        .orderByRaw('RAND()')
        .limit(1)

      const player = players[0]

      // set time to thursday
      MockDate.set(start.clone().add('1', 'week').day(5).toDate())

      // add player
      await addPlayer({ leagueId: 1, player, teamId: 2, userId: 2 })

      // set time to 5 mins later
      MockDate.set(moment().add('5', 'minute').toDate())

      // release player
      await dropPlayer({ leagueId: 1, player, teamId: 2, userId: 2 })

      // set time to 24 hours and 1 minute later
      MockDate.set(moment().add('24', 'hour').add('1', 'minute').toDate())

      // submit waiver
      const teamId = 1
      const leagueId = 1
      const request = chai.request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          player: player.player,
          type: constants.waivers.FREE_AGENCY,
          leagueId
        })

      await error(request, 'player is not on waivers')
    })

    it('practice waiver for non rookie', async () => {
      MockDate.set(start.clone().subtract('1', 'month').toDate())
      const leagueId = 1
      const player = await selectPlayer({ rookie: false })

      // submit waiver claim
      const teamId = 1
      const request = chai.request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          player: player.player,
          type: constants.waivers.FREE_AGENCY_PRACTICE,
          leagueId
        })

      await error(request, 'player is not practice squad eligible')
    })

    it('player is no longer on waivers - outside waiver period', async () => {
      MockDate.set(start.clone().add('1', 'month').day(5).toDate())
      const leagueId = 1
      const player = await selectPlayer()
      const teamId = 1
      const request = chai.request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          player: player.player,
          type: constants.waivers.FREE_AGENCY,
          leagueId
        })

      await error(request, 'player is not on waivers')
    })

    it('player is no longer on waivers - outside waiver period - practice', async () => {
      MockDate.set(start.clone().subtract('1', 'month').toDate())
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

      MockDate.set(start.clone().subtract('3', 'week').toDate())
      await dropPlayer({
        leagueId,
        player,
        teamId: 2,
        userId: 2
      })

      MockDate.set(start.clone().subtract('3', 'week').add('25', 'hour').toDate())

      // submit waiver claim
      const teamId = 1
      const request = chai.request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          player: player.player,
          type: constants.waivers.FREE_AGENCY_PRACTICE,
          leagueId
        })

      await error(request, 'player is not on waivers')
    })

    it('team exceeds roster limits', async () => {
      MockDate.set(start.clone().add('1', 'month').day(2).toDate())
      const leagueId = 1
      const teamId = 1
      await fillRoster({ leagueId, teamId })
      const player = await selectPlayer()
      const request = chai.request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          player: player.player,
          type: constants.waivers.FREE_AGENCY,
          leagueId
        })

      await error(request, 'exceeds roster limits')
    })

    it('team exceeds available cap', async () => {
      // TODO
    })

    it('invalid player - position', async () => {
      // TODO
    })

    it('rookie free agent waiver w/ full practice squad', async () => {
      // TODO
    })
  })
})
