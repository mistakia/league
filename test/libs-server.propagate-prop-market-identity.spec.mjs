/* global describe, before, beforeEach, it */
import * as chai from 'chai'

import knex from '#db'
import insert_prop_markets from '#libs-server/insert-prop-markets.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

// Identity fields reached the CLOSE row and never the OPEN row, because the
// existing-market and existing-selection paths write CLOSE unconditionally and
// the OPEN row is written once at creation. Settlement reads BOTH time_types and
// grades each independently, so an OPEN row with a null market_type or
// selection_pid cannot be settled at all -- which is why a book whose importer is
// repaired after its markets first appear stays unsettleable however correct the
// importer becomes.
//
// Everything below runs through the real importer entry point rather than
// calling the propagation helpers directly, because the defect was never in the
// SQL: it was in which rows the write path chose to touch.

const SOURCE_ID = 'DRAFTKINGS'
const MARKET_ID = 'identity-propagation-market'
const ESBID = 2024112404

// Dates are relative to now rather than fixed, and both halves of that are
// load-bearing. betting-market-cache.mjs only prefetches history rows from the
// last 7 days, so a fixed past date leaves the cache empty and the importer
// takes the new-market path, skipping everything under test. And the CLOSE row
// is only rewritten when the incoming observation is NEWER than the cached one,
// so the ordering below is what makes the CLOSE control cases reachable.
const DAY = 24 * 60 * 60 * 1000
const OPENED_AT = new Date(Date.now() - 3 * DAY)
const PREVIOUS_OBSERVED_AT = new Date(Date.now() - 2 * DAY)
const RE_OBSERVED_AT = new Date(Date.now() - 1 * DAY)

// The OPEN row as first written: no market_type, and a source_event_name that
// the later observation revises. source_event_name is the control column --
// nothing watches it and it is not identity, so a whole-row OPEN rewrite is the
// only thing that could move it.
const seed_market_row = ({ time_type, market_type = null }) => ({
  source_id: SOURCE_ID,
  source_market_id: MARKET_ID,
  time_type,
  market_type,
  source_market_name: 'Rush Yards',
  source_event_id: 'event-1',
  source_event_name: 'opening event name',
  esbid: null,
  season_year: null,
  is_open: true,
  is_live: false,
  selection_count: 2,
  is_market_settled: false,
  observed_at: OPENED_AT
})

const seed_selection_row = ({
  time_type,
  odds_american,
  selection_metric_line,
  selection_pid = null,
  selection_type = null
}) => ({
  source_id: SOURCE_ID,
  source_market_id: MARKET_ID,
  source_selection_id: 'selection-over',
  selection_pid,
  selection_name: 'Over',
  selection_metric_line,
  odds_decimal: 1.91,
  odds_american,
  selection_type,
  time_type,
  observed_at: OPENED_AT
})

// What the repaired importer now sends: identity resolved, prices moved, and
// the control column changed.
const import_market = ({
  market_type = 'GAME_RUSHING_YARDS',
  selection_pid = 'PATR-MAHO-000123',
  selection_type = 'OVER'
} = {}) => ({
  source_id: SOURCE_ID,
  source_market_id: MARKET_ID,
  market_type,
  source_market_name: 'Rush Yards',
  source_event_id: 'event-1',
  source_event_name: 'revised event name',
  esbid: ESBID,
  season_year: 2024,
  is_open: true,
  is_live: false,
  selection_count: 2,
  observed_at: RE_OBSERVED_AT,
  selections: [
    {
      source_id: SOURCE_ID,
      source_market_id: MARKET_ID,
      source_selection_id: 'selection-over',
      selection_pid,
      selection_name: 'Over',
      selection_metric_line: 12.5,
      odds_decimal: 1.5,
      odds_american: -200,
      selection_type
    }
  ]
})

const get_market_row = async (time_type) =>
  knex('prop_markets_index')
    .where({ source_id: SOURCE_ID, source_market_id: MARKET_ID, time_type })
    .first()

const get_selection_row = async (time_type) =>
  knex('prop_market_selections_index')
    .where({
      source_id: SOURCE_ID,
      source_market_id: MARKET_ID,
      source_selection_id: 'selection-over',
      time_type
    })
    .first()

