import debug from 'debug'

import { cache, fetch_with_retry } from '#libs-server'

const log = debug('charting-data')

// Raw-response cache under ~/cache on the API host, via /api/cache. Every other
// vendor integration here already does this -- the directory carries nfl-pro,
// ngs, pff, pinnacle, espn and seven more -- and this vendor was the only one
// missing, so a re-run or a re-parse cost a fresh fetch on the pinned
// residential address every time.
//
// The key is derived from the route and the sorted parameter VALUES rather than
// hand-written per method, so a route added later is cached without anyone
// remembering to wire it. Values are vendor UUIDs; the sanitiser is defence
// against a future parameter that is not, since the key becomes a filesystem
// path on the server.
const sanitize_key_part = (value) =>
  String(value).replace(/[^A-Za-z0-9._-]/g, '_')

export const build_cache_key = ({ path, params = {} }) => {
  const route = path
    .replace(/^\/api\//, '')
    .replace(/\/+$/, '')
    .replace(/\//g, '-')
  const fingerprint = Object.keys(params)
    .sort()
    .map((key) => sanitize_key_part(params[key]))
    .join('-')
  return `/sumersports/${sanitize_key_part(route)}/${fingerprint}.json`
}

// Do NOT cache a response that carried nothing. A 200 with an empty list covers
// a game the vendor has not charted YET as well as one it never will, and the
// two are indistinguishable at the response level -- so caching the empty would
// freeze "no data" for a game that gets charted a couple of days later, which is
// exactly the lag this vendor operates on. Storing only responses that carried
// rows means a miss re-asks, which is the behaviour we want on the uncertain
// case and costs one request on the settled one.
const carried_rows = (response) => {
  if (!response || typeof response !== 'object') return false
  const arrays = Object.values(response).filter(Array.isArray)
  if (!arrays.length) return false
  return arrays.some((list) => list.length > 0)
}

const DEFAULT_REQUEST_DELAY_MS = 20000
const DEFAULT_JITTER_MAX_MS = 20000
const MAX_CONSECUTIVE_FAILURES = 5
const CIRCUIT_BREAKER_COOLDOWN_MS = 60 * 1000

class ChartingDataClient {
  constructor({
    // nfl_pro is the only sticky dedicated-ISP residential pool: measured five
    // calls, one address, against five distinct addresses from every other pool.
    // Shared with the NFL Pro authenticated session, which is an accepted blast
    // radius -- see user:guideline/software/vendor-egress-proxy-posture.md.
    proxy_pool = 'nfl_pro',
    use_proxy = true,
    request_delay_ms = DEFAULT_REQUEST_DELAY_MS,
    max_retries = 3,
    // Orthogonal to the importers' --force, deliberately. force means re-import
    // a game we already hold (a database decision); ignore_cache means re-ask
    // the vendor (a network decision). Conflating them would make every forced
    // re-import spend vendor requests it does not need -- which is precisely
    // the 2026-08-30 backfill, where the stored rows were wrong but the vendor
    // responses were fine.
    ignore_cache = false
  } = {}) {
    this.proxy_pool = proxy_pool
    this.use_proxy = use_proxy
    this.request_delay_ms = request_delay_ms
    this.max_retries = max_retries
    this.ignore_cache = ignore_cache

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
    const jitter = Math.random() * DEFAULT_JITTER_MAX_MS
    const target_delay = this.request_delay_ms + jitter

    if (elapsed < target_delay) {
      const wait_ms = target_delay - elapsed
      log(`rate limiting: waiting ${Math.round(wait_ms)}ms`)
      await new Promise((resolve) => setTimeout(resolve, wait_ms))
    }
  }

  async request({ path, params = {} }) {
    const cache_key = build_cache_key({ path, params })

    // Checked BEFORE the circuit breaker and the rate limiter, both of which
    // exist to pace the VENDOR. A cache hit touches no vendor, so making it
    // wait ~13s or refusing it because the vendor was failing would defeat the
    // point: a cached re-run has to be fast, or nobody re-runs.
    if (!this.ignore_cache) {
      const cached = await this.read_cache(cache_key)
      if (cached) {
        log(`cache hit ${cache_key}`)
        return cached
      }
    }

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
        // Tracks use_proxy rather than being its own knob, deliberately.
        // proxy-manager is fail-open twice -- an unresolved pool name silently
        // uses `default`, and an empty pool silently goes direct from the host
        // WAN -- and both are log-only. For a pipeline pinned to a dedicated
        // residential identity that is worse than an outage: the fetch succeeds
        // and nothing reports it left from the address the pinning exists to
        // avoid. `--no_proxy` is the explicit escape hatch; short of that, a
        // caller that asked for a proxy gets one or gets an error.
        requires_proxy: this.use_proxy,
        proxy_pool: this.proxy_pool,
        max_retries: this.max_retries,
        response_type: 'json'
      })

      this.last_request_at = Date.now()
      this.record_success()
      await this.write_cache(cache_key, response)
      return response
    } catch (error) {
      this.last_request_at = Date.now()
      this.record_failure()
      throw error
    }
  }

  // The cache is an OPTIMISATION and must never become a dependency: cache.get
  // and cache.set go over HTTP to our own API, and fetch_with_retry throws when
  // that is unreachable. Left unguarded, an outage of the cache service would
  // take down every charting import rather than merely slowing it. Both sides
  // swallow and log.
  async read_cache(key) {
    try {
      return await cache.get({ key })
    } catch (error) {
      log(`cache read failed for ${key}: ${error.message}`)
      return null
    }
  }

  async write_cache(key, response) {
    if (!carried_rows(response)) {
      log(`not caching empty response for ${key}`)
      return
    }
    try {
      await cache.set({ key, value: response })
    } catch (error) {
      log(`cache write failed for ${key}: ${error.message}`)
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

  // The per-player-per-snap grain, one request per team. The response is
  // grouped by PLAYER in contiguous blocks, not ordered by play, and it carries
  // no play id -- the nested play object selects only the two team ids. Return
  // order is the ONLY thing distinguishing two rows, so the caller must
  // preserve the array's index.
  async get_player_plays({ game_id, team_id }) {
    log(`fetching player plays for game ${game_id} team ${team_id}`)
    const response = await this.request({
      path: '/api/players/by-play/',
      // sumerGameId / sumerTeamId on this route alone; every other route this
      // client calls takes gameId / teamId. The inconsistency is the vendor's.
      params: { sumerGameId: game_id, sumerTeamId: team_id }
    })

    if (response && response.sumerPlayerPlaysInGameNflsList) {
      return response.sumerPlayerPlaysInGameNflsList
    }

    log(
      'unexpected player plays response shape: %O',
      Object.keys(response || {})
    )
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
