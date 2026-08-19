// @ts-check
import { ProxyAgent, fetch as undiciFetch } from 'undici'
import debug from 'debug'

import db from '#db'
import { create_logger } from '#libs-shared/log.mjs'

const log = debug('proxy-manager')

/**
 * A parsed proxy connection, before the pool adds its bookkeeping.
 *
 * `connection_string` carries the CREDENTIAL for an authenticated proxy, so it
 * must never reach a log line or an error message -- `proxy_display_label`
 * exists for that and renders the routing half only.
 *
 * @typedef {object} ProxyConfig
 * @property {string} host
 * @property {string} port
 * @property {string} [username]
 * @property {string} [password]
 * @property {'http'} protocol
 * @property {string} connection_string
 */

/**
 * A pool entry: a parsed proxy plus the pool's own health bookkeeping.
 *
 * @typedef {ProxyConfig & { failed: boolean, last_used: number }} ProxyPoolEntry
 */

/**
 * What `get_working_proxy` hands back, and what every consumer destructures.
 *
 * It is the pool entry widened with the two fields that identify WHICH entry of
 * WHICH pool was selected -- `key` is what `mark_proxy_failed` matches on and
 * `pool_name` is what a caller reports. Typing the selection separately from
 * the entry is what keeps a consumer from reading a bookkeeping field
 * (`failed`, `last_used`) as though it described the request it just made.
 *
 * @typedef {ProxyPoolEntry & { key: string, pool_name: string }} SelectedProxy
 */

/**
 * The two selection modes a pool row may declare.
 *
 * @typedef {'round_robin' | 'sticky'} ProxySelectionMode
 */

/**
 * The body-reading methods of `Response`, as a closed set.
 *
 * `fetch_with_retry` invokes this as a COMPUTED method name --
 * `response[response_type]()` -- which is the census's interpolated-key class:
 * there is no literal to grep, and a misspelled value is not a wrong result but
 * a `TypeError: response.jsonn is not a function` at the end of a successful
 * request, after the retries and the proxy work are all spent. Naming the set
 * makes the typo a type error at the call site instead.
 *
 * @typedef {'json' | 'text' | 'arrayBuffer' | 'blob' | 'formData' | 'bytes'} ResponseBodyMethod
 */

// Abortable sleep. A plain setTimeout cannot be interrupted, so an overall
// import deadline (passed down as an AbortSignal) could not cut short the
// all-proxies-failed backoff below — a single sleep would run to completion even
// after the budget was spent. Rejecting on abort lets the caller stop promptly.
const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error('Aborted'))
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', on_abort)
      resolve()
    }, ms)
    const on_abort = () => {
      clearTimeout(timer)
      reject(signal.reason ?? new Error('Aborted'))
    }
    signal?.addEventListener('abort', on_abort, { once: true })
  })

// Parse proxy strings into proxy URLs
// Format: host:port or host:port:username:password
// Uses http:// protocol for proxy connection (standard for HTTP proxies)
/**
 * @param {string} proxy_str
 * @returns {ProxyConfig}
 */
const parse_proxy_string = (proxy_str) => {
  const parts = proxy_str.split(':')

  const [host, port, username, password] = parts
  // Built in ONE literal each rather than assigned onto a partial object after
  // the fact. The two-step form left an intermediate value that satisfied no
  // declared shape, so nothing could state that a proxy config always carries a
  // connection string -- which is the field every consumer dials.
  if (username && password) {
    return {
      host,
      port,
      username,
      password,
      protocol: 'http',
      connection_string: `http://${username}:${password}@${host}:${port}`
    }
  }
  return {
    host,
    port,
    protocol: 'http',
    connection_string: `http://${host}:${port}`
  }
}

// A proxy key is `host:port:username`, and the username is a credential — vendor
// proxies encode the session/auth configuration into it. Never interpolate a key
// into a log line or an error message: those reach stderr, the job logs, and any
// error surface that renders the message. This renders the routing half only.
/**
 * @param {string} proxy_key
 * @returns {string} The `host:port` half, never the credential.
 */
const proxy_display_label = (proxy_key) =>
  typeof proxy_key === 'string'
    ? proxy_key.split(':').slice(0, 2).join(':')
    : ''

