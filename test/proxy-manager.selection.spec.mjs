/* global describe it */

import * as chai from 'chai'

import {
  ProxyPool,
  proxy_manager,
  fetch_with_retry
} from '#libs-server/proxy-manager.mjs'

const expect = chai.expect

// Three distinct endpoints, the shape of the nfl_pro pool. Three rather than one
// because a single-entry pool trips all_proxies_failed() on any transient and
// pins its backoff at MAX_BACKOFF_MS -- the documented pinnacle wedge.
const NFL_PRO_ENDPOINTS = [
  '1.1.1.1:8000:user-a:pass-a',
  '2.2.2.2:8000:user-b:pass-b',
  '3.3.3.3:8000:user-c:pass-c'
]

const make_pool = (name, selection, endpoints = NFL_PRO_ENDPOINTS) => {
  const pool = new ProxyPool(name, { selection })
  for (const endpoint of endpoints) pool.add_proxy(endpoint)
  return pool
}

describe('LIBS-SERVER ProxyPool selection mode', function () {
  it('sticky returns the SAME entry across repeated calls', async () => {
    // The whole point of this task: a stable residential egress identity. Under
    // the default round-robin a three-entry pool delivers three rotating IPs,
    // which is the inverse of the goal.
    const pool = make_pool('nfl_pro', 'sticky')

    const first = await pool.get_working_proxy()
    expect(first).to.not.equal(null)

    for (let i = 0; i < 5; i++) {
      const next = await pool.get_working_proxy()
      expect(next.key).to.equal(first.key)
    }
  })

  it('sticky still skips an entry marked failed', async () => {
    // Failover must survive stickiness -- sticky means "do not rotate for its own
    // sake", not "never move off a dead endpoint".
    const pool = make_pool('nfl_pro', 'sticky')

    const first = await pool.get_working_proxy()
    pool.mark_proxy_failed(first)

    const second = await pool.get_working_proxy()
    expect(second).to.not.equal(null)
    expect(second.key).to.not.equal(first.key)
    expect(second.failed).to.equal(false)

    // And it is sticky on the NEW entry, rather than resuming rotation.
    const third = await pool.get_working_proxy()
    expect(third.key).to.equal(second.key)
  })

  it('round_robin stays the default and still rotates', async () => {
    // The existing two pools carry no selection field and must not change
    // behaviour, so an unspecified selection has to mean round_robin.
    const pool = make_pool('default', undefined)

    const first = await pool.get_working_proxy()
    const second = await pool.get_working_proxy()
    const third = await pool.get_working_proxy()

    expect(new Set([first.key, second.key, third.key]).size).to.equal(3)
  })

  it('an unknown selection value is rejected rather than silently rotating', async () => {
    // Fail loudly on a typo. proxy-manager's existing failure modes are all
    // fail-OPEN and log-only, and each one lands on the egress this task exists
    // to prevent, so a misspelled 'stickey' must not quietly mean round_robin.
    expect(() => new ProxyPool('nfl_pro', { selection: 'stickey' })).to.throw(
      /selection/i
    )
  })
})

describe('LIBS-SERVER fetch_with_retry requires_proxy', function () {
  it('refuses a missing pool instead of falling back to the default pool', async () => {
    // proxy-manager.mjs get_working_proxy falls back to the 'default' (Toolip)
    // pool when the named pool does not resolve. For NFL Pro that fallback is
    // exactly the shared-rotating egress the task removes, and it is log-only.
    let threw = null
    try {
      await fetch_with_retry({
        url: 'https://example.invalid/',
        use_proxy: true,
        requires_proxy: true,
        proxy_pool: 'pool_that_does_not_exist',
        max_retries: 0
      })
    } catch (err) {
      threw = err
    }

    expect(threw).to.not.equal(null)
    expect(threw.message).to.match(/requires_proxy/i)
    expect(threw.message).to.match(/pool_that_does_not_exist/)
  })

  it('refuses rather than falling through to a direct fetch', async () => {
    // The second fail-open path: a pool that resolves but yields no proxy falls
    // back to a DIRECT fetch, out of the host WAN. Registering an empty pool
    // reaches that branch without needing a live endpoint.
    await proxy_manager.initialize().catch(() => {})
    proxy_manager.pools.set('empty_pool', new ProxyPool('empty_pool'))

    let threw = null
    try {
      await fetch_with_retry({
        url: 'https://example.invalid/',
        use_proxy: true,
        requires_proxy: true,
        proxy_pool: 'empty_pool',
        max_retries: 0
      })
    } catch (err) {
      threw = err
    } finally {
      proxy_manager.pools.delete('empty_pool')
    }

    expect(threw).to.not.equal(null)
    expect(threw.message).to.match(/requires_proxy/i)
  })

  it('is opt-in: an unset requires_proxy leaves existing callers unchanged', async () => {
    // Every current caller omits the flag and must keep its fall-through
    // behaviour, so the refusal must not fire on the default path. This reaches
    // the network and fails on DNS instead -- the assertion is only that the
    // error is NOT the requires_proxy refusal.
    let threw = null
    try {
      await fetch_with_retry({
        url: 'https://example.invalid/',
        use_proxy: true,
        proxy_pool: 'pool_that_does_not_exist',
        max_retries: 0,
        timeout_ms: 5000
      })
    } catch (err) {
      threw = err
    }

    expect(threw).to.not.equal(null)
    expect(threw.message).to.not.match(/requires_proxy/i)
  })
})
