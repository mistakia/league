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

  describe('POST /api/u with chained /u/<hash> URL', () => {
    it('canonicalizes chained URL before hashing/storing', async () => {
      const post_inner = await chai_request
        .execute(server)
        .post('/api/u')
        .send({ url: TEST_URL })
      post_inner.should.have.status(200)
      const inner_hash = post_inner.body.url_hash

      const chained_url = `https://localhost/u/${inner_hash}?columns=%5B%22outer%22%5D`
      const post_chained = await chai_request
        .execute(server)
        .post('/api/u')
        .send({ url: chained_url })

      post_chained.should.have.status(200)
      // Canonicalized URL should be the inner pathname with the OUTER search.
      post_chained.body.url.should.equal(
        'https://localhost/data-views?columns=%5B%22outer%22%5D'
      )
      post_chained.body.url_hash.should.not.equal(inner_hash)

      const get_chained = await chai_request
        .execute(server)
        .get(`/api/u/${post_chained.body.url_hash}`)
      get_chained.should.have.status(200)
      get_chained.body.url.should.equal(
        'https://localhost/data-views?columns=%5B%22outer%22%5D'
      )
    })

    it('is idempotent: re-shortening /u/<hash>?<same-state> returns the original hash', async () => {
      // Simulate the exact production flow: client shortens canonical URL,
      // then later (without replaceState) shortens /u/<hash>?<same-state>.
      const canonical = `https://localhost/data-views?view_id=fixed-id&columns=%5B%22player_name%22%5D`
      const post_first = await chai_request
        .execute(server)
        .post('/api/u')
        .send({ url: canonical })
      post_first.should.have.status(200)
      const original_hash = post_first.body.url_hash

      const chained = `https://localhost/u/${original_hash}?view_id=fixed-id&columns=%5B%22player_name%22%5D`
      const post_second = await chai_request
        .execute(server)
        .post('/api/u')
        .send({ url: chained })
      post_second.should.have.status(200)
      post_second.body.url_hash.should.equal(original_hash)
      post_second.body.url.should.equal(canonical)
    })

    it('falls back to storing as-is when inner hash is unknown', async () => {
      const orphaned_url =
        'https://localhost/u/0000000000000000000000000000000000000000?columns=%5B%5D'
      const res = await chai_request
        .execute(server)
        .post('/api/u')
        .send({ url: orphaned_url })

      res.should.have.status(200)
      res.body.url.should.equal(orphaned_url)
    })
  })
})
