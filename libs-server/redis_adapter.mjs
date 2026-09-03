import Redis from 'ioredis'

// WHY THE GATE IS AN ENVIRONMENT VARIABLE AND NOT A HOSTNAME.
//
// This module used to construct the client only when `os.hostname()` was the
// literal string 'league-production'. That is a coupling to one machine's NAME,
// and it fails as APPARENT SUCCESS everywhere else: every method below
// short-circuits on a null client and returns a success-shaped value, and the
// `console.warn` calls live in `catch` blocks that a null client never reaches.
// A production process on a differently-named box therefore loses three
// controls at once, silently -- the result cache vanishes (every data-view
// request goes to SQL, which reads as a planner regression and misdirects the
// next investigation), the `data_view_sql:enabled` kill switch reads as
// permanently enabled, and all three generation spend limits stop enforcing.
//
// The gate is now explicit configuration, so serving from a new host is a
// decision someone makes rather than a string that happens to match. The
// variable is deliberately NOT defaulted to localhost: several scripts run
// `NODE_ENV=production` on a developer machine (`debug:data-view`,
// `debug:plays-view`, `invite`), and a default would point them at whatever
// happened to be listening on 6379 there.
//
// UNSET IS A DEPLOYMENT MISTAKE, NOT AN OUTAGE, and the two must not be
// conflated. Reachability flaps; configuration does not. So the server refuses
// to boot when the variable is unset (`assert_redis_configured`, called from
// server.mjs) while an unreachable Redis is only logged -- which is also what
// keeps the absence-means-enabled semantics in data-view-sql-kill-switch.mjs
// and generation-limits.mjs sound, since those were reasoned about a REACHABLE
// Redis returning null for an unset key.

export const REDIS_HOST_ENV = 'LEAGUE_REDIS_HOST'
export const REDIS_PORT_ENV = 'LEAGUE_REDIS_PORT'

const DEFAULT_REDIS_PORT = 6379

// At most one line per interval per process. ioredis reconnects forever, so an
// unreachable Redis otherwise fills the log at the retry rate and buries the
// first occurrence, which is the one that carries the timestamp anyone wants.
const ERROR_LOG_INTERVAL_MS = 60 * 1000

/**
 * Whether this process is configured to talk to Redis, and to what.
 *
 * Split out from client construction so both the startup assertion and a test
 * can ask the question without opening a socket.
 *
 * @param {object} [env] - defaults to process.env
 * @returns {{configured: boolean, reason?: string, host?: string, port?: number}}
 */
export const describe_redis_readiness = (env = process.env) => {
  const host = (env[REDIS_HOST_ENV] || '').trim()
  if (!host) {
    return { configured: false, reason: `${REDIS_HOST_ENV} is not set` }
  }

  const raw_port = (env[REDIS_PORT_ENV] || '').trim()
  if (!raw_port) {
    return { configured: true, host, port: DEFAULT_REDIS_PORT }
  }

  const port = Number(raw_port)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    return {
      configured: false,
      reason: `${REDIS_PORT_ENV} is ${JSON.stringify(raw_port)}, which is not a port number`
    }
  }

  return { configured: true, host, port }
}

const create_redis_client = () => {
  const readiness = describe_redis_readiness()
  if (!readiness.configured) return null

  const client = new Redis({ host: readiness.host, port: readiness.port })

  // ioredis emits 'error' on a plain EventEmitter. With no listener attached,
  // the first failed reconnect throws an unhandled 'error' and takes the
  // process down -- so this listener is what keeps a Redis blip a degradation
  // rather than an API outage, and it is also the only place an unreachable
  // Redis is visible at all.
  let last_error_log_at = 0
  client.on('error', (error) => {
    const now = Date.now()
    if (now - last_error_log_at < ERROR_LOG_INTERVAL_MS) return
    last_error_log_at = now
    console.warn(
      `Redis connection error (${readiness.host}:${readiness.port}):`,
      error.message
    )
  })

  return client
}

const redis_client = create_redis_client()

/**
 * Refuse to serve without Redis, by name and at startup.
 *
 * Called from server.mjs and from nothing else on purpose. The API process is
 * the one that serves untrusted callers, so it is the one whose spend limits
 * and kill switch must be real; ad-hoc production-mode scripts are run by the
 * operator and keep working against the no-op cache.
 *
 * Throws rather than logging because the condition it detects cannot heal:
 * `LEAGUE_REDIS_HOST` is either set at exec time or it is not, and a process
 * that starts without it serves for its whole lifetime with the limits off.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.is_production]
 * @param {object} [opts.env]
 */
