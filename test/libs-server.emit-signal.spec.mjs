/* global describe, it, beforeEach, afterEach */
import crypto from 'crypto'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { expect } from 'chai'

import emit_signal from '#libs-server/emit-signal.mjs'

const make_fetch_recorder = () => {
  const calls = []
  const fetch_stub = async (url, init = {}) => {
    calls.push({
      url,
      headers: init.headers || {},
      body: init.body ? JSON.parse(init.body) : null
    })
    return { ok: true, status: 200, statusText: 'OK' }
  }
  return { calls, fetch_stub }
}

describe('libs-server/emit-signal', () => {
  let original_base_api_url
  let original_machine_slug
  let original_key_file
  let original_fetch
  let key_dir
  let key_path

  beforeEach(() => {
    original_base_api_url = process.env.BASE_API_URL
    original_machine_slug = process.env.BASE_MACHINE_SLUG
    original_key_file = process.env.BASE_INSTANCE_KEY_FILE
    original_fetch = globalThis.fetch

    key_dir = mkdtempSync(join(tmpdir(), 'emit-signal-spec-'))
    key_path = join(key_dir, 'instance-private.key')
    const { privateKey } = crypto.generateKeyPairSync('ed25519')
    writeFileSync(
      key_path,
      privateKey.export({ format: 'pem', type: 'pkcs8' }),
      { mode: 0o600 }
    )
    process.env.BASE_API_URL = 'http://localhost:9999'
    process.env.BASE_MACHINE_SLUG = 'emit-spec-slug'
    process.env.BASE_INSTANCE_KEY_FILE = key_path
  })

  afterEach(() => {
    for (const [key, value] of [
      ['BASE_API_URL', original_base_api_url],
      ['BASE_MACHINE_SLUG', original_machine_slug],
      ['BASE_INSTANCE_KEY_FILE', original_key_file]
    ]) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    globalThis.fetch = original_fetch
    rmSync(key_dir, { recursive: true, force: true })
  })

  it('POSTs to /api/signals/ with Authorization: Machine token', async () => {
    const { calls, fetch_stub } = make_fetch_recorder()
    globalThis.fetch = fetch_stub
    await emit_signal({
      source: 'unit-test',
      kind: 'test_kind',
      severity: 'low',
      title: 'hello',
      payload: { x: 1 },
      dedup_key: 'k1'
    })
    expect(calls).to.have.lengthOf(1)
    expect(calls[0].url).to.equal('http://localhost:9999/api/signals/')
    expect(calls[0].headers.authorization).to.match(
      /^Machine emit-spec-slug\.\d+\.[A-Za-z0-9_-]+$/
    )
    expect(calls[0].body).to.deep.equal({
      source: 'unit-test',
      kind: 'test_kind',
      severity: 'low',
      title: 'hello',
      payload: { x: 1 },
      dedup_key: 'k1'
    })
  })

  it('no-ops when BASE_API_URL is unset', async () => {
    delete process.env.BASE_API_URL
    const { calls, fetch_stub } = make_fetch_recorder()
    globalThis.fetch = fetch_stub
    await emit_signal({
      source: 'unit-test',
      kind: 'k',
      severity: 'low',
      title: 't'
    })
    expect(calls).to.have.lengthOf(0)
  })

  it('no-ops when BASE_MACHINE_SLUG is unset', async () => {
    delete process.env.BASE_MACHINE_SLUG
    const { calls, fetch_stub } = make_fetch_recorder()
    globalThis.fetch = fetch_stub
    await emit_signal({
      source: 'unit-test',
      kind: 'k',
      severity: 'low',
      title: 't'
    })
    expect(calls).to.have.lengthOf(0)
  })

  it('no-ops when BASE_INSTANCE_KEY_FILE points at a missing file', async () => {
    process.env.BASE_INSTANCE_KEY_FILE = join(key_dir, 'absent')
    const { calls, fetch_stub } = make_fetch_recorder()
    globalThis.fetch = fetch_stub
    await emit_signal({
      source: 'unit-test',
      kind: 'k',
      severity: 'low',
      title: 't'
    })
    expect(calls).to.have.lengthOf(0)
  })

  it('swallows transport failures without throwing', async () => {
    globalThis.fetch = async () => {
      throw new Error('connection refused')
    }
    await emit_signal({
      source: 'unit-test',
      kind: 'k',
      severity: 'low',
      title: 'boom'
    })
  })
})
