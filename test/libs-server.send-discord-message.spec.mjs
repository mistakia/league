/* global describe it beforeEach afterEach */

import * as chai from 'chai'

import send_discord_message from '#libs-server/send-discord-message.mjs'

chai.should()
const expect = chai.expect

const WEBHOOK = 'https://discord.com/api/webhooks/1/token'

describe('libs-server - send discord message', function () {
  let original_fetch
  let original_node_env

  beforeEach(() => {
    original_fetch = globalThis.fetch
    original_node_env = process.env.NODE_ENV
    // The module no-ops outside production, so the reporting contract is only
    // observable with the environment it actually ships under.
    process.env.NODE_ENV = 'production'
  })

  afterEach(() => {
    globalThis.fetch = original_fetch
    process.env.NODE_ENV = original_node_env
  })

  it('reports a delivered message', async () => {
    globalThis.fetch = async () => ({ ok: true, status: 204 })

    const result = await send_discord_message({
      discord_webhook_url: WEBHOOK,
      message: 'hello'
    })

    expect(result.is_sent).to.equal(true)
  })

  // fetch RESOLVES a 404, so a caller that only awaits the send cannot tell a
  // delivered message from one Discord threw away. This is the assertion that
  // keeps a lost announcement from being recorded as delivered.
  it('reports a refusal rather than resolving it as success', async () => {
    globalThis.fetch = async () => ({ ok: false, status: 404 })

    const result = await send_discord_message({
      discord_webhook_url: WEBHOOK,
      message: 'hello'
    })

    expect(result.is_sent).to.equal(false)
  })

  it('reports not-sent without calling fetch when no webhook is configured', async () => {
    let was_called = false
    globalThis.fetch = async () => {
      was_called = true
      return { ok: true, status: 204 }
    }

    const result = await send_discord_message({
      discord_webhook_url: null,
      message: 'hello'
    })

    expect(result.is_sent).to.equal(false)
    expect(was_called).to.equal(false)
  })

  it('reports not-sent outside production', async () => {
    process.env.NODE_ENV = 'test'
    let was_called = false
    globalThis.fetch = async () => {
      was_called = true
      return { ok: true, status: 204 }
    }

    const result = await send_discord_message({
      discord_webhook_url: WEBHOOK,
      message: 'hello'
    })

    expect(result.is_sent).to.equal(false)
    expect(was_called).to.equal(false)
  })
})
