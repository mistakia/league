/* global describe before it */
process.env.NODE_ENV = 'test'

const chai = require('chai')
const chaiHTTP = require('chai-http')
// const MockDate = require('mockdate')

const server = require('../api')
const knex = require('../db')

const league = require('../db/seeds/league')
const { user1, user2 } = require('./fixtures/token')
const {
  notLoggedIn,
  missing,
  invalid
} = require('./utils')

const expect = chai.expect
chai.should()
chai.use(chaiHTTP)

describe('API /leagues - update', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.migrate.forceFreeMigrationsLock()
    await knex.migrate.rollback()
    await knex.migrate.latest()
    await knex.seed.run()

    await league(knex)
  })

  describe('put', function () {
    it('update name', async () => {
      const value = 'TEST LEAGUE'
      const res = await chai.request(server)
        .put('/api/leagues/1')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          field: 'name',
          value
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      // verify database change
      res.body.value.should.equal(value)
      const leagues = await knex('leagues').where({ uid: 1 }).limit(1)
      const league = leagues[0]

      expect(league.name).to.equal(value)
    })

    it('update sqb', async () => {
      const value = 2
      const res = await chai.request(server)
        .put('/api/leagues/1')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          field: 'sqb',
          value
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      // verify database change
      res.body.value.should.equal(value)
      const leagues = await knex('leagues').where({ uid: 1 }).limit(1)
      const league = leagues[0]

      expect(league.sqb).to.equal(value)
    })

    it('update rec', async () => {
      const value = 1.0
      const res = await chai.request(server)
        .put('/api/leagues/1')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          field: 'rec',
          value
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      // verify database change
      res.body.value.should.equal(value)
      const leagues = await knex('leagues').where({ uid: 1 }).limit(1)
      const league = leagues[0]

      expect(league.rec).to.equal(value)
    })
  })

  describe('errors', function () {
    it('not logged in', async () => {
      const request = chai.request(server).put('/api/leagues/1')
      await notLoggedIn(request)
    })

    it('missing field', async () => {
      const request = chai.request(server).put('/api/leagues/1')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          value: 'test'
        })
      await missing(request, 'field')
    })

    it('missing value', async () => {
      const request = chai.request(server).put('/api/leagues/1')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          field: 'name'
        })
      await missing(request, 'value')
    })

    it('invalid field - does not exist', async () => {
      const request = chai.request(server).put('/api/leagues/1')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          field: 'name2',
          value: 'test'
        })
      await invalid(request, 'field')
    })

    it('userId is not commishId', async () => {
      const request = chai.request(server).put('/api/leagues/1')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          field: 'name',
          value: 'test'
        })
      await invalid(request, 'leagueId')
    })

    it('not an integer value', async () => {
      const request = chai.request(server)
        .put('/api/leagues/1')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          field: 'sqb',
          value: 'x'
        })

      await invalid(request, 'value')
    })

    it('not a positive value', async () => {
      const request = chai.request(server)
        .put('/api/leagues/1')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          field: 'sqb',
          value: -1
        })

      await invalid(request, 'value')
    })

    // validate min & max values for all fields
  })
})