export const assert_redis_configured = ({
  is_production = process.env.NODE_ENV === 'production',
  env = process.env
} = {}) => {
  if (!is_production) return

  const readiness = describe_redis_readiness(env)
  if (readiness.configured) return

  throw new Error(
    `the API refuses to start without Redis: ${readiness.reason}. ` +
      `Redis backs the data-view result cache, the ${'data_view_sql:enabled'} kill switch ` +
      `and all three generation spend limits, and each of those fails OPEN and silently without it. ` +
      `Set ${REDIS_HOST_ENV} (and ${REDIS_PORT_ENV} if not ${DEFAULT_REDIS_PORT}) in the pm2 environment.`
  )
}

/**
 * Confirm the configured Redis actually answers, without making it fatal.
 *
 * Reachability is the half that flaps, so this reports and returns instead of
 * throwing -- a wrong host or a closed port is loud in the log and in the
 * signal queue, and a transient one heals on its own. Mirrors
 * escalate_drainer_not_started.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.is_production]
 * @param {{error: Function}} [opts.logger]
 * @returns {Promise<boolean>} true when a problem was escalated
 */
export const escalate_redis_unreachable = async ({
  is_production = process.env.NODE_ENV === 'production',
  logger
} = {}) => {
  if (!is_production || !redis_client) return false

  try {
    await redis_client.ping()
    return false
  } catch (error) {
    logger?.error(
      `Redis is configured but did not answer PING: ${error.message}`,
      {
        severity: 'high',
        context: { reason: error.message }
      }
    )
    return true
  }
}

// Whether a client exists at all, as distinct from whether it is reachable.
export const is_redis_configured = () => Boolean(redis_client)

class RedisCacheAdapter {
  constructor(client) {
    this.client = client
    this.warned_unconfigured = false
  }

  // A null client makes every method below a success-shaped no-op. That is the
  // intended behavior off-server, but it must not be a SILENT one -- once per
  // process is enough to tell someone reading a script's output why nothing is
  // cached, without a line per call.
  warn_unconfigured(method) {
    if (this.warned_unconfigured) return
    this.warned_unconfigured = true
    console.warn(
      `Redis is not configured (${REDIS_HOST_ENV} unset); redis_cache.${method} and every later call are no-ops`
    )
  }

  async get(key) {
    if (!this.client) {
      this.warn_unconfigured('get')
      return null
    }
    try {
      const value = await this.client.get(key)
      return value ? JSON.parse(value) : null
    } catch (error) {
      console.warn(`Redis get error for key ${key}:`, error.message)
      return null
    }
  }

  async set(key, value, ttl) {
    if (!this.client) {
      this.warn_unconfigured('set')
      return
    }
    try {
      if (ttl) {
        await this.client.set(key, JSON.stringify(value), 'EX', ttl)
      } else {
        await this.client.set(key, JSON.stringify(value))
      }
    } catch (error) {
      console.warn(`Redis set error for key ${key}:`, error.message)
    }
  }

  async expire(key, ttl) {
    if (!this.client) {
      this.warn_unconfigured('expire')
      return
    }
    try {
      await this.client.expire(key, ttl)
    } catch (error) {
      console.warn(`Redis expire error for key ${key}:`, error.message)
    }
  }

  async expire_at(key, timestamp) {
    if (!this.client) {
      this.warn_unconfigured('expire_at')
      return
    }
    try {
      await this.client.expireat(key, timestamp)
    } catch (error) {
      console.warn(`Redis expire_at error for key ${key}:`, error.message)
    }
  }

  async persist(key) {
    if (!this.client) {
      this.warn_unconfigured('persist')
      return
    }
    try {
      await this.client.persist(key)
    } catch (error) {
      console.warn(`Redis persist error for key ${key}:`, error.message)
    }
  }

  async keys(pattern) {
    if (!this.client) {
      this.warn_unconfigured('keys')
      return []
    }
    try {
      return await this.client.keys(pattern)
    } catch (error) {
      console.warn(`Redis keys error for pattern ${pattern}:`, error.message)
      return []
    }
  }

  async del(key) {
    if (!this.client) {
      this.warn_unconfigured('del')
      return 0
    }
    try {
      return await this.client.del(key)
    } catch (error) {
      console.warn(`Redis del error for key ${key}:`, error.message)
      return 0
    }
  }
}

// Create the redis_cache with fallback to no-op implementation
const redis_cache = new RedisCacheAdapter(redis_client)

export { redis_client, RedisCacheAdapter, redis_cache }