// The two selection modes a pool row may declare.
//
// round_robin spreads load across entries and is the right default for a
// scraping pool, where many IPs is the point. sticky pins to one entry and is
// for a pool whose purpose is a STABLE EGRESS IDENTITY -- an authenticated
// vendor session that a changing source IP would look suspicious to. Under
// round_robin a three-entry pool delivers three rotating IPs, which for that
// case is the exact inverse of the goal.
const SELECTION_MODES = new Set(['round_robin', 'sticky'])
const DEFAULT_SELECTION = 'round_robin'

// ProxyPool manages a single pool of proxies under a declared selection mode
class ProxyPool {
  /**
   * @param {string} name
   * @param {{ selection?: ProxySelectionMode }} [options]
   */
  constructor(name, { selection = DEFAULT_SELECTION } = {}) {
    // Reject an unknown mode rather than coercing it. Every other failure path
    // in this module is fail-OPEN and log-only -- an unresolved pool silently
    // uses `default`, an empty pool silently goes direct -- and both land on
    // precisely the egress a sticky pool exists to avoid. A typo'd 'stickey'
    // that quietly meant round_robin would be that same class of bug, invisible
    // until someone audited the egress IPs.
    if (!SELECTION_MODES.has(selection)) {
      throw new Error(
        `[${name}] unknown proxy selection '${selection}'; ` +
          `expected one of ${[...SELECTION_MODES].join(', ')}`
      )
    }
    this.name = name
    this.selection = selection
    this.proxies = new Map()
    this.proxy_keys = []
    this.round_robin_index = 0
    this.retry_count = 0
    this.base_delay = 60000 // 1 minute base delay
  }

  /**
   * @param {string} proxy_str
   * @returns {void}
   */
  add_proxy(proxy_str) {
    const proxy_config = parse_proxy_string(proxy_str)
    const key = proxy_str.split(':').slice(0, 3).join(':')
    this.proxies.set(key, {
      ...proxy_config,
      failed: false,
      last_used: 0
    })
    this.proxy_keys.push(key)
  }

  reset_failed_proxies() {
    const failed_keys = []
    for (const [key, proxy] of this.proxies.entries()) {
      if (proxy.failed) {
        failed_keys.push(key)
      }
      proxy.failed = false
    }
    log(
      `[${this.name}] Reset ${failed_keys.length} failed proxies: ${failed_keys.map(proxy_display_label).join(', ')}`
    )
  }

  all_proxies_failed() {
    return Array.from(this.proxies.values()).every((p) => p.failed)
  }

  /**
   * @param {AbortSignal} [signal]
   * @returns {Promise<SelectedProxy|null>} null when the pool is empty or every
   *   entry is failed after the backoff.
   */
  async get_working_proxy(signal) {
    if (this.proxies.size === 0) {
      log(`[${this.name}] No proxies available`)
      return null
    }

    // If all proxies failed, reset them and add exponential backoff. The
    // delay is capped so a long-lived worker whose proxy pool stays down does
    // not accumulate unbounded sleeps (retry_count only resets on a successful
    // fetch); without the cap, base_delay * 2^n reached tens of minutes and was
    // a primary contributor to import-live-odds-worker's 45-min job timeouts.
    if (this.all_proxies_failed()) {
      this.retry_count++
      const delay = Math.min(
        this.base_delay * Math.pow(2, this.retry_count - 1),
        ProxyPool.MAX_BACKOFF_MS
      )
      log(
        `[${this.name}] All proxies failed. Waiting ${delay}ms before retry #${this.retry_count}`
      )
      // Reset in a finally so an aborted backoff still clears the failed flags.
      // The single-proxy pinnacle pool trips all_proxies_failed() on any one
      // transient, and its backoff (pinned at MAX_BACKOFF_MS) always exceeds the
      // caller's 2-min matchups budget, so this sleep is aborted every run. Before
      // the finally, reset_failed_proxies() never ran and the lone proxy stayed
      // failed for the module-singleton worker's lifetime, wedging every 4-hourly
      // run until a manual restart. Resetting on abort makes the pool usable again
      // on the next process call; reset_retry_count() on a later success unwinds
      // the retry_count climb.
      try {
        await sleep(delay, signal)
      } finally {
        this.reset_failed_proxies()
      }
    }

    // Selection. Both modes scan in order and skip failed entries; they differ
    // only in whether the starting point advances.
    //
    //   round_robin -- advance the index on EVERY call, so consecutive calls
    //     land on different entries.
    //   sticky -- never advance. Return the first non-failed entry, which is the
    //     same one every call until it is marked failed, at which point the scan
    //     naturally moves to the next and stays there. Failover survives; only
    //     rotation-for-its-own-sake is removed.
    const proxy_count = this.proxy_keys.length
    let attempts = 0
    let index = this.round_robin_index

    while (attempts < proxy_count) {
      const key = this.proxy_keys[index]
      index = (index + 1) % proxy_count
      if (this.selection === 'round_robin') {
        this.round_robin_index = index
      }

      const proxy = this.proxies.get(key)
      if (proxy && !proxy.failed) {
        proxy.last_used = Date.now()
        log(
          `[${this.name}] Selected proxy (${this.selection}): ${proxy_display_label(key)}`
        )
        return { key, ...proxy, pool_name: this.name }
      }

      attempts++
    }

    return null
  }

