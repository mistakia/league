const DEFAULT_TTL_SECONDS = 600

class TTLCache {
  #store = new Map()
  #timers = new Map()

  get(key) {
    return this.#store.get(key)
  }

  set(key, value, ttl_seconds = DEFAULT_TTL_SECONDS) {
    const existing_timer = this.#timers.get(key)
    if (existing_timer) clearTimeout(existing_timer)

    this.#store.set(key, value)

    if (ttl_seconds > 0) {
      const timer = setTimeout(() => {
        this.#store.delete(key)
        this.#timers.delete(key)
      }, ttl_seconds * 1000)
      timer.unref?.()
      this.#timers.set(key, timer)
    }
    return true
  }

  del(key) {
    const timer = this.#timers.get(key)
    if (timer) clearTimeout(timer)
    this.#timers.delete(key)
    return this.#store.delete(key)
  }

  keys() {
    return Array.from(this.#store.keys())
  }
}

export default new TTLCache()
