/* global describe it */

import * as chai from 'chai'

import {
  has_liquidity_data,
  build_liquidity_inserts
} from '#scripts/import-keeptradecut.mjs'

chai.should()
const expect = chai.expect

// keeptradecut_liquidity.observed_at is timestamptz, so the importer passes a
// Date rather than the integer epoch the column used to hold.
const OBSERVED_AT = new Date(1_769_644_800 * 1000)

const make_values = ({
  rawLiquidity = 0,
  stdLiquidity = 0,
  tradeCount = 0
} = {}) => ({ rawLiquidity, stdLiquidity, tradeCount })

describe('SCRIPTS import-keeptradecut liquidity', function () {
  describe('has_liquidity_data', function () {
    it('detects a payload carrying liquidity', () => {
      const players_array = [
        { oneQBValues: make_values(), superflexValues: make_values() },
        {
          oneQBValues: make_values({ stdLiquidity: 31, tradeCount: 38 }),
          superflexValues: make_values({ stdLiquidity: 29, tradeCount: 41 })
        }
      ]
      expect(has_liquidity_data(players_array)).to.equal(true)
    })

    it('detects a wholly zeroed payload', () => {
      const players_array = [
        { oneQBValues: make_values(), superflexValues: make_values() },
        { oneQBValues: make_values(), superflexValues: make_values() }
      ]
      expect(has_liquidity_data(players_array)).to.equal(false)
    })

    it('detects a payload missing the liquidity fields entirely', () => {
      const players_array = [{ oneQBValues: {}, superflexValues: {} }, {}]
      expect(has_liquidity_data(players_array)).to.equal(false)
    })

    it('handles an empty or absent players array', () => {
      expect(has_liquidity_data([])).to.equal(false)
      expect(has_liquidity_data(undefined)).to.equal(false)
    })
  })

  describe('build_liquidity_inserts', function () {
    it('builds a row per format', () => {
      const rows = build_liquidity_inserts({
        pid: 'JAMA-CHAS-000001',
        keeptradecut_player: {
          oneQBValues: make_values({ stdLiquidity: 31, tradeCount: 38 }),
          superflexValues: make_values({
            rawLiquidity: 4.5,
            stdLiquidity: 29,
            tradeCount: 41
          })
        },
        observed_at: OBSERVED_AT
      })

      expect(rows).to.deep.equal([
        {
          pid: 'JAMA-CHAS-000001',
          is_superflex: false,
          observed_at: OBSERVED_AT,
          raw_liquidity: 0,
          std_liquidity: 31,
          trade_count: 38
        },
        {
          pid: 'JAMA-CHAS-000001',
          is_superflex: true,
          observed_at: OBSERVED_AT,
          raw_liquidity: 4.5,
          std_liquidity: 29,
          trade_count: 41
        }
      ])
    })

    it('keeps a genuine zero reported by keeptradecut', () => {
      const rows = build_liquidity_inserts({
        pid: 'JAMA-CHAS-000001',
        keeptradecut_player: {
          oneQBValues: make_values(),
          superflexValues: make_values()
        },
        observed_at: OBSERVED_AT
      })

      rows.should.have.length(2)
      rows.every((row) => row.trade_count === 0).should.equal(true)
    })

    it('skips a format whose liquidity fields are absent', () => {
      const rows = build_liquidity_inserts({
        pid: 'JAMA-CHAS-000001',
        keeptradecut_player: {
          oneQBValues: { value: 9999 },
          superflexValues: make_values({ tradeCount: 41 })
        },
        observed_at: OBSERVED_AT
      })

      rows.should.have.length(1)
      rows[0].is_superflex.should.equal(true)
    })

    it('skips a format absent from the payload', () => {
      const rows = build_liquidity_inserts({
        pid: 'JAMA-CHAS-000001',
        keeptradecut_player: {
          oneQBValues: make_values({ tradeCount: 38 })
        },
        observed_at: OBSERVED_AT
      })

      rows.should.have.length(1)
      rows[0].is_superflex.should.equal(false)
    })
  })
})
