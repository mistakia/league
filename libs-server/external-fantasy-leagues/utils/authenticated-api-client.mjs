import fetch from 'node-fetch'
import debug from 'debug'

// Debug namespaces for API client
// Usage:
//   DEBUG=external:api-client* - All API client logs
//   DEBUG=external:api-client:request - Individual request logs (verbose)
const log = debug('external:api-client')
const log_request = debug('external:api-client:request')

/**
 * Enhanced HTTP client with authentication support for external fantasy platforms
 *
 * Features:
 * - Multiple authentication types: none, cookie_based, oauth2, api_key
 * - Advanced rate limiting with burst protection and per-second limits
 * - Automatic retry with exponential backoff and jitter
 * - Circuit breaker pattern for fault tolerance
 * - Comprehensive request logging via debug library
 *
 * Implements ffscrapr-style authentication patterns with platform-specific rate limiting.
 * Used by all platform adapters to make authenticated API requests.
 *
 * @example
 * const client = new AuthenticatedApiClient({
 *   base_url: 'https://api.example.com',
 *   auth_type: 'oauth2',
 *   requests_per_second: 30
 * })
 * client.set_authentication({ access_token: '...' }, 'oauth2')
 * const data = await client.get('/endpoint')
 */
export default class AuthenticatedApiClient {
  constructor(options = {}) {
    this.base_url = options.base_url || ''
    this.headers = options.headers || {}
    this.timeout = options.timeout || 30000

    // Rate limiting configuration
    this.rate_limit = {
      requests_per_minute: options.requests_per_minute || 100,
      requests_per_second: options.requests_per_second || 30,
      window_ms: options.window_ms || 2000,
      burst_limit: options.burst_limit || 50
    }

    // Retry configuration
    this.retry_config = {
      max_attempts: options.max_retries || 3,
      initial_delay_ms: options.retry_delay_ms || 1000,
      max_delay_ms: options.max_backoff_delay_ms || 30000,
      exponential_backoff: options.exponential_backoff !== false
    }

    // Request tracking for rate limiting
    this.request_history = []
    this.last_request_time = 0
    this.request_count = 0

    // Authentication state
    this.authentication = {
      type: options.auth_type || 'none', // none, cookie_based, oauth2, api_key
      credentials: null,
      authenticated: false,
      expires_at: null,
      refresh_token: null
    }

    // Circuit breaker state
    this.circuit_breaker = {
      consecutive_failures: 0,
      max_failures: options.max_consecutive_failures || 5,
      timeout_ms: options.circuit_breaker_timeout_ms || 60000,
      open_until: null
    }
  }

  /**
   * Set authentication credentials based on platform type
   *
   * Configures the client with platform-specific authentication credentials.
   * The auth_type determines how credentials are used:
   * - 'none': No authentication required (public APIs)
   * - 'cookie_based': Sets Cookie header (e.g., ESPN with espn_s2 and swid)
   * - 'oauth2': Sets Authorization header with Bearer token (e.g., Yahoo)
   * - 'api_key': Sets Authorization header with Bearer token (e.g., MFL)
   *
   * @param {Object} credentials - Platform-specific credentials object
   *   - For cookie_based: { espn_s2, swid }
   *   - For oauth2: { access_token, refresh_token?, expires_at? }
   *   - For api_key: { api_key }
   *   - For none: {} or null
   * @param {string} auth_type - Authentication type: 'none' | 'cookie_based' | 'oauth2' | 'api_key'
   */
  set_authentication(credentials, auth_type) {
    this.authentication.type = auth_type
    this.authentication.credentials = credentials
    this.authentication.authenticated = false

    switch (auth_type) {
      case 'none':
        this.authentication.authenticated = true
        break
      case 'cookie_based':
        // ESPN-style cookie authentication
        if (credentials.espn_s2 && credentials.swid) {
          this.headers.Cookie = `s2=${credentials.espn_s2}; SWID=${credentials.swid}`
          this.authentication.authenticated = true
        }
        break
      case 'api_key':
        // MFL-style API key authentication
        if (credentials.api_key) {
          this.headers.Authorization = `Bearer ${credentials.api_key}`
          this.authentication.authenticated = true
        }
        break
      case 'oauth2':
        // Yahoo-style OAuth2 authentication
        if (credentials.access_token) {
          this.headers.Authorization = `Bearer ${credentials.access_token}`
          this.authentication.authenticated = true
          this.authentication.expires_at = credentials.expires_at
          this.authentication.refresh_token = credentials.refresh_token
        }
        break
    }
  }

