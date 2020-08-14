/* global describe before beforeEach it */
process.env.NODE_ENV = 'test'

const chai = require('chai')
const chaiHTTP = require('chai-http')
const MockDate = require('mockdate')

const server = require('../api')
const knex = require('../db')

const league = require('../db/seeds/league')
const { constants } = require('../common')
const { start } = constants.season
const { user1, user2 } = require('./fixtures/token')
const {
  notLoggedIn,
  missing,
  invalid,
  addPlayer,
  selectPlayer
} = require('./utils')

chai.should()
chai.use(chaiHTTP)

describe('API /teams - drop', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.migrate.forceFreeMigrationsLock()
    await knex.migrate.rollback()
    await knex.migrate.latest()
    await knex.seed.run()
  })

  describe('post', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      MockDate.set(start.clone().subtract('1', 'month').toDate())
      await league(knex)
    })

    it('practice squad player - season', async () => {
      MockDate.set(start.clone().add('1', 'month').day(5).toDate())

      const teamId = 1
      const leagueId = 1
      const userId = 1
      const player = await selectPlayer()
      await addPlayer({ player, leagueId, teamId, userId, slot: constants.slots.PS })

      const res = await chai.request(server)
        .post('/api/teams/1/drop')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          player: player.player,
          teamId,
          leagueId
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      res.body.userid.should.equal(userId)
      res.body.tid.should.equal(teamId)
      res.body.lid.should.equal(leagueId)
      res.body.player.should.equal(player.player)
      res.body.type.should.equal(constants.transactions.ROSTER_DROP)
      res.body.value.should.equal(0)
      res.body.timestamp.should.equal(Math.round(Date.now() / 1000))
    })

    it('practice squad player - offseason', async () => {
      // TODO
    })

    it('active roster player - season', async () => {
      // TODO
    })

    it('active roster player - offseason', async () => {
      // TODO
    })

    it('ir player - offseason', async () => {
      // TODO
    })

    it('ir player - season', async () => {
      // TODO
    })

    it('locked active roster player - season', async () => {
      // TODO
    })

    it('covid player - season', async () => {
      // TODO
    })
  })

  describe('errors', function () {
    it('not logged in', async () => {
      const request = chai.request(server).post('/api/teams/1/drop')
      await notLoggedIn(request)
    })

    it('missing player', async () => {
      const request = chai.request(server).post('/api/teams/1/drop')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId: 1,
          leagueId: 1
        })

      await missing(request, 'player')
    })

    it('missing teamId', async () => {
      const request = chai.request(server).post('/api/teams/1/drop')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          player: 'x',
          leagueId: 1
        })

      await missing(request, 'teamId')
    })

    it('missing leagueId', async () => {
      const request = chai.request(server).post('/api/teams/1/drop')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          player: 'x',
          teamId: 1
        })

      await missing(request, 'leagueId')
    })

    it('teamId does not belong to userId', async () => {
      const request = chai.request(server).post('/api/teams/1/drop')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          player: 'x',
          leagueId: 1,
          teamId: 1
        })

      await invalid(request, 'teamId')
    })

    it('invalid player - not on team', async () => {
      // TODO
    })

    it('drop player with a poaching claim', async () => {
      // TODO
    })

    it('drop locked starter', async () => {
      // TODO
    })

    it('drop poached player - offseason', async () => {
      // TODO
    })
  })
})
