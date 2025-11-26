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

    // Find the least recently used non-failed proxy
    let selected_proxy = null
    let oldest_time = Infinity

    for (const [key, proxy] of this.proxies.entries()) {
      if (!proxy.failed && proxy.last_used < oldest_time) {
        selected_proxy = { key, ...proxy }
        oldest_time = proxy.last_used
      }
    }

    if (selected_proxy) {
      // Update last used time
      this.proxies.get(selected_proxy.key).last_used = Date.now()
      log(`Selected proxy: ${selected_proxy.key}`)
      return selected_proxy
    }

    return null // Should never reach here due to reset above
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

// Consolidated retry function that can work with or without proxy
export async function fetch_with_retry(url, options = {}, config = {}) {
  const {
    max_retries = 3,
    use_proxy = true,
    exponential_backoff = true,
    initial_delay = 1000,
    max_delay = 10000
  } = config

  const log = debug('fetch-with-retry')

  for (let attempt = 0; attempt <= max_retries; attempt++) {
    try {
      // Try direct fetch first
      const response = await fetch(url, options)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return response
    } catch (error) {
      log(`Attempt ${attempt + 1} failed for ${url}: ${error.message}`)

      if (attempt === max_retries) {
        throw error
      }

      // Try with proxy on first retry if enabled
      if (use_proxy && attempt === 0) {
        log('Retrying with proxy...')
        try {
          const proxy_response = await fetch_with_proxy({
            url,
            options: {
              ...options,
              method: options.method || 'GET',
              headers: options.headers
            }
          })

          if (!proxy_response.ok) {
            throw new Error(
              `HTTP ${proxy_response.status}: ${proxy_response.statusText}`
            )
          }

          return proxy_response
        } catch (proxy_error) {
          log(`Proxy attempt failed: ${proxy_error.message}`)
        }
      }

      // Exponential backoff delay
      if (exponential_backoff) {
        const delay = Math.min(initial_delay * Math.pow(2, attempt), max_delay)
        log(`Waiting ${delay}ms before retry...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }
}

export { proxy_manager, fetch_with_proxy }
export default fetch_with_proxy
