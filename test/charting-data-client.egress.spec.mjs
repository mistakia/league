/* global describe, it */
import * as chai from 'chai'

import { ChartingDataClient } from '#libs-server/charting-data/index.mjs'

const expect = chai.expect

// proxy-manager is fail-open twice, and both fall-throughs are log-only: an
// unresolved pool name silently uses the shared rotating `default` pool, and a
// pool that yields no proxy silently fetches direct from the host WAN. Either
// one puts this vendor's traffic on the address the pinning exists to avoid,
// while the fetch still succeeds -- so nothing reports it.
//
// test/proxy-manager.selection.spec.mjs already proves fetch_with_retry refuses
// on both branches. What it cannot prove is that this client ASKS for the
// refusal. That is what these two cases cover, by round trip through the real
// client rather than by reading the source: with requires_proxy unthreaded,
// both would resolve to a working egress and return, not throw.
describe('LIBS-SERVER ChartingDataClient egress', function () {
  this.timeout(30000)

  it('defaults to the sticky residential pool', () => {
    expect(new ChartingDataClient().proxy_pool).to.equal('nfl_pro')
  })

  it('refuses a pool that does not resolve rather than using the default pool', async () => {
    const client = new ChartingDataClient({
      proxy_pool: 'pool_that_does_not_exist',
      max_retries: 0
    })

    let threw = null
    try {
      await client.get_plays({ game_id: 'irrelevant' })
    } catch (err) {
      threw = err
    }

    expect(threw).to.not.equal(null)
    expect(threw.message).to.match(/requires_proxy/i)
    expect(threw.message).to.match(/pool_that_does_not_exist/)
  })

  // The escape hatch has to keep working, or the refusal is just an outage.
  // --no_proxy sets use_proxy false, and requires_proxy tracks use_proxy, so
  // this must NOT be a requires_proxy refusal -- it reaches the network and
  // fails on something else.
  it('does not refuse when the caller opted out of proxying entirely', async () => {
    const client = new ChartingDataClient({
      use_proxy: false,
      proxy_pool: 'pool_that_does_not_exist',
      max_retries: 0
    })

    let threw = null
    try {
      await client.request({ path: '/api/plays/list/', params: {} })
    } catch (err) {
      threw = err
    }

    if (threw) expect(threw.message).to.not.match(/requires_proxy/i)
  })
})
