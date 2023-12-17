/* global describe, before, it */
import chai, { expect } from 'chai'
import chaiHTTP from 'chai-http'

import server from '#api'
import knex from '#db'
import users from '#db/seeds/users.mjs'

process.env.NODE_ENV = 'test'
chai.use(chaiHTTP)
chai.should()

describe('API /wagers', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.migrate.forceFreeMigrationsLock()
    await knex.migrate.rollback()
    await knex.migrate.latest()
    await knex.seed.run()

    await users(knex)
  })

  it('/api/wagers/:user_id', async () => {
    const res = await chai.request(server).get('/api/wagers/1')
    res.should.have.status(200)
    // eslint-disable-next-line no-unused-expressions
    res.should.be.json
    res.body.should.be.an('array')

    console.log(res.body)
  })

  describe('errors', function () {
    it('invalid user_id', async () => {
      const res = await chai.request(server).get('/api/wagers/abc')
      res.should.have.status(400)
      // eslint-disable-next-line no-unused-expressions
      res.should.be.json
      res.body.error.should.equal("The 'user_id' field must be a number.")
    })

    it('out of range limit', async () => {
      const res = await chai.request(server).get('/api/wagers/1?limit=1001')
      res.should.have.status(400)
      // eslint-disable-next-line no-unused-expressions
      res.should.be.json
      res.body.error.should.equal(
        "The 'limit' field must be less than or equal to 1000."
      )
    })

    it('out of range offset', async () => {
      const res = await chai.request(server).get('/api/wagers/1?offset=-1')
      res.should.have.status(400)
      // eslint-disable-next-line no-unused-expressions
      res.should.be.json
      res.body.error.should.equal(
        "The 'offset' field must be greater than or equal to 0."
      )
    })

    it('invalid wager_type', async () => {
      const res = await chai
        .request(server)
        .get('/api/wagers/1?wager_type=INVALID')
      res.should.have.status(400)
      // eslint-disable-next-line no-unused-expressions
      res.should.be.json
      res.body.error.should.equal(
        "The 'wager_type[0]' field value 'SINGLE, PARLAY, ROUND_ROBIN' does not match any of the allowed values."
      )
    })

    it('out of range min_selection_count', async () => {
      const res = await chai
        .request(server)
        .get('/api/wagers/1?min_selection_count=13')
      res.should.have.status(400)
      // eslint-disable-next-line no-unused-expressions
      res.should.be.json
      res.body.error.should.equal(
        "The 'min_selection_count' field must be less than or equal to 12."
      )
    })

    it('out of range max_selection_count', async () => {
      const res = await chai
        .request(server)
        .get('/api/wagers/1?max_selection_count=13')
      res.should.have.status(400)
      // eslint-disable-next-line no-unused-expressions
      res.should.be.json
      res.body.error.should.equal(
        "The 'max_selection_count' field must be less than or equal to 12."
      )
    })

    it('out of range min_selection_lost_count', async () => {
      const res = await chai
        .request(server)
        .get('/api/wagers/1?min_selection_lost_count=13')
      res.should.have.status(400)
      // eslint-disable-next-line no-unused-expressions
      res.should.be.json
      res.body.error.should.equal(
        "The 'min_selection_lost_count' field must be less than or equal to 12."
      )
    })

    it('out of range max_selection_lost_count', async () => {
      const res = await chai
        .request(server)
        .get('/api/wagers/1?max_selection_lost_count=13')
      res.should.have.status(400)
      // eslint-disable-next-line no-unused-expressions
      res.should.be.json
      res.body.error.should.equal(
        "The 'max_selection_lost_count' field must be less than or equal to 12."
      )
    })

    it('invalid wager_status', async () => {
      const res = await chai
        .request(server)
        .get('/api/wagers/1?wager_status=INVALID')
      res.should.have.status(400)
      // eslint-disable-next-line no-unused-expressions
      res.should.be.json
      res.body.error.should.equal(
        "The 'wager_status[0]' field value 'OPEN, WON, LOST, PUSH, CANCELLED' does not match any of the allowed values."
      )
    })
  })
})
