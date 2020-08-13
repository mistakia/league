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

describe('API /waivers - cancel', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.migrate.forceFreeMigrationsLock()
    await knex.migrate.rollback()
    await knex.migrate.latest()
    await knex.seed.run()
  })

  // - cancel waiver
  // - resubmit waiver
  // - cancel waiver

  // errors

  // - not logged in
  // - invalid userId
  // - invalid leagueId
  // - invalid teamId
  // - invalid player
  // - invalid drop
  // - teamId doesn't belong to userId
  // - cancel waiver that doesn't belong to you
})
