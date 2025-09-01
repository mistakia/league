import Redis from 'ioredis'
import os from 'os'

// Create a function to get the Redis client
const get_redis_client = () => {
  const hostname = os.hostname()
  const allowed_hostnames = ['league-production']

  if (
    process.env.NODE_ENV === 'production' &&
    allowed_hostnames.includes(hostname)
  ) {
    return new Redis({
      host: 'localhost',
      port: 6379
    })
  }
  return null
}

// Initialize the Redis client only in production
const redis_client = get_redis_client()

class RedisCacheAdapter {
  constructor(client) {
    this.client = client
  }

  async get(key) {
    if (!this.client) {
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
