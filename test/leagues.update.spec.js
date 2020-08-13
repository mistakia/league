/* global describe, before */
process.env.NODE_ENV = 'test'

const chai = require('chai')
const chaiHTTP = require('chai-http')
// const server = require('../api')
const knex = require('../db')

// const league = require('../db/seeds/league')
// const draft = require('../db/seeds/draft')
// const { constants } = require('../common')

// const should = chai.should()

// const { user1, user2 } = require('./fixtures/token')

chai.use(chaiHTTP)

describe('API /leagues - update', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.migrate.forceFreeMigrationsLock()
    await knex.migrate.rollback()
    await knex.migrate.latest()
    await knex.seed.run()
  })

  // - update fields

  // errors

  // - not logged in
  // - teamId doesnt belong to userId
  // - invalid teamId
  // - invalid/missing field
  // - invalid/missing value
  // - not commissioner

  // - not an integer
  // - not a positive
  // - not a float
})
