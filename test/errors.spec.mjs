/* global describe it beforeEach afterEach */
import crypto from 'crypto'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

import express from 'express'
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'

import config from '#config'
import errors_router, {
  is_non_actionable_client_error
} from '#api/routes/errors.mjs'

chai.use(chai_http)
const expect = chai.expect

const GOOGLEBOT_UA =
  'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.7778.96 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
const REAL_USER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

describe('api/errors - is_non_actionable_client_error', function () {
  it('suppresses known crawler user-agents regardless of error', function () {
    expect(
      is_non_actionable_client_error({
        error_class: 'SyntaxError',
        message: "Expected ',' or '}' after property value in JSON",
        user_agent: GOOGLEBOT_UA
      })
    ).to.equal(true)
  })

  it('suppresses reports with no error message (empty/malformed POSTs)', function () {
    expect(
      is_non_actionable_client_error({
        error_class: 'Error',
        message: undefined,
        user_agent: REAL_USER_UA
      })
    ).to.equal(true)
  })

  it('suppresses ChunkLoadError (stale-client, handled client-side)', function () {
    expect(
      is_non_actionable_client_error({
        error_class: 'ChunkLoadError',
        message: 'Loading CSS chunk 6900 failed.',
        user_agent: REAL_USER_UA
      })
    ).to.equal(true)
  })

  it("suppresses 'Failed to fetch' client network/abort conditions", function () {
    expect(
      is_non_actionable_client_error({
        error_class: 'TypeError',
        message: 'Failed to fetch',
        user_agent: REAL_USER_UA
      })
    ).to.equal(true)
  })

  it('emits a genuine app error from a real user', function () {
    expect(
      is_non_actionable_client_error({
        error_class: 'TypeError',
        message: "Cannot read properties of undefined (reading 'map')",
        user_agent: REAL_USER_UA
      })
    ).to.equal(false)
  })

  it('emits a real SyntaxError from a real user', function () {
    expect(
      is_non_actionable_client_error({
        error_class: 'SyntaxError',
        message: 'Unexpected token < in JSON at position 0',
        user_agent: REAL_USER_UA
      })
    ).to.equal(false)
  })
})

// Route-level coverage of POST /api/errors: drives the handler with chai-http
// and captures the downstream signal emit by stubbing globalThis.fetch (the
// transport create_logger uses). Mirrors the machine-key setup in
// test/libs-shared.log.spec.mjs so the emit guards in log.mjs pass.
describe('api/errors - POST route emission', function () {
  this.timeout(30 * 1000)

  let app
  let calls
  let key_dir
  let original_signals_api_url
  let original_machine_slug
  let original_key_file
  let original_fetch

  beforeEach(() => {
    original_signals_api_url = config.signals_api_url
    original_machine_slug = process.env.BASE_MACHINE_SLUG
    original_key_file = process.env.BASE_INSTANCE_KEY_FILE
    original_fetch = globalThis.fetch
    config.signals_api_url = 'http://localhost:9999'

    key_dir = mkdtempSync(join(tmpdir(), 'errors-spec-'))
    const key_path = join(key_dir, 'instance-private.key')
    const { privateKey } = crypto.generateKeyPairSync('ed25519')
    writeFileSync(
      key_path,
      privateKey.export({ format: 'pem', type: 'pkcs8' }),
      { mode: 0o600 }
    )
    process.env.BASE_MACHINE_SLUG = 'unit-test-slug'
    process.env.BASE_INSTANCE_KEY_FILE = key_path

    calls = []
    globalThis.fetch = async (url, init = {}) => {
      calls.push({ url, body: init.body ? JSON.parse(init.body) : null })
      return { ok: true, status: 200, json: async () => ({}) }
    }

    app = express()
    app.use(express.json())
    app.locals.logger = () => {}
    app.use('/api/errors', errors_router)
  })

  afterEach(() => {
    config.signals_api_url = original_signals_api_url
    if (original_machine_slug === undefined) {
      delete process.env.BASE_MACHINE_SLUG
    } else {
      process.env.BASE_MACHINE_SLUG = original_machine_slug
    }
    if (original_key_file === undefined) {
      delete process.env.BASE_INSTANCE_KEY_FILE
    } else {
      process.env.BASE_INSTANCE_KEY_FILE = original_key_file
    }
    globalThis.fetch = original_fetch
    rmSync(key_dir, { recursive: true, force: true })
  })

  // The route fires the emit fetch in a microtask and responds without
  // awaiting it; give that microtask a tick to run before asserting.
  const flush = () => new Promise((resolve) => setTimeout(resolve, 10))

  it('carries request_url and a dedup_key into the emitted signal for a real-user error', async () => {
    const request_url = 'https://xo.football/api/leagues/2/seasons/2024'
    const res = await chai_request
      .execute(app)
      .post('/api/errors')
      .set('User-Agent', REAL_USER_UA)
      .send({
        leagueId: 2,
        error: {
          name: 'TypeError',
          message: "Cannot read properties of undefined (reading 'map')",
          request_url
        }
      })
    expect(res.status).to.equal(200)
    await flush()

    expect(calls).to.have.lengthOf(1)
    expect(calls[0].url).to.equal('http://localhost:9999/api/signals')
    const body = calls[0].body
    expect(body.kind).to.equal('log_error')
    expect(body.source).to.equal('league-client')
    expect(body.payload.context.request_url).to.equal(request_url)
    expect(body.dedup_key).to.equal(
      `log_error:league-client:${body.payload.error_fingerprint}`
    )
  })

  it('does not emit a signal for a crawler report (gate suppresses before emit)', async () => {
    const res = await chai_request
      .execute(app)
      .post('/api/errors')
      .set('User-Agent', GOOGLEBOT_UA)
      .send({
        error: {
          name: 'TypeError',
          message: 'Failed to fetch',
          request_url: 'https://xo.football/api/leagues/2/seasons/2024'
        }
      })
    expect(res.status).to.equal(200)
    await flush()

    expect(calls).to.have.lengthOf(0)
  })
})