  /**
   * Check if authentication is valid and not expired
   * @returns {boolean} Authentication status
   */
  is_authenticated() {
    if (!this.authentication.authenticated) {
      return false
    }

    // Check token expiration for OAuth2
    if (
      this.authentication.type === 'oauth2' &&
      this.authentication.expires_at
    ) {
      const now = Date.now()
      if (now >= this.authentication.expires_at) {
        this.authentication.authenticated = false
        return false
      }
    }

    return true
  }

  /**
   * Advanced rate limiting with burst support and per-second limits
   * @returns {Promise<void>}
   */
  async enforce_rate_limits() {
    const now = Date.now()

    // Clean old request history (keep only recent requests)
    const window_start = now - this.rate_limit.window_ms
    this.request_history = this.request_history.filter(
      (time) => time > window_start
    )

    // Check burst limit (requests within window)
    if (this.request_history.length >= this.rate_limit.burst_limit) {
      const oldest_request = Math.min(...this.request_history)
      const wait_time = this.rate_limit.window_ms - (now - oldest_request)
      if (wait_time > 0) {
        await new Promise((resolve) => setTimeout(resolve, wait_time))
      }
    }

    // Check per-second rate limit
    const per_second_delay = 1000 / this.rate_limit.requests_per_second
    const time_since_last = now - this.last_request_time
    if (time_since_last < per_second_delay) {
      const delay = per_second_delay - time_since_last
      await new Promise((resolve) => setTimeout(resolve, delay))
    }

    this.last_request_time = Date.now()
    this.request_history.push(this.last_request_time)
    this.request_count++
  }

  /**
   * Check circuit breaker status
   * @returns {boolean} True if circuit is open (should not make requests)
   */
  is_circuit_open() {
    if (
      this.circuit_breaker.open_until &&
      Date.now() < this.circuit_breaker.open_until
    ) {
      return true
    }

    if (
      this.circuit_breaker.open_until &&
      Date.now() >= this.circuit_breaker.open_until
    ) {
      // Circuit breaker timeout expired, reset
      this.circuit_breaker.consecutive_failures = 0
      this.circuit_breaker.open_until = null
    }

    return false
  }

  /**
   * Record successful request (reset circuit breaker)
   */
  record_success() {
    this.circuit_breaker.consecutive_failures = 0
    this.circuit_breaker.open_until = null
  }

