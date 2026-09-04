/* global describe it */
import * as chai from 'chai'

import {
  PROGRESS_TTL_SECONDS,
  progress_key,
  read_generation_progress,
  record_generation_progress
} from '#libs-server/data-views/generation/generation-progress.mjs'
import { report_progress } from '#libs-server/data-views/generation/report-progress.mjs'
import { name_tool_failure } from '#libs-server/data-views/generation/agent-tool-runner.mjs'

process.env.NODE_ENV = 'test'

const expect = chai.expect

// The progress channel: what the panel shows while a run is still running.
//
// The cache is INJECTED rather than mocked at the module boundary, because
// every function here takes its accessors as parameters for exactly this
// reason. Redis itself is not under test — its adapter already no-ops when
// unconfigured, and a spec that needed a live Redis would be skipped on the
// runner and prove nothing.

const fake_cache = () => {
  const store = new Map()
  return {
    store,
    get: async (key) => (store.has(key) ? store.get(key).value : null),
    set: async (key, value, ttl) => {
      store.set(key, { value, ttl })
    }
  }
}

describe('data view generation progress', function () {
  describe('recording', function () {
    it('counts up across calls and carries the current tool', async function () {
      const cache = fake_cache()
      const record = (tool) =>
        record_generation_progress({
          generation_id: 'g1',
          tool,
          cache_get: cache.get,
          cache_set: cache.set
        })

      expect(await record('search_columns')).to.include({
        step_count: 1,
        tool: 'search_columns'
      })
      expect(await record('describe_column')).to.include({
        step_count: 2,
        tool: 'describe_column'
      })
      expect(await record('preview_view')).to.include({
        step_count: 3,
        tool: 'preview_view'
      })
    })

    it('EXPIRES, so a finished run leaves nothing behind', async function () {
      // The whole argument for keeping progress out of the job row is that it
      // is worthless once the run ends. A record written without a TTL would
      // quietly make it permanent state after all.
      const cache = fake_cache()
      await record_generation_progress({
        generation_id: 'g1',
        tool: 'emit',
        cache_get: cache.get,
        cache_set: cache.set
      })
      const entry = cache.store.get(progress_key('g1'))
      expect(entry.ttl).to.equal(PROGRESS_TTL_SECONDS)
      expect(PROGRESS_TTL_SECONDS).to.be.greaterThan(15 * 60)
    })

    it('keys each run separately', async function () {
      const cache = fake_cache()
      const record = (generation_id) =>
        record_generation_progress({
          generation_id,
          tool: 'search_columns',
          cache_get: cache.get,
          cache_set: cache.set
        })
      await record('g1')
      await record('g1')
      expect(await record('g2')).to.include({ step_count: 1 })
    })
  })

  describe('reading', function () {
    it('is null for a run that has called no tool, not zero', async function () {
      // Null and 0 render differently: null is "nothing to show yet" and 0
      // would be a step the agent never took.
      const cache = fake_cache()
      const progress = await read_generation_progress({
        generation_id: 'never-ran',
        cache_get: cache.get
      })
      expect(progress).to.equal(null)
    })

    it('is null rather than throwing when the cache is unreachable', async function () {
      // redis_cache.get swallows its own errors and answers null; this asserts
      // the caller treats that as absence rather than propagating it into a
      // socket frame.
      const progress = await read_generation_progress({
        generation_id: 'g1',
        cache_get: async () => null
      })
      expect(progress).to.equal(null)
    })
  })

  describe('the container beacon', function () {
    it('does not report outside the generation environment', async function () {
      // Guards the operator running a tool by hand, where posting would record
      // a step against somebody else's live run.
      let called = false
      const result = await report_progress({
        tool: 'search_columns',
        fetch_impl: async () => {
          called = true
          return { ok: true }
        }
      })
      expect(called).to.equal(false)
      expect(result.reported).to.equal(false)
    })

    it('swallows a failed post rather than failing the tool', async function () {
      const previous_env = process.env.NODE_ENV
      const previous_thread = process.env.THREAD_ID
      process.env.NODE_ENV = 'sandbox'
      process.env.THREAD_ID = 't1'
      try {
        const result = await report_progress({
          tool: 'preview_view',
          fetch_impl: async () => {
            throw new Error('connect ECONNREFUSED')
          }
        })
        expect(result.reported).to.equal(false)
        expect(result.reason).to.match(/ECONNREFUSED/)
      } finally {
        process.env.NODE_ENV = previous_env
        if (previous_thread === undefined) delete process.env.THREAD_ID
        else process.env.THREAD_ID = previous_thread
      }
    })
  })

  describe('naming a tool failure', function () {
    it('renames the misleading knex pool message', async function () {
      const named = name_tool_failure(
        new Error(
          'Timeout acquiring a connection. The pool is probably full. Are you missing a .transacting(trx) call?'
        )
      )
      expect(named.code).to.equal('sandbox_database_unreachable')
      expect(named.message).to.match(/not.*busy pool|NOT a busy pool/)
      expect(named.message).to.match(/will not clear by retrying/)
    })

    it('leaves every other failure alone', async function () {
      const error = new Error('column does not exist')
      error.code = 'unknown_parameter'
      expect(name_tool_failure(error)).to.deep.equal({
        code: 'unknown_parameter',
        message: 'column does not exist'
      })
    })
  })
})
