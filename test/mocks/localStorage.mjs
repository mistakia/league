/**
 * Mock localStorage implementation for testing
 *
 * Provides an in-memory implementation of the Web Storage API's localStorage
 * interface for use in Node.js test environments.
 */

/**
 * Creates a new mock localStorage instance
 *
 * @returns {Object} localStorage-compatible mock object
 */
export const createMockLocalStorage = () => {
  let store = {}

  return {
    /**
     * Get an item from storage
     * @param {string} key - The key to retrieve
     * @returns {string|null} The stored value or null
     */
    getItem(key) {
      return store[key] || null
    },

    /**
     * Set an item in storage
     * @param {string} key - The key to store under
     * @param {string} value - The value to store
     */
    setItem(key, value) {
      store[key] = String(value)
    },

    /**
     * Remove an item from storage
     * @param {string} key - The key to remove
     */
    removeItem(key) {
      delete store[key]
    },

    /**
     * Clear all items from storage
     */
    clear() {
      store = {}
    },

    /**
     * Get the number of items in storage
     * @returns {number} The number of stored items
     */
    get length() {
      return Object.keys(store).length
    },

    /**
     * Get the key at a specific index
     * @param {number} index - The index to retrieve
     * @returns {string|null} The key at that index or null
     */
    key(index) {
      const keys = Object.keys(store)
      return keys[index] || null
    }
  }
}

/**
 * Setup global localStorage mock for tests
 * Attaches the mock to the global object so it can be used by the code under test
 *
 * @returns {Object} The created localStorage mock
 */
export const setupLocalStorageMock = () => {
  global.localStorage = createMockLocalStorage()
  return global.localStorage
}
