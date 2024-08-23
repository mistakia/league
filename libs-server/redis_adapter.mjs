import Redis from 'ioredis'

// Create a function to get the Redis client
const get_redis_client = () => {
  if (process.env.NODE_ENV === 'production') {
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
    await this.client.set(key, JSON.stringify(value), 'EX', ttl)
  }
}

// Create the data_view_cache only if redis_client exists
const data_view_cache = redis_client
  ? new RedisCacheAdapter(redis_client)
  : null

export { redis_client, RedisCacheAdapter, data_view_cache }