  /**
   * Matched on `connection_string` rather than on the key, because a caller
   * holds the config it fetched with and not the pool's key for it.
   *
   * @param {{ connection_string: string }} proxy_config
   * @returns {void}
   */
  mark_proxy_failed(proxy_config) {
    for (const [key, proxy] of this.proxies.entries()) {
      if (proxy.connection_string === proxy_config.connection_string) {
        log(
          `[${this.name}] Marking proxy ${proxy_display_label(key)} as failed`
        )
        proxy.failed = true
        return
      }
    }
  }

  /**
   * @returns {{ total: number, failed: number, working: number }}
   */
  get_stats() {
    const total = this.proxies.size
    const failed = Array.from(this.proxies.values()).filter(
      (p) => p.failed
    ).length
    return { total, failed, working: total - failed }
  }
}

// Ceiling for the all-proxies-failed exponential backoff (5 minutes).
ProxyPool.MAX_BACKOFF_MS = 5 * 60 * 1000

// ProxyManager manages multiple proxy pools
class ProxyManager {
  constructor() {
    this.pools = new Map()
    this.initialized = false
  }

  async initialize() {
    if (this.initialized) return

    try {
      // Load all proxy configs from database
      const configs = await db('config')
        .where('key', 'like', 'proxy_config%')
        .select('key', 'config_value')

      for (const config of configs) {
        if (!config.config_value) continue

        // Determine pool name from config key
        // proxy_config -> default, proxy_config_pinnacle -> pinnacle
        const pool_name =
          config.key === 'proxy_config'
            ? 'default'
            : config.key.replace('proxy_config_', '')

        // Row shape: { selection, proxies }. Selection lives in the row that
        // owns it rather than in a second config key, which could disagree with
        // it. The bare-array form it replaced is NOT accepted -- all three rows
        // migrated together, and carrying both shapes would leave exactly the
        // transitional cruft the clean-end-state guideline forbids. A row still
        // holding an array therefore throws here rather than silently yielding
        // an empty pool, which would fail open to a direct fetch.
        const { selection, proxies: proxy_list } = config.config_value || {}

        if (!Array.isArray(proxy_list)) {
          // Named by POOL rather than by config.key. The row key is not itself a
          // credential, but the credential-logging gate matches any `.key`
          // interpolation on this file and quieting it by exception is how the
          // one real leak would get through later. pool_name is derived from the
          // same row and says the same thing.
          throw new Error(
            `proxy config for pool '${pool_name}' is not { selection, proxies }; ` +
              'migrate the row -- the bare-array form is no longer read'
          )
        }

        const pool = new ProxyPool(pool_name, { selection })

        for (const proxy_str of proxy_list) {
          pool.add_proxy(proxy_str)
        }

        this.pools.set(pool_name, pool)
        log(
          `Initialized pool '${pool_name}' with ${pool.proxies.size} proxies (${pool.selection})`
        )
      }

      if (this.pools.size === 0) {
        log('No proxy pools found in database')
      }

      this.initialized = true
    } catch (error) {
      log(`Error initializing proxies: ${error.message}`)
      throw error
    }
  }

  get_pool(pool_name = 'default') {
    return this.pools.get(pool_name)
  }