  /**
   * Record failed request (increment circuit breaker)
   */
  record_failure() {
    this.circuit_breaker.consecutive_failures++

    if (
      this.circuit_breaker.consecutive_failures >=
      this.circuit_breaker.max_failures
    ) {
      this.circuit_breaker.open_until =
        Date.now() + this.circuit_breaker.timeout_ms
      log(
        'Circuit breaker opened due to %d consecutive failures',
        this.circuit_breaker.consecutive_failures
      )
    }
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   * @param {number} attempt - Current attempt number (0-based)
   * @returns {number} Delay in milliseconds
   */
  calculate_retry_delay(attempt) {
    if (!this.retry_config.exponential_backoff) {
      return this.retry_config.initial_delay_ms
    }

    const exponential_delay =
      this.retry_config.initial_delay_ms * Math.pow(2, attempt)
    const capped_delay = Math.min(
      exponential_delay,
      this.retry_config.max_delay_ms
    )

    // Add jitter (±25% of delay) to prevent thundering herd
    const jitter = capped_delay * 0.25 * (Math.random() - 0.5)
    return Math.max(100, capped_delay + jitter)
  }

  /**
   * Make authenticated HTTP request with comprehensive retry logic
   * @param {string} url - Request URL
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response data
   */
  async request(url, options = {}) {
    // Check circuit breaker
    if (this.is_circuit_open()) {
      throw new Error('Circuit breaker is open - too many consecutive failures')
    }

    // Check authentication if required
    if (this.authentication.type !== 'none' && !this.is_authenticated()) {
      throw new Error(
        `Authentication required for ${this.authentication.type} but not authenticated`
      )
    }

    // Enforce rate limiting
    await this.enforce_rate_limits()

    const full_url = url.startsWith('http') ? url : `${this.base_url}${url}`

    // Build request options
    const request_options = {
      timeout: this.timeout,
      headers: {
        'User-Agent': 'fantasy-league-sync/2.0 (ffscrapr-compatible)',
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...this.headers,
        ...options.headers
      },
      ...options
    }

    // Handle query parameters
    if (options.params) {
      const url_obj = new URL(full_url)
      Object.entries(options.params).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach((v) => url_obj.searchParams.append(key, v))
        } else if (value !== null && value !== undefined) {
          url_obj.searchParams.set(key, value)
        }
      })
      const final_url = url_obj.toString()
      return this._make_request_with_retries(final_url, request_options)
    }

    return this._make_request_with_retries(full_url, request_options)
  }

  /**
   * Internal method to make request with retry logic
   * @param {string} url - Full request URL
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response data
   */
  async _make_request_with_retries(url, options) {
    let last_error

    for (let attempt = 0; attempt < this.retry_config.max_attempts; attempt++) {
      try {
        const response = await fetch(url, options)

        if (!response.ok) {
          const error_data = await this._parse_error_response(response)
          const error = new Error(
            `HTTP ${response.status}: ${error_data.message || response.statusText}`
          )
          error.status = response.status
          error.response_data = error_data

          // Don't retry client errors (4xx), only server errors (5xx) and network issues
          if (response.status >= 400 && response.status < 500) {
            this.record_failure()
            throw error
          }

          throw error
        }

        const data = await response.json()
        this.record_success()
        this._log_request('success', url, attempt + 1)
        return data
      } catch (error) {
        last_error = error
        this._log_request('error', url, attempt + 1, error.message)

        // Don't retry client errors or authentication issues
        if (error.status >= 400 && error.status < 500) {
          this.record_failure()
          throw error
        }

        if (attempt < this.retry_config.max_attempts - 1) {
          const delay = this.calculate_retry_delay(attempt)
          log(
            'Request failed, retrying in %dms (attempt %d/%d)',
            delay,
            attempt + 1,
            this.retry_config.max_attempts
          )
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    }

    this.record_failure()
    throw new Error(
      `Request failed after ${this.retry_config.max_attempts} attempts: ${last_error.message}`
    )
  }

  /**
   * Parse error response from API
   * @param {Response} response - Fetch response object
   * @returns {Promise<Object>} Error data
   */
  async _parse_error_response(response) {
    try {
      const error_data = await response.json()
      return error_data
    } catch {
      return { message: response.statusText }
    }
  }

  /**
   * Log request activity using debug library
   * @param {string} status - Request status (success, error)
   * @param {string} url - Request URL
   * @param {number} attempt - Attempt number
   * @param {string} [error_message] - Error message if applicable
   */
  _log_request(status, url, attempt, error_message = null) {
    const anonymized_url = url.replace(/\/\d+/g, '/{id}')

    if (status === 'error') {
      log(
        'Request error: %s (attempt %d) - %s',
        anonymized_url,
        attempt,
        error_message
      )
    } else {
      // Success logs go to verbose request namespace
      log_request(
        'Request success: %s (attempt %d, total: %d)',
        anonymized_url,
        attempt,
        this.request_count
      )
    }
  }

  /**
   * HTTP method shortcuts
   */
  async get(url, options = {}) {
    return this.request(url, { ...options, method: 'GET' })
  }

  async post(url, data = null, options = {}) {
    const request_options = { ...options, method: 'POST' }
    if (data) {
      request_options.body = JSON.stringify(data)
    }
    return this.request(url, request_options)
  }

  async put(url, data = null, options = {}) {
    const request_options = { ...options, method: 'PUT' }
    if (data) {
      request_options.body = JSON.stringify(data)
    }
    return this.request(url, request_options)
  }

  async delete(url, options = {}) {
    return this.request(url, { ...options, method: 'DELETE' })
  }

  /**
   * Get comprehensive client statistics
   * @returns {Object} Client statistics
   */
  get_stats() {
    return {
      total_requests: this.request_count,
      last_request_time: this.last_request_time,
      authentication: {
        type: this.authentication.type,
        authenticated: this.is_authenticated(),
        expires_at: this.authentication.expires_at
      },
      rate_limiting: {
        ...this.rate_limit,
        current_window_requests: this.request_history.length
      },
      circuit_breaker: {
        consecutive_failures: this.circuit_breaker.consecutive_failures,
        is_open: this.is_circuit_open(),
        open_until: this.circuit_breaker.open_until
      }
    }
  }

  /**
   * Reset client state (useful for testing)
   */
  reset() {
    this.request_count = 0
    this.last_request_time = 0
    this.request_history = []
    this.circuit_breaker.consecutive_failures = 0
    this.circuit_breaker.open_until = null
    this.authentication.authenticated = false
  }
}
