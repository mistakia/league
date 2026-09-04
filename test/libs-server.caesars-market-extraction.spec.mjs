/* global describe, it */

import * as chai from 'chai'

import {
  extract_markets_from_v4_payload,
  is_futures_market
} from '#libs-server/caesars/caesars-market-extraction.mjs'

const expect = chai.expect

const market = (id, metadata = {}) => ({ id, metadata })

const wrapped = (markets) => ({
  event: { keyMarketGroups: [{ markets }] }
})

const bare = (markets) => ({ keyMarketGroups: [{ markets }] })

describe('libs-server caesars market extraction', function () {
  // The four cases the wrapper flag exists to separate. The fourth is the one
  // that matters: it must THROW, because that throw is the event path's only
  // shape check against the vendor's silent default-tab fallback.
  describe('the event wrapper flag', function () {
    it('reads a wrapped payload with the flag defaulted true', function () {
      const markets = extract_markets_from_v4_payload(
        wrapped([market('a'), market('b')])
      )
      expect(markets.map((m) => m.id)).to.deep.equal(['a', 'b'])
    })

    it('reads a wrapped payload with the flag false', function () {
      const markets = extract_markets_from_v4_payload(wrapped([market('a')]), {
        require_event_wrapper: false
      })
      expect(markets.map((m) => m.id)).to.deep.equal(['a'])
    })

    it('reads a bare payload with the flag false', function () {
      const markets = extract_markets_from_v4_payload(bare([market('a')]), {
        require_event_wrapper: false
      })
      expect(markets.map((m) => m.id)).to.deep.equal(['a'])
    })

    it('THROWS on a bare payload with the flag defaulted true', function () {
      expect(() =>
        extract_markets_from_v4_payload(bare([market('a')]))
      ).to.throw(/Expected event wrapper/)
    })

    // The default is the guard. A call site added without thought must inherit
    // the strict behaviour rather than lose it, so pin the default itself
    // rather than only the explicit-true case.
    it('defaults to requiring the wrapper', function () {
      expect(() => extract_markets_from_v4_payload(bare([]))).to.throw()
      expect(() =>
        extract_markets_from_v4_payload(bare([]), {
          require_event_wrapper: false
        })
      ).to.not.throw()
    })
  })

  describe('payloads carrying no markets', function () {
    it('returns empty when keyMarketGroups is absent', function () {
      expect(extract_markets_from_v4_payload({ event: {} })).to.deep.equal([])
    })

    it('returns empty when keyMarketGroups is not an array', function () {
      expect(
        extract_markets_from_v4_payload({ event: { keyMarketGroups: {} } })
      ).to.deep.equal([])
    })

    it('flattens across several groups', function () {
      const payload = {
        event: {
          keyMarketGroups: [
            { markets: [market('a')] },
            { markets: [market('b'), market('c')] },
            { markets: null }
          ]
        }
      }
      expect(
        extract_markets_from_v4_payload(payload).map((m) => m.id)
      ).to.deep.equal(['a', 'b', 'c'])
    })

    it('returns empty rather than throwing on an absent payload', function () {
      expect(extract_markets_from_v4_payload(null)).to.deep.equal([])
    })
  })

  // THE GRAIN RULE. Admitting a game-grain market into the futures walk writes
  // it with a null esbid, which is the defect that cost 414,963 rows.
  describe('the futures grain rule', function () {
    it('admits a market carrying no event key', function () {
      expect(is_futures_market(market('a', { pricingSource: 'x' }))).to.equal(
        true
      )
    })

    it('rejects a market carrying sourceEventKey', function () {
      expect(
        is_futures_market(market('a', { sourceEventKey: 'game-123' }))
      ).to.equal(false)
    })

    it('admits a market with no metadata at all', function () {
      expect(is_futures_market({ id: 'a' })).to.equal(true)
    })

    // The two readings must DIFFER on the same input set, or the filter is
    // vacuous. This is the pair, not a single-sided assertion.
    it('separates a mixed tab into two non-empty halves', function () {
      const mixed = [
        market('futures-1', { pricingSource: 'x' }),
        market('game-1', { sourceEventKey: 'g1' }),
        market('futures-2', {}),
        market('game-2', { sourceEventKey: 'g2' })
      ]

      const admitted = mixed.filter(is_futures_market).map((m) => m.id)
      const rejected = mixed
        .filter((m) => !is_futures_market(m))
        .map((m) => m.id)

      expect(admitted).to.deep.equal(['futures-1', 'futures-2'])
      expect(rejected).to.deep.equal(['game-1', 'game-2'])
    })
  })
})
