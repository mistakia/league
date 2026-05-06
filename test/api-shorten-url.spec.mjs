/* global describe, before, it */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'

import server from '#api'

process.env.NODE_ENV = 'test'
chai.use(chai_http)
chai.should()
const expect = chai.expect

const TEST_URL =
  'https://localhost/data-views?columns=%5B%22player_name%22%5D&where=%5B%5D'

describe('API /api/u (shortened URL)', function () {
  this.timeout(30 * 1000)

  describe('POST /api/u', () => {
    it('returns short_url, url, url_hash for a valid xo.football/localhost URL', async () => {
      const res = await chai_request
        .execute(server)
        .post('/api/u')
        .send({ url: TEST_URL })

      res.should.have.status(200)
      res.body.should.have.property('short_url')
      res.body.should.have.property('url').that.equals(TEST_URL)
      res.body.should.have.property('url_hash')
      res.body.short_url.should.equal(`/u/${res.body.url_hash}`)
    })

    it('rejects URLs with hostnames outside the valid_domains whitelist', async () => {
      const res = await chai_request
        .execute(server)
        .post('/api/u')
        .send({ url: 'https://example.com/foo' })

      res.should.have.status(400)
      res.body.should.have.property('error')
    })
  })

  describe('GET /api/u/:hash', () => {
    let posted_hash

    before(async () => {
      const res = await chai_request
        .execute(server)
        .post('/api/u')
        .send({ url: TEST_URL })
      res.should.have.status(200)
      res.body.should.have.property('url_hash').that.is.a('string')
      posted_hash = res.body.url_hash
    })

    it('returns the stored URL byte-for-byte as application/json', async () => {
      const res = await chai_request
        .execute(server)
        .get(`/api/u/${posted_hash}`)

      res.should.have.status(200)
      res.should.have.header('content-type', /application\/json/)
      res.body.should.have.property('url').that.equals(TEST_URL)
      res.body.should.have.property('url_hash').that.equals(posted_hash)
    })

    it('does not set a Location header on success (regression guard)', async () => {
      const res = await chai_request
        .execute(server)
        .get(`/api/u/${posted_hash}`)

      res.should.have.status(200)
      expect(res.headers.location).to.be.undefined
    })

    it('returns 404 with { error: not_found } for an unknown hash', async () => {
      const res = await chai_request
        .execute(server)
        .get('/api/u/0000000000000000000000000000000000000000')

      res.should.have.status(404)
      res.body.should.have.property('error').that.equals('not_found')
    })

    it('works without an Authorization header (anonymous access)', async () => {
      const res = await chai_request
        .execute(server)
        .get(`/api/u/${posted_hash}`)
      // No .set('Authorization', ...) above; the JWT pass-through middleware
      // must allow the request through to the route.
      res.should.have.status(200)
      res.body.should.have.property('url')
    })
  })
})
