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
  addPlayer,
  selectPlayer,
  // checkLastTransaction,
  notLoggedIn,
  missing,
  invalid,
  error
} = require('./utils')

chai.should()
chai.use(chaiHTTP)
// const expect = chai.expect

describe('API /teams - protect', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.migrate.forceFreeMigrationsLock()
    await knex.migrate.rollback()
    await knex.migrate.latest()
    await knex.seed.run()
  })

  describe('post', function () {
    before(async function () {
      this.timeout(60 * 1000)
      await league(knex)
    })

    it('rookie practice squad player', async () => {
      // TODO
    })

    it('veteran free agent practice squad player', async () => {
      // TODO
    })
  })

  describe('errors', function () {
    it('not logged in', async () => {
      const request = chai.request(server).post('/api/teams/1/protect')
      await notLoggedIn(request)
    })

    it('missing player', async () => {
      const request = chai.request(server).post('/api/teams/1/protect')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1
        })

      await missing(request, 'player')
    })

    it('missing leagueId', async () => {
      const request = chai.request(server).post('/api/teams/1/protect')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          player: 'x'
        })

      await missing(request, 'leagueId')
    })

    it('teamId does not belong to userId', async () => {
      const request = chai.request(server).post('/api/teams/1/protect')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          leagueId: 1,
          player: 'x'
        })

      await invalid(request, 'teamId')
    })

    it('player not on team', async () => {
      const player = await selectPlayer()
      const request = chai.request(server).post('/api/teams/1/protect')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          player: player.player
        })

      await invalid(request, 'player')
    })

    it('player already protected on practice squad', async () => {
      const player = await selectPlayer({ rookie: true })
      await addPlayer({ leagueId: 1, player, teamId: 1, userId: 1, slot: constants.slots.PSP })
      const request = chai.request(server).post('/api/teams/1/protect')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          player: player.player,
          leagueId: 1
        })

      await error(request, 'player is already protected')
    })

    it('player has a poaching claim', async () => {
      // TODO
    })

    it('during the off-season', async () => {
      // TODO
    })
  })
})
