/* global describe afterEach it */
import * as chai from 'chai'

import fetch_json from '#libs-server/fetch-json.mjs'
import fetch_cheerio from '#libs-server/fetch-cheerio.mjs'
import require_served_response from '#libs-server/require-served-response.mjs'

const expect = chai.expect

const serve = (body, status) => {
  global.fetch = async () => new Response(body, { status })
}

const attempt = async (fn) => {
  try {
    return { threw: false, value: await fn() }
  } catch (err) {
    return { threw: true, err }
  }
}

describe('LIBS-SERVER /fetch helpers', function () {
  afterEach(() => {
    delete global.fetch
  })

  describe('require_served_response', function () {
    it('returns the response untouched on a 200', () => {
      const response = new Response('{}', { status: 200 })
      expect(require_served_response(response, 'https://x.test')).to.equal(
        response
      )
    })

    // The reason this is `!== 200` and not `!response.ok`. A WAF challenge
    // answers 202 with an empty body dressed as success, so `ok` is true for
    // exactly the response the check exists to reject. If this ever starts
    // passing, the guarantee is gone.
    it('rejects a 202, which response.ok would admit', () => {
      const response = new Response('', { status: 202 })
      expect(response.ok).to.equal(true)
      expect(() =>
        require_served_response(response, 'https://x.test')
      ).to.throw(/202/)
    })

    it('carries http_status on the error so a caller can branch on it', () => {
      const response = new Response('', { status: 403 })
      try {
        require_served_response(response, 'https://x.test')
        expect.fail('should have thrown')
      } catch (err) {
        expect(err.http_status).to.equal(403)
      }
    })
  })

  describe('fetch_json', function () {
    it('parses a served body', async () => {
      serve(JSON.stringify({ player_list: [1, 2] }), 200)
      const { threw, value } = await attempt(() => fetch_json('https://x.test'))
      expect(threw).to.equal(false)
      expect(value.player_list).to.deep.equal([1, 2])
    })

    // The defect this closes: a refused response used to reach the caller as a
    // parsed shape merely missing what it wanted, surfacing as a TypeError on
    // an inner property rather than as the refusal.
    it('reports the status rather than letting a caller trip over the shape', async () => {
      serve('{"error":"forbidden"}', 403)
      const { threw, err } = await attempt(() => fetch_json('https://x.test'))
      expect(threw).to.equal(true)
      expect(err.http_status).to.equal(403)
      expect(err.message).to.not.match(/undefined/)
    })

    it('rejects a 202 challenge', async () => {
      serve('', 202)
      const { threw, err } = await attempt(() => fetch_json('https://x.test'))
      expect(threw).to.equal(true)
      expect(err.http_status).to.equal(202)
    })
  })

  describe('fetch_cheerio', function () {
    it('loads a served page', async () => {
      serve('<html><body><table><tr><td>a</td></tr></table></body></html>', 200)
      const { threw, value } = await attempt(() =>
        fetch_cheerio('https://x.test')
      )
      expect(threw).to.equal(false)
      expect(value('td').length).to.equal(1)
    })

    // Both helpers must answer identically, which is why the rule lives in one
    // module rather than being written twice.
    it('rejects a 202 on the same rule as fetch_json', async () => {
      serve('<html></html>', 202)
      const { threw, err } = await attempt(() =>
        fetch_cheerio('https://x.test')
      )
      expect(threw).to.equal(true)
      expect(err.http_status).to.equal(202)
    })
  })
})
