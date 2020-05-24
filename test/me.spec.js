process.env.NODE_ENV = 'test'

const chai = require('chai')
const chaiHTTP = require('chai-http')
const server = require('../api')
const knex = require('../db')

const token = require('./fixtures/token')

const should = chai.should()

chai.use(chaiHTTP)

describe('API /me', function () {
  before(async () => {
    await knex.migrate.rollback()
    await knex.migrate.latest()
    await knex.seed.run()
  })

  after(async () => {
    await knex.migrate.rollback()
  })

  it('/api/me', async () => {
    const res = await chai.request(server).get('/api/me').set('Authorization', `Bearer ${token}`)
    res.should.have.status(200)
    res.should.be.json
    res.body.user.id.should.equal(1)
    res.body.user.email.should.equal('test@email.com')
    res.body.teams.should.be.an('array')
    res.body.leagues.should.be.an('array')
    res.body.weights.should.be.an('array')
  })
})
