/* global describe before it beforeEach */
process.env.NODE_ENV = 'test'

const chai = require('chai')
const chaiHTTP = require('chai-http')
const server = require('../api')
const knex = require('../db')
const MockDate = require('mockdate')

const league = require('../db/seeds/league')
const { constants } = require('../common')
const { start } = constants.season
const {
  addPlayer,
  selectPlayer,
  error
} = require('./utils')

// const should = chai.should()

const { user1 } = require('./fixtures/token')

chai.use(chaiHTTP)

describe('API /poaches', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.migrate.forceFreeMigrationsLock()
    await knex.migrate.rollback()
    await knex.migrate.latest()
    await knex.seed.run()
  })

  // claim for drafted
  // claim for added
  // claim for deactivated
  // claim for traded and deactivated

  describe('errors', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      MockDate.set(start.clone().subtract('2', 'month').toDate())
      await league(knex)
    })

    it('reserve player violation', async () => {
      MockDate.set(start.clone().add('1', 'week').toDate())
      const reservePlayer = await selectPlayer()
      const teamId = 1
      const leagueId = 1
      await addPlayer({
        leagueId,
        player: reservePlayer,
        teamId,
        slot: constants.slots.IR,
        userId: 1
      })

      const player = await selectPlayer({ rookie: true })
      await addPlayer({
        leagueId,
        player,
        teamId: 2,
        slot: constants.slots.PS,
        userId: 2
      })

      MockDate.set(start.clone().add('1', 'week').add('3', 'day').toDate())

      const request = chai.request(server)
        .post('/api/leagues/1/poaches')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          player: player.player,
          leagueId
        })

      await error(request, 'Reserve player violation')
    })
  })
  // errors

  // - not logged in
  // - invalid userId
  // - invalid leagueId
  // - invalid teamId
  // - invalid player
  // - invalid drop
  // - teamId doesn't belong to userId
  // - drop player not on team

  // errors
  // - player on waivers - within 24 hours
  // - player has existing poaching claim
  // - player not on practice squad
  // - exceed roster space
  // - exceed available cap
})
