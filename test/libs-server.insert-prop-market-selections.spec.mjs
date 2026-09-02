/* global describe, it */
import * as chai from 'chai'

import insert_prop_market_selections from '#libs-server/insert-prop-market-selections.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

const OBSERVED_AT = 1750000000

const market = {
  source_id: 'DRAFTKINGS',
  source_market_id: 'market-1',
  live: false
}

const selection = ({ id, odds_american = -110 }) => ({
  source_id: 'DRAFTKINGS',
  source_market_id: 'market-1',
  source_selection_id: id,
  selection_name: `selection ${id}`,
  selection_metric_line: 10.5,
  odds_decimal: 1.91,
  odds_american
})

describe('LIBS-SERVER insert_prop_market_selections', function () {
  // process_market_selection is synchronous, so the Promise.allSettled that used
  // to wrap the loop isolated nothing -- Array.map runs it inline and a throw
  // from validate_selection escaped before allSettled could observe it. That
  // rejected this function, which rejected process_market, which the caller's
  // outer allSettled handled by dropping the WHOLE market. One malformed
  // selection therefore discarded every sibling selection plus the market's own
  // history and index rows.
  describe('per-selection failure isolation', function () {
    it('keeps the valid selections when one is malformed', async () => {
      const result = await insert_prop_market_selections({
        observed_at: OBSERVED_AT,
        selections: [
          selection({ id: 'a' }),
          selection({ id: 'b', odds_american: null }),
          selection({ id: 'c' })
        ],
        existing_market: null,
        market
      })

      expect(result.results.length).to.equal(2)
      expect(
        result.results.map((entry) => entry.source_selection_id)
      ).to.deep.equal(['a', 'c'])

      // One history row per valid selection; OPEN and CLOSE index rows each,
      // because the market is not live.
      expect(result.selection_history_inserts.length).to.equal(2)
      expect(result.selection_index_inserts.length).to.equal(4)
    })

    it('reports the malformed selection rather than swallowing it', async () => {
      const result = await insert_prop_market_selections({
        observed_at: OBSERVED_AT,
        selections: [
          selection({ id: 'a' }),
          selection({ id: 'b', odds_american: null })
        ],
        existing_market: null,
        market
      })

      expect(result.failures.length).to.equal(1)
      expect(result.failures[0].source_selection_id).to.equal('b')
      expect(result.failures[0].source_market_id).to.equal('market-1')
      expect(result.failures[0].error).to.match(/odds_american/)
    })

    it('does not reject when every selection is malformed', async () => {
      const result = await insert_prop_market_selections({
        observed_at: OBSERVED_AT,
        selections: [
          selection({ id: 'a', odds_american: null }),
          selection({ id: 'b', odds_american: null })
        ],
        existing_market: null,
        market
      })

      expect(result.failures.length).to.equal(2)
      expect(result.selection_history_inserts.length).to.equal(0)
      expect(result.selection_index_inserts.length).to.equal(0)
    })

    it('reports no failures for a wholly valid market', async () => {
      const result = await insert_prop_market_selections({
        observed_at: OBSERVED_AT,
        selections: [selection({ id: 'a' }), selection({ id: 'b' })],
        existing_market: null,
        market
      })

      expect(result.failures).to.deep.equal([])
      expect(result.results.length).to.equal(2)
    })
  })

  describe('empty and missing selections', function () {
    it('returns empty operations when selections is null', async () => {
      const result = await insert_prop_market_selections({
        observed_at: OBSERVED_AT,
        selections: null,
        existing_market: null,
        market
      })

      expect(result.selection_history_inserts).to.deep.equal([])
      expect(result.selection_index_inserts).to.deep.equal([])
      expect(result.cleanup_operations).to.deep.equal([])
      expect(result.failures).to.deep.equal([])
    })

    // An empty array is a valid observation -- every selection was removed --
    // but it must not queue a cleanup, which would reap the market's whole
    // existing selection set.
    it('queues no cleanup for an empty selection array', async () => {
      const result = await insert_prop_market_selections({
        observed_at: OBSERVED_AT,
        selections: [],
        existing_market: { ...market },
        market
      })

      expect(result.cleanup_operations).to.deep.equal([])
      expect(result.failures).to.deep.equal([])
    })
  })

  // A fixed-payout pick-em book posts a line with no per-side price, so the
  // odds columns are legitimately null and requiring them rejected every
  // PrizePicks selection for 11 months (signal 127750). Run as a PAIR against
  // the DraftKings control below: an input that cannot distinguish the old
  // rule from the new one would pass either way, so the two cases must differ.
  describe('fixed-payout books carry no odds', function () {
    const pick_em_selection = ({ id }) => ({
      source_id: 'PRIZEPICKS',
      source_market_id: 'market-1',
      source_selection_id: id,
      selection_name: id,
      selection_metric_line: 10.5,
      odds_decimal: null,
      odds_american: null
    })

    it('accepts a PRIZEPICKS selection with null odds', async () => {
      const result = await insert_prop_market_selections({
        observed_at: OBSERVED_AT,
        selections: [
          pick_em_selection({ id: '1-over' }),
          pick_em_selection({ id: '1-under' })
        ],
        existing_market: null,
        market: { ...market, source_id: 'PRIZEPICKS' }
      })

      expect(result.failures).to.deep.equal([])
      expect(result.results.length).to.equal(2)
      // The rows actually reach the writes -- the defect was that they did not.
      expect(result.selection_history_inserts.length).to.equal(2)
      expect(result.selection_index_inserts.length).to.equal(4)
    })

    // The control. If this ever passes, the guard has been widened to every
    // book and a real missing price would go unreported.
    it('still rejects a DRAFTKINGS selection with null odds', async () => {
      const result = await insert_prop_market_selections({
        observed_at: OBSERVED_AT,
        selections: [selection({ id: 'a', odds_american: null })],
        existing_market: null,
        market
      })

      expect(result.results).to.deep.equal([])
      expect(result.failures.length).to.equal(1)
      expect(result.failures[0].error).to.match(/odds_american/)
    })
  })
})
