/* global describe, before, beforeEach, it */
import * as chai from 'chai'

import knex from '#db'
import { cleanup_stale_selections } from '#libs-server/insert-prop-markets.mjs'
import insert_prop_market_selections from '#libs-server/insert-prop-market-selections.mjs'
import {
  build_market_key,
  build_selection_index_key
} from '#libs-server/betting-market-keys.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

// 175177394 is a real production collision: DRAFTKINGS recorded this
// source_market_id in Nov 2023 and FANATICS recorded the same string in
// Nov 2024. 33 such collisions exist.
const SHARED_MARKET_ID = '175177394'

const selection_row = ({
  source_id,
  source_market_id = SHARED_MARKET_ID,
  source_selection_id,
  time_type = 'CLOSE'
}) => ({
  source_id,
  source_market_id,
  source_selection_id,
  time_type,
  // The committed schema declares this column as `timestamp integer NOT NULL`.
  // The betting-props conform to `observed_at` is committed but its DDL is not
  // applied, so the test schema is still pre-rename. The reaper reads neither
  // column, so this fixture is unaffected by that rename either way.
  timestamp: 1700000000
})

describe('libs-server prop market selection reaper', function () {
  this.timeout(60 * 1000)

  before(async function () {
    await knex('prop_market_selections_index').del()
  })

  beforeEach(async function () {
    await knex('prop_market_selections_index').del()
  })

  describe('cross-book scoping', function () {
    it('does not delete another book selections sharing a source_market_id', async function () {
      await knex('prop_market_selections_index').insert([
        // DRAFTKINGS owns these. It emits no cleanup in this run.
        selection_row({ source_id: 'DRAFTKINGS', source_selection_id: 'dk-1' }),
        selection_row({ source_id: 'DRAFTKINGS', source_selection_id: 'dk-2' }),
        // FANATICS owns these. Only fan-live is still in its snapshot.
        selection_row({
          source_id: 'FANATICS',
          source_selection_id: 'fan-live'
        }),
        selection_row({
          source_id: 'FANATICS',
          source_selection_id: 'fan-stale'
        })
      ])

      const result = await cleanup_stale_selections([
        {
          source_id: 'FANATICS',
          source_market_id: SHARED_MARKET_ID,
          new_selection_ids: ['fan-live']
        }
      ])

      const remaining = await knex('prop_market_selections_index')
        .select('source_id', 'source_selection_id')
        .orderBy('source_selection_id')

      // The whole point: DRAFTKINGS is untouched by a FANATICS cleanup.
      const draftkings_remaining = remaining
        .filter((row) => row.source_id === 'DRAFTKINGS')
        .map((row) => row.source_selection_id)
      expect(draftkings_remaining).to.deep.equal(['dk-1', 'dk-2'])

      // ...while genuinely stale same-book rows are still reaped.
      const fanatics_remaining = remaining
        .filter((row) => row.source_id === 'FANATICS')
        .map((row) => row.source_selection_id)
      expect(fanatics_remaining).to.deep.equal(['fan-live'])

      expect(result.deleted_count).to.equal(1)
      expect(result.violations).to.deep.equal([])
    })

    it('scopes each book independently when both emit cleanups', async function () {
      await knex('prop_market_selections_index').insert([
        selection_row({ source_id: 'DRAFTKINGS', source_selection_id: 'keep' }),
        selection_row({ source_id: 'DRAFTKINGS', source_selection_id: 'drop' }),
        selection_row({ source_id: 'FANATICS', source_selection_id: 'keep' }),
        selection_row({ source_id: 'FANATICS', source_selection_id: 'drop' })
      ])

      const result = await cleanup_stale_selections([
        {
          source_id: 'DRAFTKINGS',
          source_market_id: SHARED_MARKET_ID,
          new_selection_ids: ['keep']
        },
        {
          source_id: 'FANATICS',
          source_market_id: SHARED_MARKET_ID,
          new_selection_ids: ['keep']
        }
      ])

      const remaining = await knex('prop_market_selections_index').select(
        'source_id',
        'source_selection_id'
      )

      expect(remaining).to.have.length(2)
      expect(
        remaining.every((row) => row.source_selection_id === 'keep')
      ).to.equal(true)
      expect(result.deleted_count).to.equal(2)
      expect(result.violations).to.deep.equal([])
    })

    it('leaves OPEN rows alone', async function () {
      await knex('prop_market_selections_index').insert([
        selection_row({
          source_id: 'FANATICS',
          source_selection_id: 'stale',
          time_type: 'OPEN'
        }),
        selection_row({ source_id: 'FANATICS', source_selection_id: 'stale' })
      ])

      const result = await cleanup_stale_selections([
        {
          source_id: 'FANATICS',
          source_market_id: SHARED_MARKET_ID,
          new_selection_ids: ['other']
        }
      ])

      const remaining = await knex('prop_market_selections_index').select(
        'time_type'
      )
      expect(remaining).to.have.length(1)
      expect(remaining[0].time_type).to.equal('OPEN')
      expect(result.deleted_count).to.equal(1)
    })
  })

  describe('cleanup operation guards', function () {
    it('is a no-op for an empty operation list', async function () {
      const result = await cleanup_stale_selections([])
      expect(result).to.deep.equal({ deleted_count: 0, violations: [] })
    })

    it('skips operations missing new_selection_ids or source_id', async function () {
      await knex('prop_market_selections_index').insert([
        selection_row({ source_id: 'FANATICS', source_selection_id: 'fan-1' })
      ])

      const result = await cleanup_stale_selections([
        { source_id: 'FANATICS', source_market_id: SHARED_MARKET_ID },
        { source_market_id: SHARED_MARKET_ID, new_selection_ids: ['other'] }
      ])

      const remaining = await knex('prop_market_selections_index').select(
        'source_selection_id'
      )
      expect(remaining).to.have.length(1)
      expect(result.deleted_count).to.equal(0)
    })
  })

  describe('cleanup operation payload', function () {
    it('carries the emitting book source_id', async function () {
      const market = {
        source_id: 'FANATICS',
        source_market_id: SHARED_MARKET_ID,
        live: false
      }

      const { cleanup_operations } = await insert_prop_market_selections({
        observed_at: new Date(),
        selections: [
          {
            source_id: 'FANATICS',
            source_market_id: SHARED_MARKET_ID,
            source_selection_id: 'fan-1',
            selection_name: 'Over',
            selection_metric_line: 10.5,
            odds_decimal: 1.9,
            odds_american: -110
          }
        ],
        existing_market: market,
        market
      })

      expect(cleanup_operations).to.have.length(1)
      // Without source_id here the reaper cannot scope by book at all.
      expect(cleanup_operations[0].source_id).to.equal('FANATICS')
      expect(cleanup_operations[0].source_market_id).to.equal(SHARED_MARKET_ID)
    })
  })

  describe('key builders', function () {
    it('distinguishes tuples that an underscore join would collide', function () {
      const left = build_selection_index_key({
        source_id: 'DRAFTKINGS',
        source_market_id: 'A_B',
        source_selection_id: 'C',
        time_type: 'CLOSE'
      })
      const right = build_selection_index_key({
        source_id: 'DRAFTKINGS',
        source_market_id: 'A',
        source_selection_id: 'B_C',
        time_type: 'CLOSE'
      })

      expect(left).to.not.equal(right)
    })

    it('scopes market identity by source_id', function () {
      const draftkings = build_market_key({
        source_id: 'DRAFTKINGS',
        source_market_id: SHARED_MARKET_ID
      })
      const fanatics = build_market_key({
        source_id: 'FANATICS',
        source_market_id: SHARED_MARKET_ID
      })

      expect(draftkings).to.not.equal(fanatics)
    })
  })
})
