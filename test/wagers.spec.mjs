/* global describe, before, after, it */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'

import server from '#api'
import knex from '#db'
import users from '#db/fixtures/users.mjs'
import { user1, user2 } from './fixtures/token.mjs'

process.env.NODE_ENV = 'test'
chai.use(chai_http)
chai.should()

describe('API /wagers', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()

    await users(knex)
  })

  it('/api/wagers/:user_id', async () => {
    const res = await chai_request.execute(server).get('/api/wagers/1')
    res.should.have.status(200)

    res.should.be.json
    res.body.should.be.an('array')
  })

  describe('filters', function () {
    const base_wager = {
      wager_type: 'SINGLE',
      placed_at: new Date('2026-01-01T00:00:00.000Z'),
      bet_count: 1,
      selection_count: 1,
      selection_lost: 0,
      bet_wager_amount: 10,
      total_wager_amount: 10,
      wager_returned_amount: 0,
      book_id: 'DRAFTKINGS'
    }

    before(async function () {
      await knex('placed_wagers').del()
      await knex('placed_wagers').insert([
        {
          ...base_wager,
          wager_id: 90001,
          userid: 1,
          public: 1,
          wager_status: 'OPEN',
          book_wager_id: 'TEST_WAGER_OPEN_PUBLIC'
        },
        {
          ...base_wager,
          wager_id: 90002,
          userid: 1,
          public: 1,
          wager_status: 'WON',
          book_wager_id: 'TEST_WAGER_WON_PUBLIC'
        },
        {
          ...base_wager,
          wager_id: 90003,
          userid: 1,
          public: 0,
          wager_status: 'LOST',
          book_wager_id: 'TEST_WAGER_LOST_PRIVATE'
        }
      ])
    })

    after(async function () {
      await knex('placed_wagers').del()
    })

    it('filters by a single wager_status', async () => {
      const res = await chai_request
        .execute(server)
        .get('/api/wagers/1?wager_status=OPEN')
        .set('Authorization', `Bearer ${user1}`)
      res.should.have.status(200)

      res.body.should.be.an('array')
      res.body.length.should.equal(1)
      res.body[0].wager_id.should.equal(90001)
      res.body[0].wager_status.should.equal('OPEN')
    })

    it('filters by multiple wager_status values', async () => {
      const res = await chai_request
        .execute(server)
        .get('/api/wagers/1?wager_status=OPEN&wager_status=LOST')
        .set('Authorization', `Bearer ${user1}`)
      res.should.have.status(200)

      res.body.should.be.an('array')
      const wager_ids = res.body.map((w) => w.wager_id).sort()
      wager_ids.should.eql([90001, 90003])
    })

    it('returns every wager to the owner', async () => {
      const res = await chai_request
        .execute(server)
        .get('/api/wagers/1')
        .set('Authorization', `Bearer ${user1}`)
      res.should.have.status(200)

      res.body.length.should.equal(3)
    })

    it('returns only public wagers to another authenticated user', async () => {
      const res = await chai_request
        .execute(server)
        .get('/api/wagers/1')
        .set('Authorization', `Bearer ${user2}`)
      res.should.have.status(200)

      const wager_ids = res.body.map((w) => w.wager_id).sort()
      wager_ids.should.eql([90001, 90002])
    })

    it('returns only public wagers to an unauthenticated caller', async () => {
      const res = await chai_request.execute(server).get('/api/wagers/1')
      res.should.have.status(200)

      const wager_ids = res.body.map((w) => w.wager_id).sort()
      wager_ids.should.eql([90001, 90002])
    })
  })

  describe('errors', function () {
    it('invalid user_id', async () => {
      const res = await chai_request.execute(server).get('/api/wagers/abc')
      res.should.have.status(400)

      res.should.be.json
      res.body.error.should.equal("The 'user_id' field must be a number.")
    })

    it('out of range limit', async () => {
      const res = await chai_request
        .execute(server)
        .get('/api/wagers/1?limit=1001')
      res.should.have.status(400)

      res.should.be.json
      res.body.error.should.equal(
        "The 'limit' field must be less than or equal to 1000."
      )
    })

    it('out of range offset', async () => {
      const res = await chai_request
        .execute(server)
        .get('/api/wagers/1?offset=-1')
      res.should.have.status(400)

      res.should.be.json
      res.body.error.should.equal(
        "The 'offset' field must be greater than or equal to 0."
      )
    })

    it('invalid wager_type', async () => {
      const res = await chai_request
        .execute(server)
        .get('/api/wagers/1?wager_type=INVALID')
      res.should.have.status(400)

      res.should.be.json
      res.body.error.should.equal(
        "The 'wager_type[0]' field value 'SINGLE, PARLAY, ROUND_ROBIN' does not match any of the allowed values."
      )
    })

    it('out of range min_selection_count', async () => {
      const res = await chai_request
        .execute(server)
        .get('/api/wagers/1?min_selection_count=13')
      res.should.have.status(400)

      res.should.be.json
      res.body.error.should.equal(
        "The 'min_selection_count' field must be less than or equal to 12."
      )
    })

    it('out of range max_selection_count', async () => {
      const res = await chai_request
        .execute(server)
        .get('/api/wagers/1?max_selection_count=13')
      res.should.have.status(400)

      res.should.be.json
      res.body.error.should.equal(
        "The 'max_selection_count' field must be less than or equal to 12."
      )
    })

    it('out of range min_selection_lost_count', async () => {
      const res = await chai_request
        .execute(server)
        .get('/api/wagers/1?min_selection_lost_count=13')
      res.should.have.status(400)

      res.should.be.json
      res.body.error.should.equal(
        "The 'min_selection_lost_count' field must be less than or equal to 12."
      )
    })

    it('out of range max_selection_lost_count', async () => {
      const res = await chai_request
        .execute(server)
        .get('/api/wagers/1?max_selection_lost_count=13')
      res.should.have.status(400)

      res.should.be.json
      res.body.error.should.equal(
        "The 'max_selection_lost_count' field must be less than or equal to 12."
      )
    })

    it('invalid wager_status', async () => {
      const res = await chai_request
        .execute(server)
        .get('/api/wagers/1?wager_status=INVALID')
      res.should.have.status(400)

      res.should.be.json
      res.body.error.should.equal(
        "The 'wager_status[0]' field value 'OPEN, WON, LOST, PUSH, CANCELLED' does not match any of the allowed values."
      )
    })
  })
})
