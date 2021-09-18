/* global describe before beforeEach */
process.env.NODE_ENV = 'test'

const chai = require('chai')
const chaiHTTP = require('chai-http')
// const server = require('../api')
const knex = require('../db')
const MockDate = require('mockdate')

const league = require('../db/seeds/league')
const { constants } = require('../common')
const { start } = constants.season
// const { addPlayer, selectPlayer, error } = require('./utils')

// const should = chai.should()

// const { user1 } = require('./fixtures/token')

chai.use(chaiHTTP)

describe('API /poaches - update', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.migrate.forceFreeMigrationsLock()
    await knex.migrate.rollback()
    await knex.migrate.latest()
    await knex.seed.run()
  })

  describe('errors', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      MockDate.set(start.subtract('2', 'month').toDate())
      await league(knex)
    })
  })
  // errors

  // - not logged in
  // - invalid userId
  // - invalid leagueId
  // - invalid teamId
  // - invalid player
  // - invalid release
  // - teamId doesn't belong to userId
  // - release player not on team
  // - exceeds roster space
  // - exceeds salary space
  // - release player involved in different poach
})
