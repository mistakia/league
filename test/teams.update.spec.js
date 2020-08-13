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

describe('API /teams - update', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.migrate.forceFreeMigrationsLock()
    await knex.migrate.rollback()
    await knex.migrate.latest()
    await knex.seed.run()
  })

  // - update teamtext
  // - update teamvoice
  // - update leaguetext
  // - update name
  // - update image
  // - update abbrv

  // errors

  // - not logged in
  // - teamId doesnt belong to userId
  // - invalid teamId
  // - invalid/missing field
  // - invalid/missing value

  // - image is not a url
  // - name is too long
  // - abbrv is too long
  // - teamtext, teamvoice, leaguetext are not booleans
})
