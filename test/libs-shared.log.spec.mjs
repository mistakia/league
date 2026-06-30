/* global describe, it, beforeEach, afterEach */
import crypto from 'crypto'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { expect } from 'chai'

import config from '#config'
import {
  create_logger,
  compute_fingerprint,
  normalize_fingerprint_input
} from '#libs-shared/log.mjs'

const make_fetch_recorder = () => {
  const calls = []
  const fetch_stub = async (url, init = {}) => {
    calls.push({
      url,
      headers: init.headers || {},
      body: init.body ? JSON.parse(init.body) : null,
      method: init.method,
      signal: init.signal || null
    })
    return { ok: true, status: 200, json: async () => ({}) }
  }
  return { calls, fetch_stub }
}

describe('libs-shared/log', function () {
  let original_signals_api_url
  let original_log_error
  let original_service_env
  let original_machine_slug
  let original_key_file
  let original_fetch
  let key_dir
  let key_path

  beforeEach(() => {
    original_signals_api_url = config.signals_api_url
    original_log_error = config.log_error
    original_service_env = process.env.SERVICE_NAME
    original_machine_slug = process.env.BASE_MACHINE_SLUG
    original_key_file = process.env.BASE_INSTANCE_KEY_FILE
    original_fetch = globalThis.fetch
    config.signals_api_url = 'http://localhost:9999'

    key_dir = mkdtempSync(join(tmpdir(), 'log-spec-'))
    key_path = join(key_dir, 'instance-private.key')
    const { privateKey } = crypto.generateKeyPairSync('ed25519')
    writeFileSync(
      key_path,
      privateKey.export({ format: 'pem', type: 'pkcs8' }),
      { mode: 0o600 }
    )
    process.env.BASE_MACHINE_SLUG = 'unit-test-slug'
    process.env.BASE_INSTANCE_KEY_FILE = key_path
  })

  afterEach(() => {
    config.signals_api_url = original_signals_api_url
    config.log_error = original_log_error
    if (original_service_env === undefined) {
      delete process.env.SERVICE_NAME
    } else {
      process.env.SERVICE_NAME = original_service_env
    }
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

  describe('compute_fingerprint', () => {
    it('produces stable output across line-number and timestamp variation', () => {
      const a = compute_fingerprint({
        error_class: 'TypeError',
        message: 'Cannot read x of undefined at /tmp/foo.mjs:42:11'
      })
      const b = compute_fingerprint({
        error_class: 'TypeError',
        message: 'Cannot read x of undefined at /var/log/bar.mjs:9001:3'
      })
      expect(a).to.equal(b)
    })

    it('differs when error_class differs', () => {
      const a = compute_fingerprint({
        error_class: 'TypeError',
        message: 'boom'
      })
      const b = compute_fingerprint({
        error_class: 'RangeError',
        message: 'boom'
      })
      expect(a).to.not.equal(b)
    })

    it('normalizes timestamps, uuids, and numeric literals', () => {
      const normalized = normalize_fingerprint_input(
        'failed at 2026-05-21T12:34:56.789Z for request a1b2c3d4-e5f6-4789-9abc-def012345678 row 12345'
      )
      expect(normalized).to.include('<ts>')
      expect(normalized).to.include('<uuid>')
      expect(normalized).to.include('<n>')
    })
  })

  describe('create_logger', () => {
    it('plain calls passthrough to debug without POSTing', async () => {
      const { calls, fetch_stub } = make_fetch_recorder()
      globalThis.fetch = fetch_stub
      const log = create_logger('test:plain', { service: 'unit-test' })
      log('hello %s', 'world')
      await Promise.resolve()
      expect(calls).to.have.lengthOf(0)
    })

    it('.error POSTs a log_error signal with default severity low', async () => {
      const { calls, fetch_stub } = make_fetch_recorder()
      globalThis.fetch = fetch_stub
      const log = create_logger('test:err', { service: 'unit-test' })

      const result = log.error('something blew up', {
        context: { request_id: 'r1' }
      })
      await result.promise

      expect(calls).to.have.lengthOf(1)
      const call = calls[0]
      expect(call.url).to.equal('http://localhost:9999/api/signals')
      expect(call.headers.authorization).to.match(
        /^Machine unit-test-slug\.\d+\.[A-Za-z0-9_-]+$/
      )
      expect(call.body.kind).to.equal('log_error')
      expect(call.body.severity).to.equal('low')
      expect(call.body.source).to.equal('unit-test')
      expect(call.body.payload.service).to.equal('unit-test')
      expect(call.body.payload.namespace).to.equal('test:err')
      expect(call.body.payload.error_class).to.equal('Error')
      expect(call.body.payload.error_fingerprint).to.be.a('string')
      expect(call.body.payload.context.request_id).to.equal('r1')
      expect(call.body.title).to.match(/^Error: something blew up/)
      // dedup_key collapses recurrences of the same (service, fingerprint);
      // must match the canonical log_error template in emit-signal.mjs.
      expect(call.body.dedup_key).to.equal(
        `log_error:unit-test:${call.body.payload.error_fingerprint}`
      )
    })

    it('.error accepts severity override and an Error instance', async () => {
      const { calls, fetch_stub } = make_fetch_recorder()
      globalThis.fetch = fetch_stub
      const log = create_logger('test:err', { service: 'unit-test' })

      const error = new TypeError('cannot read prop foo of undefined')
      const result = log.error(error, { severity: 'high' })
      await result.promise

      expect(calls).to.have.lengthOf(1)
      const call = calls[0]
      expect(call.body.severity).to.equal('high')
      expect(call.body.payload.error_class).to.equal('TypeError')
      expect(call.body.payload.context.stack).to.be.a('string')
    })

    it('suppressed fingerprints short-circuit the POST', async () => {
      const { calls, fetch_stub } = make_fetch_recorder()
      globalThis.fetch = fetch_stub

      const fingerprint = compute_fingerprint({
        error_class: 'Error',
        message: 'silenced thing'
      })
      config.log_error = {
        suppress_fingerprints: { 'unit-test': [fingerprint] }
      }
      const log = create_logger('test:suppress', { service: 'unit-test' })

      const result = log.error('silenced thing')
      expect(result).to.equal(null)
      await Promise.resolve()
      expect(calls).to.have.lengthOf(0)
    })

    it('suppress_fingerprints as a plain array suppresses globally', async () => {
      const { calls, fetch_stub } = make_fetch_recorder()
      globalThis.fetch = fetch_stub

      const fingerprint = compute_fingerprint({
        error_class: 'Error',
        message: 'global silence'
      })
      config.log_error = { suppress_fingerprints: [fingerprint] }
      const log = create_logger('test:suppress-global', { service: 'whatever' })

      const result = log.error('global silence')
      expect(result).to.equal(null)
      await Promise.resolve()
      expect(calls).to.have.lengthOf(0)
    })

    it('is a no-op when signals_api_url is not configured', () => {
      config.signals_api_url = undefined
      const log = create_logger('test:no-url', { service: 'unit-test' })
      const result = log.error('boom')
      expect(result).to.equal(null)
    })

    it('is a no-op when BASE_MACHINE_SLUG is unset', () => {
      delete process.env.BASE_MACHINE_SLUG
      const log = create_logger('test:no-slug', { service: 'unit-test' })
      const result = log.error('boom')
      expect(result).to.equal(null)
    })

    it('is a no-op when BASE_INSTANCE_KEY_FILE is unset', () => {
      delete process.env.BASE_INSTANCE_KEY_FILE
      const log = create_logger('test:no-key', { service: 'unit-test' })
      const result = log.error('boom')
      expect(result).to.equal(null)
    })

    it('is a no-op when the key file does not exist on disk', () => {
      process.env.BASE_INSTANCE_KEY_FILE = join(key_dir, 'absent-key')
      const log = create_logger('test:missing-key', { service: 'unit-test' })
      const result = log.error('boom')
      expect(result).to.equal(null)
    })

    it('coerces unknown severity to medium', async () => {
      const { calls, fetch_stub } = make_fetch_recorder()
      globalThis.fetch = fetch_stub
      const log = create_logger('test:bad-sev', { service: 'unit-test' })
      const result = log.error('x', { severity: 'urgent' })
      await result.promise
      expect(calls[0].body.severity).to.equal('medium')
    })

    it('honors fingerprint_override', async () => {
      const { calls, fetch_stub } = make_fetch_recorder()
      globalThis.fetch = fetch_stub
      const log = create_logger('test:fpo', { service: 'unit-test' })
      const result = log.error('whatever', {
        fingerprint_override: 'custom-fp'
      })
      await result.promise
      expect(calls[0].body.payload.error_fingerprint).to.equal('custom-fp')
    })

    it('swallows transport failures without throwing to the caller', async () => {
      globalThis.fetch = async () => {
        throw new Error('connection refused')
      }
      const log = create_logger('test:transport-fail', { service: 'unit-test' })
      const result = log.error('boom')
      await result.promise
      expect(result.body.kind).to.equal('log_error')
    })

    it('attaches an AbortSignal to the fetch call', async () => {
      const { calls, fetch_stub } = make_fetch_recorder()
      globalThis.fetch = fetch_stub
      const log = create_logger('test:abort', { service: 'unit-test' })
      const result = log.error('check abort')
      await result.promise
      expect(calls[0].signal).to.not.equal(null)
    })
  })
})
