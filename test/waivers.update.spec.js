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

chai.use(chaiHTTP)

describe('API /waivers - update', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.migrate.forceFreeMigrationsLock()
    await knex.migrate.rollback()
    await knex.migrate.latest()
    await knex.seed.run()
  })

  // - test changing order for single waiver
  // - test changing order for two waivers
  // - test changing order for three waivers

  // - update bid
  // - update drop

  // errors

  // - invalid field
  // - missing field
  // - invalid value
  // - missing value
  // - not logged in
  // - invalid leagueId
  // - invalid teamId
  // - teamId doesn't belong to userId
  // - bid exceeds available faab
  // - drop player not one team
  // - exceeds roster limits
})
