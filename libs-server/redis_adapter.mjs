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
    const value = await this.client.get(key)
    return value ? JSON.parse(value) : null
  }

  async set(key, value, ttl) {
    if (ttl) {
      await this.client.set(key, JSON.stringify(value), 'EX', ttl)
    } else {
      await this.client.set(key, JSON.stringify(value))
    }
  }

  async expire(key, ttl) {
    await this.client.expire(key, ttl)
  }

  async expire_at(key, timestamp) {
    await this.client.expireat(key, timestamp)
  }

  async persist(key) {
    await this.client.persist(key)
  }
}

// Create the redis_cache only if redis_client exists
const redis_cache = redis_client ? new RedisCacheAdapter(redis_client) : null

export { redis_client, RedisCacheAdapter, redis_cache }
