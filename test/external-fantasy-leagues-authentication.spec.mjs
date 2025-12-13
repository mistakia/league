/* global describe, it, after, beforeEach, afterEach */
import * as chai from 'chai'
import { platform_authenticator } from '#libs-server/external-fantasy-leagues/utils/platform-authenticator.mjs'
import AuthenticatedApiClient from '#libs-server/external-fantasy-leagues/utils/authenticated-api-client.mjs'
import SleeperAdapter from '#libs-server/external-fantasy-leagues/adapters/sleeper.mjs'
import EspnAdapter from '#libs-server/external-fantasy-leagues/adapters/espn.mjs'
import YahooAdapter from '#libs-server/external-fantasy-leagues/adapters/yahoo.mjs'
import MflAdapter from '#libs-server/external-fantasy-leagues/adapters/mfl.mjs'
import FleaflickerAdapter from '#libs-server/external-fantasy-leagues/adapters/fleaflicker.mjs'

process.env.NODE_ENV = 'test'
chai.should()

describe('External Fantasy Leagues - Authentication System', function () {
  beforeEach(function () {
    // Clear authentication cache before each test
    platform_authenticator.clear_cache()
  })

  describe('Platform Authenticator', function () {
    describe('Sleeper Authentication', function () {
      it('should authenticate successfully with no credentials (public API)', async function () {
        const result = await platform_authenticator.authenticate('sleeper', {})

        result.should.have.property('success', true)
        result.should.have.property('auth_type', 'none')
        result.should.have.property('platform', 'sleeper')
        result.should.have.property('public_leagues', true)
        result.should.have.property('private_leagues', true)
        result.should.have.property('credentials', null)
        result.should.have.property('expires_at', null)
      })

      it('should cache Sleeper authentication', async function () {
        await platform_authenticator.authenticate('sleeper', {})

        const cached = platform_authenticator.get_cached_auth('sleeper')
        cached.should.not.be.null
        cached.should.have.property('success', true)
        cached.should.have.property('platform', 'sleeper')
        cached.should.have.property('cached_at')
      })
    })

    describe('ESPN Authentication', function () {
      it('should authenticate for public leagues with no credentials', async function () {
        const result = await platform_authenticator.authenticate('espn', {})

        result.should.have.property('success', true)
        result.should.have.property('auth_type', 'none')
        result.should.have.property('platform', 'espn')
        result.should.have.property('public_leagues', true)
        result.should.have.property('private_leagues', false)
        result.should.have.property('credentials', null)
      })

      it('should authenticate with ESPN cookies for private leagues', async function () {
        const mock_credentials = {
          espn_s2: 'mock_s2_cookie_value',
          swid: 'mock_swid_value'
        }

        const result = await platform_authenticator.authenticate(
          'espn',
          mock_credentials
        )

        result.should.have.property('success', true)
        result.should.have.property('auth_type', 'cookie_based')
        result.should.have.property('platform', 'espn')
        result.should.have.property('public_leagues', true)
        result.should.have.property('private_leagues', true)
        result.credentials.should.have.property(
          'espn_s2',
          mock_credentials.espn_s2
        )
        result.credentials.should.have.property('swid', mock_credentials.swid)
      })
    })

    describe('Yahoo Authentication', function () {
      it('should require OAuth credentials', async function () {
        try {
          await platform_authenticator.authenticate('yahoo', {})
          chai.expect.fail('Should have thrown an error')
        } catch (error) {
          error.message.should.include('client_id and client_secret')
        }
      })

      it('should provide OAuth authorization URL when missing tokens', async function () {
        const credentials = {
          client_id: 'test_client_id',
          client_secret: 'test_client_secret'
        }

        try {
          await platform_authenticator.authenticate('yahoo', credentials)
          chai.expect.fail('Should have thrown an error with auth URL')
        } catch (error) {
          error.message.should.include('OAuth authorization')
          error.message.should.include(
            'https://api.login.yahoo.com/oauth2/request_auth'
          )
        }
      })
    })

    describe('MFL Authentication', function () {
      it('should authenticate for public leagues with no credentials', async function () {
        const result = await platform_authenticator.authenticate('mfl', {})

        result.should.have.property('success', true)
        result.should.have.property('auth_type', 'none')
        result.should.have.property('platform', 'mfl')
        result.should.have.property('public_leagues', true)
        result.should.have.property('private_leagues', false)
      })

      it('should handle API key authentication', async function () {
        // Note: This test doesn't make real API calls, just tests credential handling
        const mock_credentials = {
          api_key: 'mock_api_key_12345'
        }

        // Mock the validation to avoid real API calls
        const original_validate = platform_authenticator._validate_mfl_api_key
        platform_authenticator._validate_mfl_api_key = async () =>
          Promise.resolve()

        try {
          const result = await platform_authenticator.authenticate(
            'mfl',
            mock_credentials
          )

          result.should.have.property('success', true)
          result.should.have.property('auth_type', 'api_key')
          result.should.have.property('platform', 'mfl')
          result.should.have.property('public_leagues', true)
          result.should.have.property('private_leagues', true)
          result.credentials.should.have.property(
            'api_key',
            mock_credentials.api_key
          )
        } finally {
          // Restore original method
          platform_authenticator._validate_mfl_api_key = original_validate
        }
      })
    })

    describe('Fleaflicker Authentication', function () {
      it('should authenticate successfully with no credentials (public API)', async function () {
        const result = await platform_authenticator.authenticate(
          'fleaflicker',
          {}
        )

        result.should.have.property('success', true)
        result.should.have.property('auth_type', 'none')
        result.should.have.property('platform', 'fleaflicker')
        result.should.have.property('public_leagues', true)
        result.should.have.property('private_leagues', false)
        result.should.have.property('credentials', null)
      })
    })

    describe('Authentication Status and Caching', function () {
      it('should track authentication status across platforms', async function () {
        await platform_authenticator.authenticate('sleeper', {})
        await platform_authenticator.authenticate('espn', {})
        await platform_authenticator.authenticate('fleaflicker', {})

        const status = platform_authenticator.get_auth_status()

        status.should.have.property('sleeper')
        status.should.have.property('espn')
        status.should.have.property('fleaflicker')

        status.sleeper.should.have.property('authenticated', true)
        status.sleeper.should.have.property('auth_type', 'none')
        status.sleeper.should.have.property('expired', false)

        status.espn.should.have.property('authenticated', true)
        status.espn.should.have.property('auth_type', 'none')

        status.fleaflicker.should.have.property('authenticated', true)
        status.fleaflicker.should.have.property('auth_type', 'none')
      })

      it('should clear authentication cache', async function () {
        await platform_authenticator.authenticate('sleeper', {})
        platform_authenticator.get_cached_auth('sleeper').should.not.be.null

        platform_authenticator.clear_cache('sleeper')
        const cached = platform_authenticator.get_cached_auth('sleeper')
        chai.expect(cached).to.be.null
      })

      it('should clear all authentication cache', async function () {
        await platform_authenticator.authenticate('sleeper', {})
        await platform_authenticator.authenticate('espn', {})

        platform_authenticator.clear_cache()

        chai.expect(platform_authenticator.get_cached_auth('sleeper')).to.be
          .null
        chai.expect(platform_authenticator.get_cached_auth('espn')).to.be.null
      })
    })
  })

  describe('Authenticated API Client', function () {
    let client

    beforeEach(function () {
      client = new AuthenticatedApiClient({
        base_url: 'https://httpbin.org',
        requests_per_minute: 60,
        requests_per_second: 10,
        window_ms: 1000,
        auth_type: 'none'
      })
    })

    afterEach(function () {
      client.reset()
    })

    describe('Authentication Methods', function () {
      it('should set none authentication', function () {
        client.set_authentication({}, 'none')
        client.is_authenticated().should.be.true
      })

      it('should set cookie-based authentication', function () {
        const credentials = { espn_s2: 'test_s2', swid: 'test_swid' }
        client.set_authentication(credentials, 'cookie_based')

        client.is_authenticated().should.be.true
        client.headers.should.have.property(
          'Cookie',
          's2=test_s2; SWID=test_swid'
        )
      })

      it('should set API key authentication', function () {
        const credentials = { api_key: 'test_key_123' }
        client.set_authentication(credentials, 'api_key')

        client.is_authenticated().should.be.true
        client.headers.should.have.property(
          'Authorization',
          'Bearer test_key_123'
        )
      })

      it('should set OAuth2 authentication', function () {
        const credentials = {
          access_token: 'test_access_token',
          expires_at: Date.now() + 3600000 // 1 hour from now
        }
        client.set_authentication(credentials, 'oauth2')

        client.is_authenticated().should.be.true
        client.headers.should.have.property(
          'Authorization',
          'Bearer test_access_token'
        )
      })

      it('should detect expired OAuth2 tokens', function () {
        const credentials = {
          access_token: 'expired_token',
          expires_at: Date.now() - 1000 // Expired 1 second ago
        }
        client.set_authentication(credentials, 'oauth2')

        client.is_authenticated().should.be.false
      })
    })

    describe('Rate Limiting', function () {
      it('should track requests in rate limiter', async function () {
        client = new AuthenticatedApiClient({
          base_url: 'https://httpbin.org',
          requests_per_second: 2,
          window_ms: 1000,
          auth_type: 'none'
        })

        // Get initial state
        const stats_before = client.get_stats()
        const initial_requests =
          stats_before.rate_limiting.current_window_requests

        // Make requests that should be tracked
        await client.enforce_rate_limits()
        await client.enforce_rate_limits()

        // Verify requests were tracked
        const stats_after = client.get_stats()
        stats_after.rate_limiting.current_window_requests.should.be.at.least(
          initial_requests + 2
        )
      })

      it('should have configurable rate limit settings', function () {
        client = new AuthenticatedApiClient({
          base_url: 'https://httpbin.org',
          requests_per_second: 5,
          requests_per_minute: 100,
          window_ms: 2000,
          auth_type: 'none'
        })

        const stats = client.get_stats()
        stats.rate_limiting.should.have.property('requests_per_second', 5)
        stats.rate_limiting.should.have.property('requests_per_minute', 100)
        stats.rate_limiting.should.have.property('window_ms', 2000)
      })
    })

    describe('Circuit Breaker', function () {
      it('should track failures and open circuit breaker', function () {
        client.circuit_breaker.max_failures = 3

        client.is_circuit_open().should.be.false

        client.record_failure()
        client.record_failure()
        client.record_failure()

        client.is_circuit_open().should.be.true
      })

      it('should reset circuit breaker on success', function () {
        client.circuit_breaker.consecutive_failures = 2

        client.record_success()

        client.circuit_breaker.consecutive_failures.should.equal(0)
        client.is_circuit_open().should.be.false
      })
    })

    describe('Statistics and Monitoring', function () {
      it('should provide comprehensive statistics', function () {
        client.request_count = 10
        client.last_request_time = Date.now()

        const stats = client.get_stats()

        stats.should.have.property('total_requests', 10)
        stats.should.have.property('last_request_time')
        stats.should.have.property('authentication')
        stats.should.have.property('rate_limiting')
        stats.should.have.property('circuit_breaker')

        stats.authentication.should.have.property('type', 'none')
        // authenticated property depends on whether auth was called - just verify type exists
        stats.authentication.should.have.property('authenticated')

        stats.rate_limiting.should.have.property('current_window_requests')

        stats.circuit_breaker.should.have.property('consecutive_failures')
        stats.circuit_breaker.should.have.property('is_open')
      })
    })
  })

  describe('Adapter Integration', function () {
    describe('Sleeper Adapter with ffscrapr Authentication', function () {
      it('should initialize with correct authentication settings', function () {
        const adapter = new SleeperAdapter()

        adapter.authenticated.should.be.true
        adapter.api_client.should.be.an('object')
        adapter.api_client.authentication.type.should.equal('none')
        adapter.api_client.is_authenticated().should.be.true
      })

      it('should authenticate successfully', async function () {
        const adapter = new SleeperAdapter()
        const result = await adapter.authenticate({})

        result.should.be.true
        adapter.authenticated.should.be.true

        // Check that authentication was cached
        const cached = platform_authenticator.get_cached_auth('sleeper')
        cached.should.not.be.null
        cached.should.have.property('platform', 'sleeper')
      })
    })

    describe('ESPN Adapter with ffscrapr Authentication', function () {
      it('should initialize with correct settings for public leagues', function () {
        const adapter = new EspnAdapter()

        adapter.authenticated.should.be.false // Starts unauthenticated
        adapter.auth_type.should.equal('none')
        adapter.supports_private_leagues.should.be.false
      })

      it('should authenticate for public leagues', async function () {
        const adapter = new EspnAdapter()
        const result = await adapter.authenticate({})

        result.should.be.true
        adapter.authenticated.should.be.true
        adapter.auth_type.should.equal('none')
        adapter.supports_private_leagues.should.be.false
      })

      it('should authenticate for private leagues with cookies', async function () {
        const adapter = new EspnAdapter()
        const credentials = {
          espn_s2: 'mock_s2_value',
          swid: 'mock_swid_value'
        }

        const result = await adapter.authenticate(credentials)

        result.should.be.true
        adapter.authenticated.should.be.true
        adapter.auth_type.should.equal('cookie_based')
        adapter.supports_private_leagues.should.be.true
      })
    })

    describe('Yahoo Adapter with ffscrapr Authentication', function () {
      it('should initialize with OAuth2 requirements', function () {
        const adapter = new YahooAdapter()

        adapter.authenticated.should.be.false
        adapter.requires_authentication.should.be.true
        adapter.supports_private_leagues.should.be.true
        adapter.api_client.authentication.type.should.equal('oauth2')
      })

      it('should require OAuth credentials', async function () {
        const adapter = new YahooAdapter()
        const result = await adapter.authenticate({})

        result.should.be.false // Should fail without credentials
        adapter.authenticated.should.be.false
      })
    })

    describe('MFL Adapter with ffscrapr Authentication', function () {
      it('should initialize with restrictive rate limits', function () {
        const adapter = new MflAdapter()

        adapter.authenticated.should.be.false
        adapter.requires_authentication.should.be.false // MFL allows public access
        adapter.supports_private_leagues.should.be.false // Will be true after auth

        // Check MFL's restrictive rate limits
        adapter.api_client.rate_limit.requests_per_second.should.equal(2)
        adapter.api_client.rate_limit.window_ms.should.equal(3000)
        adapter.api_client.rate_limit.requests_per_minute.should.equal(40)
      })

      it('should authenticate for public leagues without credentials', async function () {
        const adapter = new MflAdapter()
        const result = await adapter.authenticate({})

        result.should.be.true
        adapter.authenticated.should.be.true
      })
    })

    describe('Fleaflicker Adapter with ffscrapr Authentication', function () {
      it('should initialize with no-auth settings', function () {
        const adapter = new FleaflickerAdapter()

        adapter.authenticated.should.be.true // Public API
        adapter.api_client.authentication.type.should.equal('none')
      })

      it('should authenticate successfully', async function () {
        const adapter = new FleaflickerAdapter()
        const result = await adapter.authenticate({})

        result.should.be.true
        adapter.authenticated.should.be.true
      })
    })
  })

  describe('Error Handling and Edge Cases', function () {
    it('should handle unsupported platform authentication', async function () {
      try {
        await platform_authenticator.authenticate('unsupported_platform', {})
        chai.expect.fail('Should have thrown an error')
      } catch (error) {
        error.message.should.include('Unsupported platform')
      }
    })

    it('should handle authentication failures gracefully', async function () {
      const adapter = new EspnAdapter()

      // Mock platform_authenticator to simulate failure
      const original_authenticate = platform_authenticator.authenticate
      platform_authenticator.authenticate = async () => {
        throw new Error('Simulated authentication failure')
      }

      try {
        const result = await adapter.authenticate({})
        result.should.be.false
        adapter.authenticated.should.be.false
      } finally {
        // Restore original method
        platform_authenticator.authenticate = original_authenticate
      }
    })

    it('should handle circuit breaker when open', async function () {
      const client = new AuthenticatedApiClient({
        auth_type: 'none',
        max_consecutive_failures: 1
      })

      // Open circuit breaker
      client.record_failure()
      client.is_circuit_open().should.be.true

      try {
        await client.request('/test', {})
        chai.expect.fail('Should have thrown circuit breaker error')
      } catch (error) {
        error.message.should.include('Circuit breaker is open')
      }
    })
  })

  after(function () {
    // Clean up authentication cache after all tests
    platform_authenticator.clear_cache()
  })
})
