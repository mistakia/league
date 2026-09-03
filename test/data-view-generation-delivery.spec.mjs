/* global describe, afterEach, it */

import fs from 'fs'
import os from 'os'
import path from 'path'

import * as chai from 'chai'

import {
  deliver_emission,
  is_generation_environment
} from '#libs-server/data-views/generation/deliver-emission.mjs'
import { describe_drainer_readiness } from '#libs-server/data-views/generation/generation-drainer.mjs'

const expect = chai.expect

// The two ends nobody was holding: the container's push, and whether this host
// should be draining at all.
//
// NODE_ENV IS MOVED DELIBERATELY IN THE FIRST GROUP. The whole design decision
// under test is that delivery is keyed on the ENVIRONMENT rather than on
// whether THREAD_ID happens to be set -- because keying it on THREAD_ID makes a
// missing one mean "nothing to deliver to", so an agent whose environment lost
// it would emit, print ok, exit 0, and produce nothing. The only way to assert
// that is to stand in the generation environment and take the id away.

const with_env = async (values, run) => {
  const previous = {}
  for (const [key, value] of Object.entries(values)) {
    previous[key] = process.env[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  try {
    return await run()
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

const recording_fetch = (response) => {
  const calls = []
  const fetch_impl = async (url, init) => {
    calls.push({ url, init })
    return response
  }
  fetch_impl.calls = calls
  return fetch_impl
}

const ok_response = (body = { generation_id: 'gen-1' }) => ({
  ok: true,
  status: 200,
  json: async () => body,
  text: async () => JSON.stringify(body)
})

const refusing_response = (status, body = 'no live generation') => ({
  ok: false,
  status,
  json: async () => ({}),
  text: async () => body
})

describe('data view generation delivery', function () {
  this.timeout(30 * 1000)

  describe('outside the generation environment', function () {
    it('delivers nothing and does not throw', async function () {
      expect(is_generation_environment()).to.equal(false)
      const fetch_impl = recording_fetch(ok_response())
      const result = await deliver_emission({
        emission: { expressible: true },
        fetch_impl
      })
      expect(result.delivered).to.equal(false)
      expect(fetch_impl.calls).to.have.lengthOf(0)
    })
  })

  describe('inside the generation environment', function () {
    it('refuses by name when THREAD_ID is absent', async function () {
      // THE LOAD-BEARING CASE. Silently skipping delivery here is the failure
      // this module exists to remove, and it fails in the direction that looks
      // like success -- a clean exit over a run that produced nothing.
      await with_env(
        { NODE_ENV: 'sandbox', THREAD_ID: undefined },
        async () => {
          let thrown = null
          try {
            await deliver_emission({
              emission: { expressible: true },
              fetch_impl: recording_fetch(ok_response())
            })
          } catch (error) {
            thrown = error
          }
          expect(thrown).to.not.equal(null)
          expect(thrown.code).to.equal('emission_undeliverable')
        }
      )
    })

    it('posts the envelope under the thread id from its own environment', async function () {
      await with_env(
        { NODE_ENV: 'sandbox', THREAD_ID: 'thread-42' },
        async () => {
          const fetch_impl = recording_fetch(ok_response())
          const emission = { expressible: true, table_state: { columns: [] } }

          const result = await deliver_emission({
            emission,
            tool_calls: ['search_columns'],
            branch: 'registry',
            fetch_impl
          })

          expect(result.delivered).to.equal(true)
          expect(result.generation_id).to.equal('gen-1')
          expect(fetch_impl.calls).to.have.lengthOf(1)

          const [call] = fetch_impl.calls
          expect(call.url).to.match(/\/api\/data-views\/generation-emission$/)
          expect(call.init.method).to.equal('POST')

          const body = JSON.parse(call.init.body)
          // The id comes from the environment, never from the prompt: nothing
          // that authenticates this call transits the thread timeline, which is
          // synced and full-text indexed.
          expect(body.thread_id).to.equal('thread-42')
          expect(body.emission).to.eql(emission)
          expect(body.tool_calls).to.eql(['search_columns'])
        }
      )
    })

    it('fails when league refuses the emission', async function () {
      await with_env(
        { NODE_ENV: 'sandbox', THREAD_ID: 'thread-42' },
        async () => {
          let thrown = null
          try {
            await deliver_emission({
              emission: { expressible: true },
              fetch_impl: recording_fetch(refusing_response(404))
            })
          } catch (error) {
            thrown = error
          }
          expect(thrown).to.not.equal(null)
          expect(thrown.code).to.equal('emission_refused')
        }
      )
    })
  })
})

describe('data view generation drainer readiness', function () {
  const key_path = path.join(os.tmpdir(), 'league-generation-readiness.key')

  afterEach(function () {
    if (fs.existsSync(key_path)) fs.unlinkSync(key_path)
  })

  it('declines without a base rail, and says which half is missing', async function () {
    await with_env({ BASE_API_URL: undefined }, async () => {
      const { ready, reason } = describe_drainer_readiness()
      expect(ready).to.equal(false)
      expect(reason).to.include('BASE_API_URL')
    })
  })

  it('declines when the identity key is not readable, naming the path', async function () {
    await with_env(
      {
        BASE_API_URL: 'http://127.0.0.1:8081',
        LEAGUE_GENERATION_IDENTITY_KEY_FILE: key_path
      },
      async () => {
        const { ready, reason } = describe_drainer_readiness()
        expect(ready).to.equal(false)
        expect(reason).to.include(key_path)
      }
    )
  })

  it('is ready when both halves are present', async function () {
    // The positive control. Without it the two refusals above could both be
    // passing on a gate that never says yes to anything.
    fs.writeFileSync(key_path, 'a'.repeat(64), { mode: 0o600 })
    await with_env(
      {
        BASE_API_URL: 'http://127.0.0.1:8081',
        LEAGUE_GENERATION_IDENTITY_KEY_FILE: key_path
      },
      async () => {
        expect(describe_drainer_readiness().ready).to.equal(true)
      }
    )
  })
})
