import { ProxyAgent, fetch as undiciFetch } from 'undici'
import debug from 'debug'

import db from '#db'

const log = debug('proxy-manager')

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
const parse_proxy_string = (proxy_str) => {
  const parts = proxy_str.split(':')

  const [host, port, username, password] = parts
  if (username && password) {
    const proxy_config = {
      host,
      port,
      username,
      password,
      protocol: 'http'
    }
    proxy_config.connection_string = `http://${username}:${password}@${host}:${port}`
    return proxy_config
  }
  const proxy_config = {
    host,
    port,
    protocol: 'http'
  }
  proxy_config.connection_string = `http://${host}:${port}`
  return proxy_config
}

// ProxyPool manages a single pool of proxies with round-robin selection
class ProxyPool {
  constructor(name) {
    this.name = name
    this.proxies = new Map()
    this.proxy_keys = []
    this.round_robin_index = 0
    this.retry_count = 0
    this.base_delay = 60000 // 1 minute base delay
  }

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
      `[${this.name}] Reset ${failed_keys.length} failed proxies: ${failed_keys.join(', ')}`
    )
  }

  all_proxies_failed() {
    return Array.from(this.proxies.values()).every((p) => p.failed)
  }

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
      await sleep(delay, signal)
      this.reset_failed_proxies()
    }

    // Round-robin selection: try each proxy in order, skipping failed ones
    const proxy_count = this.proxy_keys.length
    let attempts = 0

    while (attempts < proxy_count) {
      const key = this.proxy_keys[this.round_robin_index]
      this.round_robin_index = (this.round_robin_index + 1) % proxy_count

      const proxy = this.proxies.get(key)
      if (proxy && !proxy.failed) {
        proxy.last_used = Date.now()
        log(`[${this.name}] Selected proxy (round-robin): ${key}`)
        return { key, ...proxy, pool_name: this.name }
      }

      attempts++
    }

    return null
  }

  mark_proxy_failed(proxy_config) {
    for (const [key, proxy] of this.proxies.entries()) {
      if (proxy.connection_string === proxy_config.connection_string) {
        log(`[${this.name}] Marking proxy ${key} as failed`)
        proxy.failed = true
        return
      }
    }
  }

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
        .select('key', 'value')

      for (const config of configs) {
        if (!config.value) continue

        // Determine pool name from config key
        // proxy_config -> default, proxy_config_pinnacle -> pinnacle
        const pool_name =
          config.key === 'proxy_config'
            ? 'default'
            : config.key.replace('proxy_config_', '')

        const pool = new ProxyPool(pool_name)
        const proxy_list = config.value

        for (const proxy_str of proxy_list) {
          pool.add_proxy(proxy_str)
        }

        this.pools.set(pool_name, pool)
        log(`Initialized pool '${pool_name}' with ${pool.proxies.size} proxies`)
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
      log(`Fetching ${url} via proxy ${proxy_config.connection_string}`)

      const proxyAgent = new ProxyAgent(proxy_config.connection_string)

      const fetch_options = {
        ...options,
        dispatcher: proxyAgent
      }

      const response = await undiciFetch(url, fetch_options)

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: ${response.statusText} (proxy: ${proxy_config.key})`
        )
      }

      // Reset retry count on success
      proxy_manager.reset_retry_count(proxy_config.pool_name)

      return response
    } catch (error) {
      log(
        `Error with proxy ${proxy_config.connection_string}: ${error.message}`
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
export async function fetch_with_retry({
  url,
  method,
  headers,
  body,
  max_retries = 3,
  initial_delay = 1000,
  max_delay = 10000,
  use_proxy = false,
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
        current_proxy = await proxy_manager.get_working_proxy(proxy_pool, signal)

        if (current_proxy) {
          retry_log(
            `Attempt ${attempt + 1}/${max_retries + 1} for ${url} via proxy ${current_proxy.key} (pool: ${current_proxy.pool_name})`
          )
          proxies_tried.push(current_proxy.key)
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
          ? ` (proxy: ${current_proxy.key}, pool: ${current_proxy.pool_name})`
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

      // If the caller's overall deadline fired, stop immediately — further
      // attempts and backoff sleeps would only burn time past the budget.
      if (signal?.aborted) {
        throw signal.reason ?? error
      }

      const proxy_info = current_proxy
        ? ` via proxy ${current_proxy.key} (pool: ${current_proxy.pool_name})`
        : ' (direct)'
      retry_log(
        `Attempt ${attempt + 1} failed for ${url}${proxy_info}: ${error.message}`
      )

      // Mark proxy as failed if we were using one
      if (use_proxy && current_proxy) {
        retry_log(`Marking proxy ${current_proxy.key} as failed`)
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

export { proxy_manager, fetch_with_proxy }
export default fetch_with_proxy
