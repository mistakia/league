/* global describe before it */
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
  error
} = require('./utils')

chai.should()
chai.use(chaiHTTP)

describe('API /waivers - free agency', function () {
  let playerId
  before(async function () {
    this.timeout(60 * 1000)
    await knex.migrate.forceFreeMigrationsLock()
    await knex.migrate.rollback()
    await knex.migrate.latest()
    await knex.seed.run()

    MockDate.set(start.clone().subtract('1', 'month').toDate())
    await league(knex)
  })

  describe('put', function () {
    it('submit waiver for player', async () => {
      MockDate.set(start.clone().add('1', 'week').toDate())

      const players = await knex('player')
        .whereNot('cteam', 'INA')
        .where('pos1', 'WR')
        .limit(1)
      playerId = players[0].player

      // submit waiver claim
      const teamId = 1
      const leagueId = 1
      const res = await chai.request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          player: playerId,
          type: constants.waivers.FREE_AGENCY,
          leagueId
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      res.body.tid.should.equal(teamId)
      res.body.userid.should.equal(1)
      res.body.lid.should.equal(leagueId)
      res.body.player.should.equal(playerId)
      res.body.po.should.equal(9999)
      res.body.submitted.should.equal(Math.round(Date.now() / 1000))
      res.body.bid.should.equal(0)
      res.body.type.should.equal(constants.waivers.FREE_AGENCY)
      res.body.uid.should.equal(1)
    })
  })

  describe('errors', function () {
    it('duplicate waiver claim', async () => {
      const teamId = 1
      const leagueId = 1
      const request = chai.request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          player: playerId,
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

    it('player is no longer on waivers - outside waiver period', async () => {
      // set time to thursday

      // submit waiver
    })

    it('team exceeds roster limits', async () => {
      // TODO
    })

    it('team exceeds available cap', async () => {
      // TODO
    })

    it('invalid player - position', async () => {
      // TODO
    })
  })
})