  async get_working_proxy(pool_name = 'default', signal) {
    await this.initialize()

    const pool = this.pools.get(pool_name)
    if (!pool) {
      log(`Pool '${pool_name}' not found, trying 'default'`)
      const default_pool = this.pools.get('default')
      if (!default_pool) {
        log('No default pool available')
        return null
      }
      return default_pool.get_working_proxy(signal)
    }

    return pool.get_working_proxy(signal)
  }

  mark_proxy_failed(proxy_config) {
    // Find the pool this proxy belongs to and mark it failed
    const pool_name = proxy_config.pool_name || 'default'
    const pool = this.pools.get(pool_name)
    if (pool) {
      pool.mark_proxy_failed(proxy_config)
    }
  }

  reset_retry_count(pool_name = 'default') {
    const pool = this.pools.get(pool_name)
    if (pool) {
      pool.retry_count = 0
    }
  }

  get_pool_stats(pool_name = 'default') {
    const pool = this.pools.get(pool_name)
    if (!pool) return null
    return pool.get_stats()
  }
}

const proxy_manager = new ProxyManager()

// A requires_proxy refusal. Distinct class so the retry loop can rethrow it
// immediately: retrying a misconfigured or empty pool cannot succeed, and the
// backoff would only delay the report.
class ProxyRequirementError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ProxyRequirementError'
  }
}

const proxy_signal_log = create_logger('proxy-manager', {
  service: 'league-imports'
})

// Refuse to proceed unproxied, loudly. A log line is not an oracle -- this is
// the failure that otherwise succeeds silently from the wrong IP -- so it
// raises a signal before throwing, per user:guideline/surface-pipeline-failures.
// The message names the POOL only; a proxy key's username half is a credential.
const refuse_unproxied = async (message) => {
  log(message)
  const emitted = proxy_signal_log.error(new Error(message), {
    severity: 'high'
  })
  if (emitted?.promise) await emitted.promise
  throw new ProxyRequirementError(message)
}

// A single proxied attempt that returns the raw Response with no ok-check and
// no retry -- for a caller (like the PFF session/auth flow) that must branch on
// specific status codes (401/403/431) and inspect the body itself, where
// fetch_with_retry's throw-before-return on any non-2xx would swallow exactly
// the information the caller needs. Falls back to a direct fetch if no proxy
// is available, same as fetch_with_retry.
async function fetch_via_proxy_raw({
  url,
  method,
  headers,
  body,
  proxy_pool = 'default'
}) {
  await proxy_manager.initialize()

  const fetch_options = {}
  if (method) fetch_options.method = method
  if (headers) fetch_options.headers = headers
  if (body) fetch_options.body = body

  const proxy_config = await proxy_manager.get_working_proxy(proxy_pool)

  if (!proxy_config) {
    log(`[${proxy_pool}] No proxy available, using direct connection`)
    return fetch(url, fetch_options)
  }

  const proxyAgent = new ProxyAgent(proxy_config.connection_string)
  return undiciFetch(url, { ...fetch_options, dispatcher: proxyAgent })
}

async function fetch_with_proxy({ url, options = {}, force_proxy = false }) {
  await proxy_manager.initialize()

  const proxy_config = await proxy_manager.get_working_proxy()

  // If no proxy is available and force_proxy is true, throw an error
  if (!proxy_config) {
    if (force_proxy) {
      log('No proxy available and force_proxy is true')
      throw new Error('No working proxies available and force_proxy is true')
    }

    log('No proxy available, using direct connection')
    try {
      const response = await fetch(url, options)
      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: ${response.statusText} (direct)`
        )
      }
      return response
    } catch (error) {
      log(`Error with direct connection: ${error.message}`)
      throw error
    }
  }

  let retries = 0
  const max_retries = 3

  while (retries < max_retries) {
    try {
      log(`Fetching ${url} via proxy ${proxy_config.host}:${proxy_config.port}`)

      const proxyAgent = new ProxyAgent(proxy_config.connection_string)

      const fetch_options = {
        ...options,
        dispatcher: proxyAgent
      }

      const response = await undiciFetch(url, fetch_options)

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: ${response.statusText} (proxy: ${proxy_display_label(proxy_config.key)})`
        )
      }

      // Reset retry count on success
      proxy_manager.reset_retry_count(proxy_config.pool_name)

      return response
    } catch (error) {
      log(
        `Error with proxy ${proxy_config.host}:${proxy_config.port}: ${error.message}`
      )
      proxy_manager.mark_proxy_failed(proxy_config)

      // Only throw if it's not a proxy-related error or we've exceeded retries
      if (
        !error.message.includes('proxy') &&
        !error.message.includes('ECONNRESET') &&
        !error.message.includes('socket hang up')
      ) {
        throw error
      }

      retries++

      if (retries >= max_retries) {
        throw error
      }

      // Try a different proxy
      const new_proxy_config = await proxy_manager.get_working_proxy()
      if (!new_proxy_config) {
        throw new Error('No working proxies available')
      }
    }
  }
}

