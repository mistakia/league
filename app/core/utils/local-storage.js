/* global localStorage */

export const localStorageAdapter = {
  getItem(key) {
    // return promise to match AsyncStorage usage on mobile
    return new Promise((resolve) => {
      let raw_data = null
      try {
        raw_data = localStorage.getItem(key)
        if (raw_data === null) {
          resolve(null)
          return
        }
        resolve(JSON.parse(raw_data))
      } catch (e) {
        // The stored value is not JSON, or storage is unreadable. setItem
        // always JSON-stringifies, so a non-JSON value was written by
        // something else — an extension, a stale bundle, or corruption.
        // Resolve rather than reject: this read feeds the app's on-load init
        // (app.js getItem('token')), and a rejection there turns one bad key
        // into a page that never loads (signal 125587, a raw JWT stored
        // under 'token').
        resolve(raw_data)
      }
    })
  },

  removeItem(key) {
    localStorage.removeItem(key)
  },

  setItem(key, value) {
    localStorage.setItem(key, JSON.stringify(value))
  }
}
