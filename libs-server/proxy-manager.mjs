import fetch from 'node-fetch'
import debug from 'debug'
import { HttpsProxyAgent } from 'https-proxy-agent'

import db from '#db'

const log = debug('proxy-manager')

// Parse proxy strings into proxy URLs
const parse_proxy_string = (proxy_str) => {
  const parts = proxy_str.split(':')

  const [host, port, username, password] = parts
  if (username && password) {
    const proxy_config = {
      host,
      port,
      username,
      password,
      protocol: 'https'
    }
    proxy_config.connection_string = `https://${username}:${password}@${host}:${port}`
    return proxy_config
  }
  const proxy_config = {
    host,
    port,
    protocol: 'https'
  }
  proxy_config.connection_string = `https://${host}:${port}`
  return proxy_config
}

class ProxyManager {
  constructor() {
    this.proxies = new Map()
    this.proxy_keys = [] // Ordered list of proxy keys for round-robin
    this.round_robin_index = 0 // Current position in round-robin rotation
    this.retry_count = 0
    this.base_delay = 60000 // 1 minute base delay
    this.initialized = false
  }

  async initialize() {
    if (this.initialized) return

    try {
      const proxy_config = await db('config')
        .where({ key: 'proxy_config' })
        .first()

      if (proxy_config && proxy_config.value) {
        const proxy_list = proxy_config.value

        for (const proxy_str of proxy_list) {
          const proxy_config = parse_proxy_string(proxy_str)
          const key = proxy_str.split(':').slice(0, 3).join(':')
          this.proxies.set(key, {
            ...proxy_config,
            failed: false,
            last_used: 0
          })
          this.proxy_keys.push(key)
        }
        log(`Initialized ${this.proxies.size} proxies from database`)
      } else {
        log('No proxies found in database')
      }

      this.initialized = true
    } catch (error) {
      log(`Error initializing proxies: ${error.message}`)
      throw error
    }
  }

  reset_failed_proxies() {
    for (const proxy of this.proxies.values()) {
      proxy.failed = false
    }
    log('Reset all failed proxies')
  }

  all_proxies_failed() {
    return Array.from(this.proxies.values()).every((p) => p.failed)
  }

  async get_working_proxy() {
    await this.initialize()

    // If no proxies are configured, return null
    if (this.proxies.size === 0) {
      log('No proxies available')
      return null
    }

    // If all proxies failed, reset them and add exponential backoff
    if (this.all_proxies_failed()) {
      this.retry_count++
      const delay = this.base_delay * Math.pow(2, this.retry_count - 1)
      log(
        `All proxies failed. Waiting ${delay}ms before retry #${this.retry_count}`
      )
      await new Promise((resolve) => setTimeout(resolve, delay))
      this.reset_failed_proxies()
    }

    // Round-robin selection: try each proxy in order, skipping failed ones
    const proxy_count = this.proxy_keys.length
    let attempts = 0

    while (attempts < proxy_count) {
      const key = this.proxy_keys[this.round_robin_index]
      // Advance index for next call (atomic increment before returning)
      this.round_robin_index = (this.round_robin_index + 1) % proxy_count

      const proxy = this.proxies.get(key)
      if (proxy && !proxy.failed) {
        proxy.last_used = Date.now()
        log(`Selected proxy (round-robin): ${key}`)
        return { key, ...proxy }
      }

      attempts++
    }

    return null // All proxies failed (should be handled by reset above)
  }

  mark_proxy_failed(proxy_config) {
    for (const [key, proxy] of this.proxies.entries()) {
      // Compare the connection strings for equality
      if (proxy.connection_string === proxy_config.connection_string) {
        log(`Marking proxy ${key} as failed`)
        proxy.failed = true
        return
      }
    }
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

      const agent = new HttpsProxyAgent(proxy_config.connection_string, {
        rejectUnauthorized: false
      })

      const fetch_options = {
        ...options,
        agent
      }

      const response = await fetch(url, fetch_options)

      // Reset retry count on success
      proxy_manager.retry_count = 0

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
  response_type
} = {}) {
  if (!url) {
    throw new Error('url is required')
  }

  const retry_log = debug('fetch-with-retry')

  const fetch_options = {}
  if (method) fetch_options.method = method
  if (headers) fetch_options.headers = headers
  if (body) fetch_options.body = body

  let last_error
  let current_proxy = null

  for (let attempt = 0; attempt <= max_retries; attempt++) {
    try {
      let response

      if (use_proxy) {
        // Get a working proxy (rotates on failure)
        await proxy_manager.initialize()
        current_proxy = await proxy_manager.get_working_proxy()

        if (current_proxy) {
          retry_log(
            `Attempt ${attempt + 1}/${max_retries + 1} for ${url} via proxy ${current_proxy.key}`
          )
          const agent = new HttpsProxyAgent(current_proxy.connection_string, {
            rejectUnauthorized: false
          })
          response = await fetch(url, { ...fetch_options, agent })
        } else {
          // No proxy available, fall back to direct
          retry_log(
            `Attempt ${attempt + 1}/${max_retries + 1} for ${url} (no proxy available, using direct)`
          )
          response = await fetch(url, fetch_options)
        }
      } else {
        retry_log(`Attempt ${attempt + 1}/${max_retries + 1} for ${url}`)
        response = await fetch(url, fetch_options)
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      // Reset proxy manager retry count on success
      if (use_proxy) {
        proxy_manager.retry_count = 0
      }

      // Return parsed response if response_type specified
      if (response_type) {
        return response[response_type]()
      }

      return response
    } catch (error) {
      last_error = error
      retry_log(`Attempt ${attempt + 1} failed for ${url}: ${error.message}`)

      // Mark proxy as failed if we were using one
      if (use_proxy && current_proxy) {
        proxy_manager.mark_proxy_failed(current_proxy)
      }

      if (attempt === max_retries) {
        throw error
      }

      // Exponential backoff delay
      const delay = Math.min(initial_delay * Math.pow(2, attempt), max_delay)
      retry_log(`Waiting ${delay}ms before retry...`)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw last_error
}

export { proxy_manager, fetch_with_proxy }
export default fetch_with_proxy