// Unified fetch with retry - supports both proxied and non-proxied requests
/**
 * @param {object} [options]
 * @param {string} [options.url] - REQUIRED in practice; a falsy value throws
 *   `url is required`. Optional in the type only because the parameter keeps
 *   its `= {}` default, which is what turns a no-argument call into that named
 *   error instead of a bare destructuring TypeError. The runtime check is the
 *   enforcement here, and it is loud -- the silent shapes are what this file's
 *   other annotations are aimed at.
 * @param {string} [options.method]
 * @param {Record<string, string>} [options.headers]
 * @param {string | Buffer | URLSearchParams} [options.body]
 * @param {number} [options.max_retries=3]
 * @param {number} [options.initial_delay=1000]
 * @param {number} [options.max_delay=10000]
 * @param {boolean} [options.use_proxy=false]
 * @param {boolean} [options.requires_proxy=false] - Fail CLOSED rather than
 *   falling back to direct egress. See the block comment at the resolution site.
 * @param {string} [options.proxy_pool='default']
 * @param {ResponseBodyMethod} [options.response_type] - Absent returns the raw
 *   `Response`; otherwise the named body method is invoked and its result
 *   returned.
 * @param {number} [options.timeout_ms=30000] - Per-ATTEMPT, not overall.
 * @param {AbortSignal} [options.signal] - A caller's overall deadline, combined
 *   with the per-attempt timeout so whichever fires first aborts.
 * @returns {Promise<any>} The parsed body when `response_type` is given, else
 *   the `Response`.
 */
