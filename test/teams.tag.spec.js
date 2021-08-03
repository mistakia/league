/* global describe before it */
process.env.NODE_ENV = 'test'

const chai = require('chai')
const chaiHTTP = require('chai-http')
// const MockDate = require('mockdate')

const server = require('../api')
const knex = require('../db')

const league = require('../db/seeds/league')
const { constants } = require('../common')
// const { start } = constants.season
const { user1, user2 } = require('./fixtures/token')
const {
  selectPlayer,
  addPlayer,
  notLoggedIn,
  missing,
  invalid
} = require('./utils')

chai.should()
chai.use(chaiHTTP)
// const expect = chai.expect

describe('API /teams - tag', function () {
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
  })

  describe('errors', function () {
    it('not logged in', async () => {
      const request = chai.request(server).post('/api/teams/1/tag')
      await notLoggedIn(request)
    })

    it('missing tag', async () => {
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const player = await selectPlayer()
      await addPlayer({
        player,
        leagueId,
        teamId,
        userId,
        slot: constants.slots.BENCH
      })

      const request = chai
        .request(server)
        .post('/api/teams/1/tag')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          player: player.player
        })

      await missing(request, 'tag')
    })

    it('missing player', async () => {
      const request = chai
        .request(server)
        .post('/api/teams/1/tag')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          tag: constants.tags.REGULAR,
          leagueId: 1
        })

      await missing(request, 'player')
    })

    it('missing leagueId', async () => {
      const request = chai
        .request(server)
        .post('/api/teams/1/tag')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          tag: constants.tags.REGULAR,
          player: 'x'
        })

      await missing(request, 'leagueId')
    })

    it('invalid player - does not exist', async () => {
      const request = chai
        .request(server)
        .post('/api/teams/1/tag')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          tag: constants.tags.REGULAR,
          player: 'x',
          leagueId: 1
        })

      await invalid(request, 'player')
    })

    it('invalid tag - does not exist', async () => {
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const player = await selectPlayer()
      await addPlayer({
        player,
        leagueId,
        teamId,
        userId,
        slot: constants.slots.BENCH
      })

      const request = chai
        .request(server)
        .post('/api/teams/1/tag')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          tag: 'x',
          player: player.player,
          leagueId: 1
        })

      await invalid(request, 'tag')
    })

    it('invalid leagueId - does not exist', async () => {
      const request = chai
        .request(server)
        .post('/api/teams/1/tag')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          tag: constants.tags.REGULAR,
          player: 'x',
          leagueId: 2
        })

      await invalid(request, 'leagueId')
    })

    it('teamId does not belong to userId', async () => {
      const request = chai
        .request(server)
        .post('/api/teams/1/tag')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          tag: constants.tags.REGULAR,
          player: 'x',
          leagueId: 1
        })

      await invalid(request, 'teamId')
    })

    it('player not on team', async () => {
      const player = await selectPlayer()
      const request = chai
        .request(server)
        .post('/api/teams/1/tag')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          tag: constants.tags.REGULAR,
          player: player.player,
          leagueId: 1
        })

      await invalid(request, 'player')
    })

    it('offseason & tag deadline passed', async () => {
      // TODO
    })
  })
})
