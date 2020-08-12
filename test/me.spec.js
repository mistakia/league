/* global describe, before it */
process.env.NODE_ENV = 'test'

const chai = require('chai')
const chaiHTTP = require('chai-http')
const server = require('../api')
const knex = require('../db')

const users = require('../db/seeds/users')

chai.should()

const { user1 } = require('./fixtures/token')

chai.use(chaiHTTP)

describe('API /me', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.migrate.forceFreeMigrationsLock()
    await knex.migrate.rollback()
    await knex.migrate.latest()
    await knex.seed.run()

    await users(knex)
  })

  it('/api/me', async () => {
    const res = await chai.request(server).get('/api/me').set('Authorization', `Bearer ${user1}`)
    res.should.have.status(200)
    // eslint-disable-next-line
    res.should.be.json
    res.body.user.id.should.equal(1)
    res.body.user.email.should.equal('user1@email.com')
    res.body.teams.should.be.an('array')
    res.body.leagues.should.be.an('array')
    res.body.sources.should.be.an('array')
    res.body.poaches.should.be.an('array')
    res.body.waivers.should.be.an('array')
  })
})