export async function fetch_with_retry({
  url,
  method,
  headers,
  body,
  max_retries = 3,
  initial_delay = 1000,
  max_delay = 10000,
  use_proxy = false,
  requires_proxy = false,
  proxy_pool = 'default',
  response_type,
  timeout_ms = 30000,
  signal
} = {}) {
  if (!url) {
    throw new Error('url is required')
  }

  const retry_log = debug('fetch-with-retry')

  const fetch_options = {}
  if (method) fetch_options.method = method
  if (headers) fetch_options.headers = headers
  if (body) fetch_options.body = body

  // Per-attempt request timeout. undici's fetch has no bounded overall timeout
  // (headersTimeout defaults to 5 min), so a stalled proxy connection hung each
  // attempt for minutes; across 4 attempts x a 10-matchup concurrent batch this
  // was the root cause of import-live-odds-worker walling at its 45-min outer
  // timeout. A fresh AbortSignal.timeout per attempt bounds each network call so
  // failures surface fast and rotate to the next proxy instead of hanging.

  let last_error
  let current_proxy = null
  const proxies_tried = []

  for (let attempt = 0; attempt <= max_retries; attempt++) {
    try {
      let response
      // Per-attempt request timeout, combined with any caller-supplied overall
      // deadline signal so a request aborts on whichever fires first.
      const timeout_signal = AbortSignal.timeout(timeout_ms)
      const attempt_options = {
        ...fetch_options,
        signal: signal
          ? AbortSignal.any([signal, timeout_signal])
          : timeout_signal
      }

      if (use_proxy) {
        // Get a working proxy from the specified pool (rotates on failure)
        await proxy_manager.initialize()

        if (requires_proxy) {
          // Fail CLOSED. Both of this module's fall-throughs -- an unresolved
          // pool silently using `default`, and an empty pool silently going
          // direct -- put the request on an egress the caller has declared it
          // must not use, and both are log-only. For a caller pinned to a
          // dedicated identity that is worse than an outage: the fetch succeeds
          // and nothing reports that it left from the wrong address.
          //
          // Resolved here rather than through get_working_proxy so the
          // default-pool fallback is bypassed entirely instead of detected
          // after the fact.
          const pool = proxy_manager.get_pool(proxy_pool)
          if (!pool) {
            await refuse_unproxied(
              `requires_proxy: pool '${proxy_pool}' is not configured`
            )
          }
          current_proxy = await pool.get_working_proxy(signal)
          if (!current_proxy) {
            await refuse_unproxied(
              `requires_proxy: pool '${proxy_pool}' yielded no working proxy`
            )
          }
        } else {
          current_proxy = await proxy_manager.get_working_proxy(
            proxy_pool,
            signal
          )
        }

        if (current_proxy) {
          retry_log(
            `Attempt ${attempt + 1}/${max_retries + 1} for ${url} via proxy ${proxy_display_label(current_proxy.key)} (pool: ${current_proxy.pool_name})`
          )
          proxies_tried.push(proxy_display_label(current_proxy.key))
          const proxyAgent = new ProxyAgent(current_proxy.connection_string)
          response = await undiciFetch(url, {
            ...attempt_options,
            dispatcher: proxyAgent
          })
        } else {
          // No proxy available, fall back to direct
          retry_log(
            `Attempt ${attempt + 1}/${max_retries + 1} for ${url} (no proxy available in pool '${proxy_pool}', using direct)`
          )
          response = await fetch(url, attempt_options)
        }
      } else {
        retry_log(`Attempt ${attempt + 1}/${max_retries + 1} for ${url}`)
        response = await fetch(url, attempt_options)
      }

      if (!response.ok) {
        const proxy_info = current_proxy
          ? ` (proxy: ${proxy_display_label(current_proxy.key)}, pool: ${current_proxy.pool_name})`
          : ' (direct)'
        throw new Error(
          `HTTP ${response.status}: ${response.statusText}${proxy_info}`
        )
      }

      // Reset proxy manager retry count on success
      if (use_proxy && current_proxy) {
        proxy_manager.reset_retry_count(current_proxy.pool_name)
      }

      // Return parsed response if response_type specified
      if (response_type) {
        return response[response_type]()
      }

      return response
    } catch (error) {
      last_error = error

      // A requires_proxy refusal is a configuration fact, not a transient: no
      // number of retries makes an unconfigured pool resolve, and swallowing it
      // into the backoff would delay the signal and end in the same throw.
      if (error instanceof ProxyRequirementError) {
        throw error
      }

      // If the caller's overall deadline fired, stop immediately — further
      // attempts and backoff sleeps would only burn time past the budget.
      if (signal?.aborted) {
        throw signal.reason ?? error
      }

      const proxy_info = current_proxy
        ? ` via proxy ${proxy_display_label(current_proxy.key)} (pool: ${current_proxy.pool_name})`
        : ' (direct)'
      retry_log(
        `Attempt ${attempt + 1} failed for ${url}${proxy_info}: ${error.message}`
      )

      // Mark proxy as failed if we were using one
      if (use_proxy && current_proxy) {
        retry_log(
          `Marking proxy ${proxy_display_label(current_proxy.key)} as failed`
        )
        proxy_manager.mark_proxy_failed(current_proxy)
        const stats = proxy_manager.get_pool_stats(current_proxy.pool_name)
        if (stats) {
          retry_log(
            `Pool '${current_proxy.pool_name}' remaining: ${stats.working}/${stats.total}`
          )
        }
      }

      if (attempt === max_retries) {
        if (proxies_tried.length > 0) {
          const unique_proxies = [...new Set(proxies_tried)]
          retry_log(
            `All ${max_retries + 1} attempts failed. Proxies tried: ${unique_proxies.join(', ')}`
          )
        }
        throw error
      }

      // Exponential backoff delay (abortable via the overall deadline signal)
      const delay = Math.min(initial_delay * Math.pow(2, attempt), max_delay)
      retry_log(`Waiting ${delay}ms before retry...`)
      await sleep(delay, signal)
    }
  }

  throw last_error
}

export {
  proxy_manager,
  fetch_with_proxy,
  fetch_via_proxy_raw,
  ProxyPool,
  ProxyRequirementError
}
export default fetch_with_proxy
