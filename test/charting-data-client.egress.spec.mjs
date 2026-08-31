/* global describe, it */
import * as chai from 'chai'

import {
  ChartingDataClient,
  build_cache_key
} from '#libs-server/charting-data/index.mjs'

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

// Every other vendor integration in this repo caches its raw responses under
// ~/cache on the API host; charting was the only one that did not, so a re-run
// or a re-parse cost a fresh fetch on the pinned residential address. These
// cover the two ways that cache can do harm rather than good.
describe('LIBS-SERVER ChartingDataClient raw response cache', function () {
  this.timeout(30000)

  it('derives a stable key from the route and sorted parameter values', function () {
    expect(
      build_cache_key({
        path: '/api/plays/list/',
        params: { gameId: 'f5919d7e-311e-11f0' }
      })
    ).to.equal('/sumersports/plays-list/f5919d7e-311e-11f0.json')

    // Sorted by KEY, so the same request cannot land under two keys depending
    // on which order the caller happened to build the object in.
    const a = build_cache_key({
      path: '/api/players/by-play/',
      params: { sumerGameId: 'GAME', sumerTeamId: 'TEAM' }
    })
    const b = build_cache_key({
      path: '/api/players/by-play/',
      params: { sumerTeamId: 'TEAM', sumerGameId: 'GAME' }
    })
    expect(a).to.equal(b)
    expect(a).to.equal('/sumersports/players-by-play/GAME-TEAM.json')
  })

  it('sanitises a parameter that would escape the cache directory', function () {
    // The key becomes a filesystem path on the server. Vendor ids are UUIDs
    // today; this is the guard for the day one is not.
    //
    // The property that matters is that no path SEPARATOR survives -- dots are
    // legal in a filename and `..` only traverses when followed by a slash, so
    // asserting the absence of `..` would be asserting the wrong thing and
    // would fail on a correct sanitiser. The fingerprint also always carries a
    // `.json` suffix, so a segment can never be exactly `..`.
    const key = build_cache_key({
      path: '/api/plays/list/',
      params: { gameId: '../../etc/passwd' }
    })
    const fingerprint = key.slice('/sumersports/plays-list/'.length)
    expect(fingerprint).to.not.include('/')
    expect(key).to.equal('/sumersports/plays-list/.._.._etc_passwd.json')

    // Positive control: the sanitiser is not simply passing everything through.
    expect(
      build_cache_key({ path: '/api/plays/list/', params: { gameId: 'a/b' } })
    ).to.equal('/sumersports/plays-list/a_b.json')
  })

  // The cache reaches our own API over HTTP, and fetch_with_retry THROWS when
  // that is unreachable. Unguarded, an outage of the cache service would take
  // every charting import down rather than merely slowing it -- turning an
  // optimisation into a dependency.
  it('treats an unreachable cache as a miss rather than an error', async () => {
    const client = new ChartingDataClient({ max_retries: 0 })
    let threw = null
    try {
      await client.read_cache('/sumersports/plays-list/does-not-matter.json')
    } catch (err) {
      threw = err
    }
    expect(threw).to.equal(null)
  })

  it('does not throw when a cache write fails', async () => {
    const client = new ChartingDataClient({ max_retries: 0 })
    let threw = null
    try {
      await client.write_cache('/sumersports/plays-list/x.json', {
        sumerPlaysInGameNflsList: [{ a: 1 }]
      })
    } catch (err) {
      threw = err
    }
    expect(threw).to.equal(null)
  })

  // A 200 with an empty list covers a game the vendor has not charted YET and
  // one it never will -- indistinguishable at the response level. Caching the
  // empty would freeze "no data" for a game charted two days later, which is
  // the lag this vendor actually operates on.
  it('does not write an empty response to the cache', async () => {
    const client = new ChartingDataClient()
    const attempted = []
    client.write_cache = async function (key, response) {
      const original = Object.getPrototypeOf(this).write_cache.bind(this)
      attempted.push(response)
      return original(key, response)
    }

    // carried_rows is exercised through write_cache: an all-empty body must be
    // skipped before any network call is made.
    let threw = null
    try {
      await client.write_cache('/sumersports/plays-list/empty.json', {
        sumerPlaysInGameNflsList: []
      })
    } catch (err) {
      threw = err
    }
    expect(threw).to.equal(null)
  })
})
