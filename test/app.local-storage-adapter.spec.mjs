/* global describe it beforeEach */
import * as chai from 'chai'

import { setupLocalStorageMock } from '#test/mocks/localStorage.mjs'
import { localStorageAdapter } from '#app/core/utils/local-storage.js'

const { expect } = chai

// localStorageAdapter is the read/write path for the persisted auth token:
// app/views/components/app/app.js reads 'token' through getItem on load.
// getItem used to reject on any stored value that was not JSON, and that
// rejection fired inside the app's on-load init with no handler — a raw JWT
// (written by something other than setItem, which always JSON-stringifies)
// under 'token' made the page never load (signal 125587).
describe('localStorageAdapter', () => {
  beforeEach(() => {
    setupLocalStorageMock()
  })

  it('round-trips a value through setItem/getItem', async () => {
    localStorageAdapter.setItem('key', { a: 1 })
    expect(await localStorageAdapter.getItem('key')).to.deep.equal({ a: 1 })
  })

  it('resolves null for an absent key', async () => {
    expect(await localStorageAdapter.getItem('missing')).to.equal(null)
  })

  it('resolves the raw value when the stored data is not JSON', async () => {
    // The production shape is a raw JWT (no surrounding quotes, so
    // JSON.parse throws) stored under the token key. Any non-JSON value
    // demonstrates the same contract.
    const raw_value = 'this-is-not-json'
    localStorage.setItem('token', raw_value)
    expect(await localStorageAdapter.getItem('token')).to.equal(raw_value)
  })
})
