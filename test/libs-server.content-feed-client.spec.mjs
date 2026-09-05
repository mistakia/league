/* global describe before after it */
import * as chai from 'chai'

import config from '#config'
import {
  get_player_content_feed_items,
  is_enabled,
  NFL_CONTENT_TAG_URIS
} from '#libs-server/content-feed-client.mjs'

const expect = chai.expect

const TEST_BASE_URL = 'https://content-feed.test'
const TEST_PID = 'ALVI-KAMA-015215'

// The client's whole contract is that it NEVER throws, so every case here is
// about a failure mode rather than the happy path. Each stub replaces global
// fetch; the happy-path case exists mainly as the control that proves the
// others are failing for the reason claimed rather than because the client is
// inert.
describe('libs-server content-feed-client', function () {
  const original_fetch = global.fetch
  const original_config = config.content_feed_api

  before(function () {
    config.content_feed_api = { base_url: TEST_BASE_URL }
  })

  after(function () {
    global.fetch = original_fetch
    config.content_feed_api = original_config
  })

  it('returns items on a 200', async function () {
    global.fetch = async () => ({
      status: 200,
      json: async () => ({ items: [{ title: 'a headline', url: 'https://x' }] })
    })

    const { items } = await get_player_content_feed_items({
      pid: TEST_PID,
      tag_uris: NFL_CONTENT_TAG_URIS
    })

    expect(items).to.have.length(1)
    expect(items[0].title).to.equal('a headline')
  })

  it('sends the pid and the tag set upstream', async function () {
    let requested_url = null
    global.fetch = async (url) => {
      requested_url = url
      return { status: 200, json: async () => ({ items: [] }) }
    }

    await get_player_content_feed_items({
      pid: TEST_PID,
      tag_uris: NFL_CONTENT_TAG_URIS
    })

    expect(requested_url.pathname).to.equal('/api/content-feed/items')
    expect(requested_url.searchParams.get('player_ids')).to.equal(TEST_PID)
    expect(requested_url.searchParams.get('tag_uris')).to.equal(
      NFL_CONTENT_TAG_URIS.join(',')
    )
  })

  it('returns empty on a non-200', async function () {
    global.fetch = async () => ({ status: 503, json: async () => ({}) })

    const { items } = await get_player_content_feed_items({
      pid: TEST_PID,
      tag_uris: NFL_CONTENT_TAG_URIS
    })

    expect(items).to.deep.equal([])
  })

  // 202 is inside the 2xx range, so a client gating on `response.ok` would
  // treat this as success and then read an items array that is not there.
  it('returns empty on a 202', async function () {
    global.fetch = async () => ({ status: 202, json: async () => ({}) })

    const { items } = await get_player_content_feed_items({
      pid: TEST_PID,
      tag_uris: NFL_CONTENT_TAG_URIS
    })

    expect(items).to.deep.equal([])
  })

  it('returns empty when the body carries no items array', async function () {
    global.fetch = async () => ({
      status: 200,
      json: async () => ({ unexpected: true })
    })

    const { items } = await get_player_content_feed_items({
      pid: TEST_PID,
      tag_uris: NFL_CONTENT_TAG_URIS
    })

    expect(items).to.deep.equal([])
  })

  it('returns empty when the network throws', async function () {
    global.fetch = async () => {
      throw new Error('ECONNREFUSED')
    }

    const { items } = await get_player_content_feed_items({
      pid: TEST_PID,
      tag_uris: NFL_CONTENT_TAG_URIS
    })

    expect(items).to.deep.equal([])
  })

  // Exercised by hanging the fetch on the abort signal the client passes, so
  // the timeout is proven to FIRE. Asserting that the option was set would be
  // reading the source rather than executing the behavior.
  it('returns empty when the request times out', async function () {
    global.fetch = async (url, { signal }) =>
      new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason))
      })

    const { items } = await get_player_content_feed_items({
      pid: TEST_PID,
      tag_uris: NFL_CONTENT_TAG_URIS
    })

    expect(items).to.deep.equal([])
  })

  it('is disabled, and makes no request, without a base url', async function () {
    config.content_feed_api = undefined
    let called = false
    global.fetch = async () => {
      called = true
      return { status: 200, json: async () => ({ items: [] }) }
    }

    expect(is_enabled()).to.equal(false)

    const { items } = await get_player_content_feed_items({
      pid: TEST_PID,
      tag_uris: NFL_CONTENT_TAG_URIS
    })

    expect(items).to.deep.equal([])
    expect(called).to.equal(false)

    config.content_feed_api = { base_url: TEST_BASE_URL }
  })
})
