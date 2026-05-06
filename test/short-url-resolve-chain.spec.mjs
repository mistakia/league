/* global describe it */
import * as chai from 'chai'

import resolve_short_url_chain from '../app/views/pages/short-url-resolver/resolve-short-url-chain.mjs'

chai.should()
const expect = chai.expect

const make_fetcher = (mapping) => async (hash) => {
  if (!(hash in mapping)) {
    throw new Error(`unknown_hash:${hash}`)
  }
  return mapping[hash]
}

describe('resolve_short_url_chain', function () {
  it('returns the URL unchanged when pathname is canonical', async () => {
    const out = await resolve_short_url_chain({
      initial_url: 'https://xo.football/data-views?columns=%5B%22a%22%5D',
      fetch_url_by_hash: make_fetcher({})
    })
    out.pathname.should.equal('/data-views')
    out.searchParams.get('columns').should.equal('["a"]')
  })

  it('resolves a single /u/<hash> hop to the canonical inner URL', async () => {
    const out = await resolve_short_url_chain({
      initial_url: 'https://xo.football/u/abc',
      fetch_url_by_hash: make_fetcher({
        abc: 'https://xo.football/data-views?columns=%5B%22a%22%5D'
      })
    })
    out.pathname.should.equal('/data-views')
    out.searchParams.get('columns').should.equal('["a"]')
  })

  it('uses outer search params over inner when outer has params (chained shorten)', async () => {
    const out = await resolve_short_url_chain({
      initial_url:
        'https://xo.football/u/inner?columns=%5B%22outer%22%5D&view_id=outer-view',
      fetch_url_by_hash: make_fetcher({
        inner:
          'https://xo.football/data-views?columns=%5B%22inner%22%5D&view_id=inner-view'
      })
    })
    out.pathname.should.equal('/data-views')
    out.searchParams.get('columns').should.equal('["outer"]')
    out.searchParams.get('view_id').should.equal('outer-view')
  })

  it('falls back to inner search params when outer URL has no search', async () => {
    const out = await resolve_short_url_chain({
      initial_url: 'https://xo.football/u/inner',
      fetch_url_by_hash: make_fetcher({
        inner: 'https://xo.football/data-views?columns=%5B%22inner%22%5D'
      })
    })
    out.pathname.should.equal('/data-views')
    out.searchParams.get('columns').should.equal('["inner"]')
  })

  it('follows multi-hop chains (depth 2)', async () => {
    const out = await resolve_short_url_chain({
      initial_url: 'https://xo.football/u/a',
      fetch_url_by_hash: make_fetcher({
        a: 'https://xo.football/u/b?columns=%5B%22final%22%5D',
        b: 'https://xo.football/data-views?columns=%5B%22b%22%5D'
      })
    })
    out.pathname.should.equal('/data-views')
    out.searchParams.get('columns').should.equal('["final"]')
  })

  it('throws short_url_cycle when a hash references itself', async () => {
    let err
    try {
      await resolve_short_url_chain({
        initial_url: 'https://xo.football/u/loop',
        fetch_url_by_hash: make_fetcher({
          loop: 'https://xo.football/u/loop?columns=%5B%5D'
        })
      })
    } catch (e) {
      err = e
    }
    expect(err).to.be.an('error')
    err.message.should.equal('short_url_cycle')
  })

  it('throws short_url_max_depth_exceeded for chains beyond max_depth', async () => {
    const mapping = {}
    for (let i = 0; i < 10; i++) {
      mapping[`h${i}`] = `https://xo.football/u/h${i + 1}`
    }
    mapping.h10 = 'https://xo.football/data-views?columns=%5B%5D'

    let err
    try {
      await resolve_short_url_chain({
        initial_url: 'https://xo.football/u/h0',
        fetch_url_by_hash: make_fetcher(mapping),
        max_depth: 3
      })
    } catch (e) {
      err = e
    }
    expect(err).to.be.an('error')
    err.message.should.equal('short_url_max_depth_exceeded')
  })

  it('handles a /plays canonical inner URL', async () => {
    const out = await resolve_short_url_chain({
      initial_url: 'https://xo.football/u/inner?columns=%5B%22outer%22%5D',
      fetch_url_by_hash: make_fetcher({
        inner: 'https://xo.football/plays?columns=%5B%22inner%22%5D'
      })
    })
    out.pathname.should.equal('/plays')
    out.searchParams.get('columns').should.equal('["outer"]')
  })
})
