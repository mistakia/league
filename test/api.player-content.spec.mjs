/* global describe before after it */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'

import server from '#api'
import config from '#config'

process.env.NODE_ENV = 'test'

chai.should()
chai.use(chai_http)
const expect = chai.expect

const TEST_BASE_URL = 'https://content-feed.test'
const TEST_PID = 'ALVI-KAMA-015215'

// Pins the two server-side filters on GET /players/:pid/content, both of which
// exist because the upstream cannot express them.
//
// `source_type` is not in the content-feed API's filter vocabulary, so league
// over-fetches and narrows here; and the upstream's public projection withholds
// `summary` on purpose, which leaves a Twitter item with no renderable text at
// all (its `title` is always null). Neither filter is visible in the response
// shape, so only a fixture carrying rows that SHOULD be dropped can tell a
// working filter from one that passes everything.
describe('API /players/:pid/content', function () {
  const original_fetch = global.fetch
  const original_config = config.content_feed_api

  before(function () {
    config.content_feed_api = { base_url: TEST_BASE_URL }
  })

  after(function () {
    global.fetch = original_fetch
    config.content_feed_api = original_config
  })

  const stub_upstream_items = (items) => {
    global.fetch = async () => ({ status: 200, json: async () => ({ items }) })
  }

  it('returns reddit items with link-out fields only', async function () {
    stub_upstream_items([
      {
        title: 'a reddit headline',
        url: 'https://reddit.com/r/nfl/comments/1',
        domain: 'nfl.com',
        published_at: '2026-09-04T16:00:00.000Z',
        source_type: 'reddit',
        author: 'some_username',
        players: [TEST_PID]
      }
    ])

    const res = await chai_request
      .execute(server)
      .get(`/api/players/${TEST_PID}/content`)

    res.should.have.status(200)
    expect(res.body.items).to.have.length(1)
    expect(res.body.items[0]).to.deep.equal({
      title: 'a reddit headline',
      url: 'https://reddit.com/r/nfl/comments/1',
      domain: 'nfl.com',
      published_at: '2026-09-04T16:00:00.000Z'
    })
    // The poster's Reddit username is never republished on league.
    expect(res.body.items[0]).to.not.have.property('author')
  })

  // The control that makes the two filters real. The same page carries one
  // renderable item and two that must be dropped for DIFFERENT reasons, so a
  // filter that passes everything returns 3 and fails, and dropping either
  // filter alone returns 2 and also fails.
  it('drops non-reddit items and titleless items', async function () {
    stub_upstream_items([
      {
        title: 'a reddit headline',
        url: 'https://reddit.com/r/nfl/comments/1',
        domain: 'nfl.com',
        published_at: '2026-09-04T16:00:00.000Z',
        source_type: 'reddit'
      },
      {
        title: null,
        url: 'https://twitter.com/someone/status/1',
        domain: 'twitter.com',
        published_at: '2026-09-04T16:00:00.000Z',
        source_type: 'twitter'
      },
      {
        title: 'a hackernews headline',
        url: 'https://news.ycombinator.com/item?id=1',
        domain: 'news.ycombinator.com',
        published_at: '2026-09-04T16:00:00.000Z',
        source_type: 'hackernews'
      }
    ])

    const res = await chai_request
      .execute(server)
      .get(`/api/players/${TEST_PID}/content`)

    res.should.have.status(200)
    expect(res.body.items).to.have.length(1)
    expect(res.body.items[0].title).to.equal('a reddit headline')
  })

  it('serves an anonymous caller', async function () {
    stub_upstream_items([])

    const res = await chai_request
      .execute(server)
      .get(`/api/players/${TEST_PID}/content`)

    res.should.have.status(200)
    expect(res.body.items).to.deep.equal([])
  })

  // An upstream outage must degrade this section to nothing rather than turn
  // the player page into a 500.
  it('returns 200 with no items when the upstream fails', async function () {
    global.fetch = async () => {
      throw new Error('ECONNREFUSED')
    }

    const res = await chai_request
      .execute(server)
      .get(`/api/players/${TEST_PID}/content`)

    res.should.have.status(200)
    expect(res.body.items).to.deep.equal([])
  })
})
