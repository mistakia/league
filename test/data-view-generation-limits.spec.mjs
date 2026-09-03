/* global describe, beforeEach, it */

import * as chai from 'chai'

import {
  assert_generation_admissible,
  is_generation_enabled,
  record_generation_spend,
  MAX_GENERATIONS_PER_WINDOW,
  MAX_TOKENS_PER_JOB,
  MAX_TOKENS_PER_WINDOW
} from '#libs-server/data-views/generation/generation-limits.mjs'

process.env.NODE_ENV = 'test'

const expect = chai.expect

// What bounds how much a caller may SPEND, as opposed to how long they wait.
//
// THE CACHE IS A FAKE AND THAT IS THE RIGHT BOUNDARY. What is under test is the
// arithmetic and the refusal codes, not whether Redis stores a key -- and a
// real Redis would make every case here depend on a service that is allowed to
// be absent, which is precisely the condition the kill switch's fail-OPEN
// default exists to handle.

const fake_cache = (initial = {}) => {
  const store = new Map(Object.entries(initial))
  return {
    store,
    cache_get: async (key) => store.get(key) ?? null,
    cache_set: async (key, value) => {
      store.set(key, value)
    }
  }
}

const admit = (cache, principal_key = 'user:1') =>
  assert_generation_admissible({
    principal_key,
    cache_get: cache.cache_get,
    cache_set: cache.cache_set
  })

const refusal_from = async (promise) => {
  try {
    await promise
    return null
  } catch (error) {
    return error
  }
}

describe('data view generation limits', function () {
  beforeEach(function () {
    delete process.env.LEAGUE_DATA_VIEW_GENERATION_DISABLED
  })

  describe('the kill switch', function () {
    it('is ON when nothing has been switched off', async function () {
      // Absence means enabled, deliberately: redis_cache.get returns null both
      // for an unset key and for an unreachable Redis, so treating them alike
      // would let a Redis blip silently disable a feature nobody switched off.
      const cache = fake_cache()
      expect(
        await is_generation_enabled({ cache_get: cache.cache_get })
      ).to.equal(true)
    })

    it('is OFF when the redis key says so', async function () {
      const cache = fake_cache({
        'data_view_generation:enabled': { enabled: false }
      })
      expect(
        await is_generation_enabled({ cache_get: cache.cache_get })
      ).to.equal(false)
    })

    it('is OFF from the environment even when redis says nothing', async function () {
      // The control that still works when Redis is down. It costs a restart,
      // which is the trade.
      process.env.LEAGUE_DATA_VIEW_GENERATION_DISABLED = '1'
      const cache = fake_cache()
      expect(
        await is_generation_enabled({ cache_get: cache.cache_get })
      ).to.equal(false)
    })

    it('refuses admission by name while off', async function () {
      const cache = fake_cache({
        'data_view_generation:enabled': { enabled: false }
      })
      const error = await refusal_from(admit(cache))
      expect(error?.code).to.equal('generation_disabled')
    })
  })

  describe('the rate limit', function () {
    it('admits up to the limit and refuses past it', async function () {
      const cache = fake_cache()
      for (let i = 0; i < MAX_GENERATIONS_PER_WINDOW; i++) {
        // The positive control runs first, and it is not decoration: without
        // it a limiter that refused everything would pass the refusal case
        // below.
        // eslint-disable-next-line no-await-in-loop
        expect(
          await refusal_from(admit(cache)),
          `run ${i + 1} was refused`
        ).to.equal(null)
      }

      const error = await refusal_from(admit(cache))
      expect(error?.code).to.equal('generation_rate_limited')
      expect(error?.max_runs).to.equal(MAX_GENERATIONS_PER_WINDOW)
    })

    it('counts each principal separately', async function () {
      // The limiter keys on the principal, so one heavy account must not
      // refuse everybody else. This is also the property that lets the
      // anonymous branch open later without re-keying anything.
      const cache = fake_cache()
      for (let i = 0; i < MAX_GENERATIONS_PER_WINDOW; i++) {
        // eslint-disable-next-line no-await-in-loop
        await admit(cache, 'user:1')
      }
      expect(await refusal_from(admit(cache, 'user:1'))).to.not.equal(null)
      expect(await refusal_from(admit(cache, 'user:2'))).to.equal(null)
      expect(await refusal_from(admit(cache, 'ip:203.0.113.9'))).to.equal(null)
    })
  })

  describe('the token budget', function () {
    it('refuses a principal that has spent its window budget', async function () {
      const cache = fake_cache({
        'data_view_generation:spend:user:1': { count: MAX_TOKENS_PER_WINDOW }
      })
      const error = await refusal_from(admit(cache))
      expect(error?.code).to.equal('generation_budget_exhausted')
    })

    it('charges a finished run against its principal', async function () {
      const cache = fake_cache()
      await record_generation_spend({
        principal_key: 'user:1',
        total_tokens: 1000,
        cache_get: cache.cache_get,
        cache_set: cache.cache_set
      })
      expect(cache.store.get('data_view_generation:spend:user:1')).to.eql({
        count: 1000
      })
    })

    // THE PER-JOB CEILING, and the load-bearing half is what it does NOT do.
    it('does not charge an oversized job against the window budget', async function () {
      const cache = fake_cache()
      const result = await record_generation_spend({
        principal_key: 'user:1',
        total_tokens: MAX_TOKENS_PER_JOB + 1,
        cache_get: cache.cache_get,
        cache_set: cache.cache_set
      })

      expect(result.over_job_ceiling).to.equal(true)
      expect(result.charged).to.equal(0)
      // Nothing was written, so one runaway loop cannot lock its author out of
      // generation for the rest of the hour on a single bad instruction.
      expect(cache.store.has('data_view_generation:spend:user:1')).to.equal(
        false
      )
      // ... and the caller is admitted immediately afterwards, which is the
      // point of not charging it.
      expect(await refusal_from(admit(cache))).to.equal(null)
    })

    it('ignores a run whose cost is unknown', async function () {
      // The collector reports null when base's thread carried no counters.
      // Charging null as zero would be fine; charging it as anything else
      // would invent a number.
      const cache = fake_cache()
      const result = await record_generation_spend({
        principal_key: 'user:1',
        total_tokens: null,
        cache_get: cache.cache_get,
        cache_set: cache.cache_set
      })
      expect(result.charged).to.equal(0)
      expect(cache.store.size).to.equal(0)
    })
  })
})
