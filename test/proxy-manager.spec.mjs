/* global describe it */

import * as chai from 'chai'

import { ProxyPool } from '#libs-server/proxy-manager.mjs'

const expect = chai.expect

// Build a pool with a single, already-failed proxy — the shape of the
// production `pinnacle` pool (one geonode proxy) after any transient trips
// all_proxies_failed().
const make_single_failed_pool = () => {
  const pool = new ProxyPool('pinnacle')
  pool.add_proxy('1.2.3.4:8000:user:pass')
  for (const proxy of pool.proxies.values()) {
    proxy.failed = true
  }
  return pool
}

describe('LIBS-SERVER ProxyPool.get_working_proxy', function () {
  it('resets the lone failed proxy even when the backoff sleep is aborted', async () => {
    const pool = make_single_failed_pool()

    // A pre-aborted deadline signal aborts the all-proxies-failed backoff sleep,
    // mirroring the 2-min matchups budget cutting short the single-proxy pinnacle
    // pool's (capped) backoff on every run.
    const controller = new AbortController()
    controller.abort()

    // The aborted backoff rejects, but the finally-guarded reset must still run.
    let rejected = false
    try {
      await pool.get_working_proxy(controller.signal)
    } catch (err) {
      rejected = true
    }
    expect(rejected).to.equal(true)

    // Before the try/finally fix the reset never ran on an aborted sleep, so the
    // lone proxy stayed failed and the pool was wedged for the process lifetime.
    // Now the failed flag is cleared, so the proxy is selectable on the next call.
    expect(pool.all_proxies_failed()).to.equal(false)

    const selected = await pool.get_working_proxy()
    expect(selected).to.not.equal(null)
    expect(selected.pool_name).to.equal('pinnacle')
    expect(selected.failed).to.equal(false)
  })

  it('selects the working proxy directly when none are failed', async () => {
    const pool = new ProxyPool('pinnacle')
    pool.add_proxy('1.2.3.4:8000:user:pass')

    const selected = await pool.get_working_proxy()
    expect(selected).to.not.equal(null)
    expect(selected.pool_name).to.equal('pinnacle')
    expect(selected.failed).to.equal(false)
  })
})
