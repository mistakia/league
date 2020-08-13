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

describe('API /teams - deactivate', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.migrate.forceFreeMigrationsLock()
    await knex.migrate.rollback()
    await knex.migrate.latest()
    await knex.seed.run()
  })

  // - deactivate drafted player
  // - deactivate traded player
  // - deactivate added player
  // - deactivate signed player
  // - deactivate player added right before the super bowl
  // - deactivate ir player
  // - deactivate covid player

  // errors

  // - not logged in
  // - invalid userId
  // - invalid leagueId
  // - invalid teamId
  // - invalid player
  // - teamId doesn't belong to userId
  // - player on another team
  // - player already on practice sqaud

  // - player is not a rookie
  // - no space on practice squad
  // - player poached
  // - player already activated
  // - player on roster for more than 48 hours
})
