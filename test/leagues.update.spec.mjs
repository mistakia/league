/* global describe before it */
import chai from 'chai'
import chaiHTTP from 'chai-http'

import server from '#api'
import knex from '#db'

import league from '#db/seeds/league.mjs'
import { user1, user2 } from './fixtures/token.mjs'
import { notLoggedIn, missing, invalid } from './utils/index.mjs'
import { getLeague } from '#libs-server'

process.env.NODE_ENV = 'test'
const expect = chai.expect
chai.should()
chai.use(chaiHTTP)

describe('API /leagues - update', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()

    await league(knex)
  })

  describe('put', function () {
    it('update name', async () => {
      const lid = 1
      const value = 'TEST LEAGUE'
      const res = await chai
        .request(server)
        .put(`/api/leagues/${lid}`)
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
      const league = await getLeague({ lid })

      expect(league.name).to.equal(value)
    })

    it('update sqb', async () => {
      const lid = 1
      const value = 2
      const res = await chai
        .request(server)
        .put(`/api/leagues/${lid}`)
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
      const league = await getLeague({ lid })

      expect(league.sqb).to.equal(value)
    })

    it('update rec', async () => {
      const lid = 1
      const value = 1.5
      const res = await chai
        .request(server)
        .put(`/api/leagues/${lid}`)
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
      const league = await getLeague({ lid })

      expect(league.rec).to.equal(value)
    })
  })

  describe('errors', function () {
    it('not logged in', async () => {
      const request = chai.request(server).put('/api/leagues/1')
      await notLoggedIn(request)
    })

    it('missing field', async () => {
      const request = chai
        .request(server)
        .put('/api/leagues/1')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          value: 'test'
        })
      await missing(request, 'field')
    })

    it('missing value', async () => {
      const request = chai
        .request(server)
        .put('/api/leagues/1')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          field: 'name'
        })
      await missing(request, 'value')
    })

    it('invalid field - does not exist', async () => {
      const request = chai
        .request(server)
        .put('/api/leagues/1')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          field: 'name2',
          value: 'test'
        })
      await invalid(request, 'field')
    })

    it('userId is not commishId', async () => {
      const request = chai
        .request(server)
        .put('/api/leagues/1')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          field: 'name',
          value: 'test'
        })
      await invalid(request, 'leagueId')
    })

    it('not an integer value', async () => {
      const request = chai
        .request(server)
        .put('/api/leagues/1')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          field: 'sqb',
          value: 'x'
        })

      await invalid(request, 'value')
    })

    it('not a positive value', async () => {
      const request = chai
        .request(server)
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
