import debug from 'debug'

import { fetch_with_retry } from '#libs-server'

const log = debug('charting-data')

const DEFAULT_REQUEST_DELAY_MS = 3000
const DEFAULT_JITTER_MS = 2000
const MAX_CONSECUTIVE_FAILURES = 5
const CIRCUIT_BREAKER_COOLDOWN_MS = 60 * 1000

class ChartingDataClient {
  constructor({
    proxy_pool = 'default',
    use_proxy = true,
    request_delay_ms = DEFAULT_REQUEST_DELAY_MS,
    max_retries = 3
  } = {}) {
    this.proxy_pool = proxy_pool
    this.use_proxy = use_proxy
    this.request_delay_ms = request_delay_ms
    this.max_retries = max_retries

    this.consecutive_failures = 0
    this.circuit_open_until = null
    this.last_request_at = null

    this.base_url = 'https://sumersports.com'
  }

  is_circuit_open() {
    if (!this.circuit_open_until) return false
    if (Date.now() >= this.circuit_open_until) {
      this.circuit_open_until = null
      this.consecutive_failures = 0
      log('circuit breaker reset after cooldown')
      return false
    }
    return true
  }

  record_success() {
    this.consecutive_failures = 0
    this.circuit_open_until = null
  }

  record_failure() {
    this.consecutive_failures += 1
    if (this.consecutive_failures >= MAX_CONSECUTIVE_FAILURES) {
      this.circuit_open_until = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS
      log(
        `circuit breaker opened after ${this.consecutive_failures} consecutive failures, cooldown ${CIRCUIT_BREAKER_COOLDOWN_MS}ms`
      )
    }
  }

  async enforce_rate_limit() {
    if (!this.last_request_at) return

    const elapsed = Date.now() - this.last_request_at
    const jitter = Math.random() * DEFAULT_JITTER_MS
    const target_delay = this.request_delay_ms + jitter

    if (elapsed < target_delay) {
      const wait_ms = target_delay - elapsed
      log(`rate limiting: waiting ${Math.round(wait_ms)}ms`)
      await new Promise((resolve) => setTimeout(resolve, wait_ms))
    }
  }

  async request({ path, params = {} }) {
    if (this.is_circuit_open()) {
      const remaining = this.circuit_open_until - Date.now()
      throw new Error(
        `Circuit breaker open, ${Math.round(remaining / 1000)}s remaining`
      )
    }

    await this.enforce_rate_limit()

    const url = new URL(path, this.base_url)
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, value)
      }
    }

    log(`requesting ${url.pathname}${url.search}`)

    try {
      const response = await fetch_with_retry({
        url: url.toString(),
        headers: {
          Referer: `${this.base_url}/live/`
        },
        use_proxy: this.use_proxy,
        proxy_pool: this.proxy_pool,
        max_retries: this.max_retries,
        response_type: 'json'
      })

      this.last_request_at = Date.now()
      this.record_success()
      return response
    } catch (error) {
      this.last_request_at = Date.now()
      this.record_failure()
      throw error
    }
  }

  async get_plays({ game_id }) {
    log(`fetching plays for game ${game_id}`)
    const response = await this.request({
      path: '/api/plays/list/',
      params: { gameId: game_id }
    })

    // API wraps plays in {sumerPlaysInGameNflsList: [...]}
    if (response && response.sumerPlaysInGameNflsList) {
      return response.sumerPlaysInGameNflsList
    }

    log('unexpected plays response shape: %O', Object.keys(response || {}))
    return []
  }

  async get_matchup_stats({ game_id }) {
    log(`fetching matchup stats for game ${game_id}`)
    const response = await this.request({
      path: '/api/players/matchup-stats/',
      params: { gameId: game_id }
    })

    // API wraps matchup stats in {getPlayerMatchupStatsList: [...]}
    if (response && response.getPlayerMatchupStatsList) {
      return response.getPlayerMatchupStatsList
    }

    log(
      'unexpected matchup stats response shape: %O',
      Object.keys(response || {})
    )
    return []
  }
}

export { ChartingDataClient }