const clear = async () => {
  await knex('prop_markets_index').del()
  await knex('prop_markets_history').del()
  await knex('prop_market_selections_index').del()
  await knex('prop_market_selections_history').del()
}

describe('prop market identity propagation to OPEN', function () {
  this.timeout(60 * 1000)

  before(clear)

  beforeEach(async function () {
    await clear()

    await knex('prop_markets_index').insert([
      seed_market_row({ time_type: 'OPEN' }),
      seed_market_row({ time_type: 'CLOSE' })
    ])

    await knex('prop_market_selections_index').insert([
      seed_selection_row({
        time_type: 'OPEN',
        odds_american: -110,
        selection_metric_line: 10.5
      }),
      seed_selection_row({
        time_type: 'CLOSE',
        odds_american: -150,
        selection_metric_line: 11.5
      })
    ])

    // The history rows are what make this an EXISTING market and an EXISTING
    // selection. betting-market-cache.mjs baselines change detection on the
    // history tables, so without a row here the importer takes the new-market
    // path and the propagation code is never reached -- which would make every
    // assertion below vacuous.
    const recent = PREVIOUS_OBSERVED_AT

    await knex('prop_markets_history').insert({
      source_id: SOURCE_ID,
      source_market_id: MARKET_ID,
      source_market_name: 'Rush Yards',
      is_open: true,
      is_live: false,
      selection_count: 2,
      observed_at: recent
    })

    await knex('prop_market_selections_history').insert({
      source_id: SOURCE_ID,
      source_market_id: MARKET_ID,
      source_selection_id: 'selection-over',
      selection_name: 'Over',
      selection_metric_line: 10.5,
      odds_decimal: 1.91,
      odds_american: -110,
      observed_at: recent
    })
  })

  describe('selections', function () {
    // The case that blocks a repaired book. Red against the pre-change code,
    // which wrote only CLOSE on the existing-selection path.
    it('fills a null selection_pid and selection_type on the OPEN row', async function () {
      await insert_prop_markets([import_market()])

      const row = await get_selection_row('OPEN')

      expect(row.selection_pid).to.equal('PATR-MAHO-000123')
      expect(row.selection_type).to.equal('OVER')
    })

    // The regression that matters, and the reason the propagation is a targeted
    // UPDATE rather than an upsert. A whole-row merge onto OPEN would satisfy
    // the assertion above while destroying the opening price -- and the row
    // count does not change when it does, so nothing that counts rows can see
    // it. On production 2026-09-02, 3,453,203 of 5,242,560 OPEN/CLOSE selection
    // pairs carried a different observed_at and 2,180,489 a different price;
    // those are exactly the rows such a merge would overwrite.
    it('leaves the OPEN row price columns and observed_at untouched', async function () {
      await insert_prop_markets([import_market()])

      const row = await get_selection_row('OPEN')

      expect(Number(row.odds_american)).to.equal(-110)
      expect(Number(row.selection_metric_line)).to.equal(10.5)
      expect(Number(row.odds_decimal)).to.equal(1.91)
      expect(row.observed_at.getTime()).to.equal(OPENED_AT.getTime())
    })

    // The paired control. Freezing the OPEN row is only correct if the CLOSE row
    // still tracks the latest observation -- a change that froze both would pass
    // every assertion above and silently stall the column settlement actually
    // grades against.
    it('still advances the CLOSE row prices to the new observation', async function () {
      await insert_prop_markets([import_market()])

      const row = await get_selection_row('CLOSE')

      expect(Number(row.odds_american)).to.equal(-200)
      expect(Number(row.selection_metric_line)).to.equal(12.5)
      expect(row.observed_at.getTime()).to.equal(RE_OBSERVED_AT.getTime())
    })

    // Filling a null is a repair; overwriting a value is a revision, and the
    // propagation must never do the second. Without this case a coalesce written
    // the wrong way round -- or dropped entirely -- reads as a passing fix.
    it('does not revise a selection_pid the OPEN row already carries', async function () {
      await knex('prop_market_selections_index')
        .where({
          source_id: SOURCE_ID,
          source_market_id: MARKET_ID,
          time_type: 'OPEN'
        })
        .update({ selection_pid: 'ORIG-INAL-000001' })

      await insert_prop_markets([import_market()])

      const row = await get_selection_row('OPEN')

      expect(row.selection_pid).to.equal('ORIG-INAL-000001')
    })

    // A book that resolves nothing must not blank what is already stored.
    it('leaves the OPEN row alone when the incoming identity is null', async function () {
      await knex('prop_market_selections_index')
        .where({
          source_id: SOURCE_ID,
          source_market_id: MARKET_ID,
          time_type: 'OPEN'
        })
        .update({ selection_pid: 'ORIG-INAL-000001', selection_type: 'OVER' })

      await insert_prop_markets([
        import_market({ selection_pid: null, selection_type: null })
      ])

      const row = await get_selection_row('OPEN')

      expect(row.selection_pid).to.equal('ORIG-INAL-000001')
      expect(row.selection_type).to.equal('OVER')
    })
  })

  describe('markets', function () {
    it('fills a null market_type, esbid and season_year on the OPEN row', async function () {
      await insert_prop_markets([import_market()])

      const row = await get_market_row('OPEN')

      expect(row.market_type).to.equal('GAME_RUSHING_YARDS')
      expect(Number(row.esbid)).to.equal(ESBID)
      expect(Number(row.season_year)).to.equal(2024)
    })

    it('leaves the OPEN row observed_at untouched', async function () {
      await insert_prop_markets([import_market()])

      const row = await get_market_row('OPEN')

      expect(row.observed_at.getTime()).to.equal(OPENED_AT.getTime())
    })

    // The gate that never discriminated, expressed as behavior.
    //
    // The index gate compared a 7-column prop_markets_history row against a
    // 14-column index-shaped object, and deep-diff reports a key absent from the
    // left side as a difference -- so esbid and season_year, the two fields the
    // gate watched and neither of which exists in prop_markets_history, made it
    // unconditionally true for every existing market on every run for all ten
    // importers. Its effect was to re-upsert the whole OPEN row, which is why
    // source_event_name below moved on the pre-change code and is frozen now.
    //
    // Not a cosmetic change: the same rewrite carried is_open, is_live and
    // selection_count onto a row whose whole job is to record the market's
    // OPENING state.
    it('does not rewrite an unwatched, non-identity column on the OPEN row', async function () {
      await insert_prop_markets([import_market()])

      const row = await get_market_row('OPEN')

      expect(row.source_event_name).to.equal('opening event name')
    })

    // The paired control for the case above.
    it('still carries the revised column onto the CLOSE row', async function () {
      await insert_prop_markets([import_market()])

      const row = await get_market_row('CLOSE')

      expect(row.source_event_name).to.equal('revised event name')
      expect(row.market_type).to.equal('GAME_RUSHING_YARDS')
    })

    it('does not revise a market_type the OPEN row already carries', async function () {
      await knex('prop_markets_index')
        .where({
          source_id: SOURCE_ID,
          source_market_id: MARKET_ID,
          time_type: 'OPEN'
        })
        .update({ market_type: 'GAME_RECEIVING_YARDS' })

      await insert_prop_markets([import_market()])

      const row = await get_market_row('OPEN')

      expect(row.market_type).to.equal('GAME_RECEIVING_YARDS')
    })
  })

  // A market seen for the first time gets its OPEN row from the insert, not from
  // the repair. Nothing above exercises that arm, so a propagation that only
  // worked on pre-existing rows would be invisible to every case here.
  describe('a market first seen this run', function () {
    it('writes OPEN with identity and the observation that created it', async function () {
      await clear()

      await insert_prop_markets([import_market()])

      const market_row = await get_market_row('OPEN')
      const selection_row = await get_selection_row('OPEN')

      expect(market_row.market_type).to.equal('GAME_RUSHING_YARDS')
      expect(market_row.observed_at.getTime()).to.equal(
        RE_OBSERVED_AT.getTime()
      )
      expect(selection_row.selection_pid).to.equal('PATR-MAHO-000123')
      expect(Number(selection_row.odds_american)).to.equal(-200)
    })
  })
})
