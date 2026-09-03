/* global describe it */
import * as chai from 'chai'

import {
  describe_redis_readiness,
  assert_redis_configured,
  REDIS_HOST_ENV,
  REDIS_PORT_ENV
} from '#libs-server/redis_adapter.mjs'

const expect = chai.expect

// The defect these cover: redis_adapter used to construct its client only when
// os.hostname() equalled the literal 'league-production'. Every adapter method
// short-circuits on a null client and returns a success-shaped value, and the
// console.warn calls sit in catch blocks a null client never reaches -- so on
// any other host the result cache, the data_view_sql:enabled kill switch and
// all three generation spend limits failed OPEN with no log line at all.
//
// What is asserted here is the replacement's two halves: configuration is read
// from the environment rather than inferred from a machine name, and a
// production process missing it REFUSES rather than degrading quietly.

describe('redis adapter configuration', function () {
  describe('describe_redis_readiness', function () {
    it('is unconfigured when the host variable is unset', () => {
      const readiness = describe_redis_readiness({})
      expect(readiness.configured).to.equal(false)
      expect(readiness.reason).to.include(REDIS_HOST_ENV)
    })

    it('is unconfigured when the host variable is blank', () => {
      expect(
        describe_redis_readiness({ [REDIS_HOST_ENV]: '   ' }).configured
      ).to.equal(false)
    })

    it('defaults the port to 6379', () => {
      const readiness = describe_redis_readiness({
        [REDIS_HOST_ENV]: '127.0.0.1'
      })
      expect(readiness).to.deep.equal({
        configured: true,
        host: '127.0.0.1',
        port: 6379
      })
    })

    it('takes an explicit port as a number', () => {
      const readiness = describe_redis_readiness({
        [REDIS_HOST_ENV]: '127.0.0.1',
        [REDIS_PORT_ENV]: '6380'
      })
      expect(readiness.port).to.equal(6380)
    })

    // A non-numeric port must not fall back to the default. Connecting to 6379
    // when someone wrote 'six thousand' is the same class of quiet wrong answer
    // the hostname allowlist was.
    it('refuses a port that is not a port number', () => {
      for (const bad of ['abc', '0', '-1', '70000', '6379.5']) {
        const readiness = describe_redis_readiness({
          [REDIS_HOST_ENV]: '127.0.0.1',
          [REDIS_PORT_ENV]: bad
        })
        expect(readiness.configured, `port ${bad}`).to.equal(false)
        expect(readiness.reason, `port ${bad}`).to.include(REDIS_PORT_ENV)
      }
    })

    // The whole point of the change: no machine name decides this.
    it('does not consult the hostname', () => {
      expect(
        describe_redis_readiness({ HOSTNAME: 'league-production' }).configured
      ).to.equal(false)
    })
  })

  describe('assert_redis_configured', function () {
    it('throws in production when the host variable is unset', () => {
      expect(() =>
        assert_redis_configured({ is_production: true, env: {} })
      ).to.throw(REDIS_HOST_ENV)
    })

    // Naming the three controls in the message is deliberate: the failure this
    // replaced was invisible precisely because nothing said what was lost.
    it('names what fails open, so the message is actionable', () => {
      let message = ''
      try {
        assert_redis_configured({ is_production: true, env: {} })
      } catch (error) {
        message = error.message
      }
      expect(message).to.include('data_view_sql:enabled')
      expect(message).to.include('spend limits')
    })

    it('passes in production when the host variable is set', () => {
      expect(() =>
        assert_redis_configured({
          is_production: true,
          env: { [REDIS_HOST_ENV]: '127.0.0.1' }
        })
      ).to.not.throw()
    })

    // Dev, test and the sandbox have no Redis and are not meant to. Only the
    // API process asserts, and only in production.
    it('is a no-op outside production', () => {
      expect(() =>
        assert_redis_configured({ is_production: false, env: {} })
      ).to.not.throw()
    })
  })
})
