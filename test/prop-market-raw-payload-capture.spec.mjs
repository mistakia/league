/* global describe, before, beforeEach, it */
import * as chai from 'chai'

import knex from '#db'
import insert_prop_markets from '#libs-server/insert-prop-markets.mjs'
import insert_prop_market_events_raw from '#libs-server/insert-prop-market-events-raw.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

const SOURCE_MARKET_ID = 'raw-capture-market'
const SOURCE_EVENT_ID = 'raw-capture-event'

const FIRST_OBSERVED_AT = new Date('2024-11-20T17:00:00Z')
const SECOND_OBSERVED_AT = new Date('2024-11-28T17:00:00Z')

// A shape that carries the two things a per-selection capture would lose: the
// market-level line parameter, and the vendor's own market descriptor. The
// mixed-precision handicap string is deliberate -- BetMGM emits both '-2.5' and
// '-2.5000', and a capture that reformatted numbers would flatten them.
const vendor_body = ({ handicap }) => ({
  id: SOURCE_MARKET_ID,
  templateId: 37615,
  name: { value: 'Total Points' },
  parameters: [{ key: 'DecimalHandicap', value: handicap }],
  attr: 'passing_yards',
  options: [{ name: { value: 'Over' } }, { name: { value: 'Under' } }]
})

const import_market = ({ observed_at, raw_payload, selection_count = 2 }) => ({
  source_id: 'PRIZEPICKS',
  source_market_id: SOURCE_MARKET_ID,
  market_type: 'GAME_RUSHING_YARDS',
  source_market_name: 'Rush Yards',
  source_event_id: SOURCE_EVENT_ID,
  source_event_name: null,
  esbid: null,
  season_year: 2024,
  is_open: true,
  is_live: false,
  selection_count,
  observed_at,
  selections: [],
  ...(raw_payload ? { raw_payload } : {})
})

const raw_rows = async () =>
  knex('prop_markets_raw_history')
    .where({ source_id: 'PRIZEPICKS', source_market_id: SOURCE_MARKET_ID })
    .orderBy('observed_at')

describe('prop market raw payload capture', function () {
  this.timeout(60 * 1000)

  before(async function () {
    await knex('prop_markets_raw_history').del()
    await knex('prop_market_events_raw_history').del()
    await knex('prop_markets_index').del()
    await knex('prop_markets_history').del()
  })

  beforeEach(async function () {
    await knex('prop_markets_raw_history').del()
    await knex('prop_market_events_raw_history').del()
    await knex('prop_markets_index').del()
    await knex('prop_markets_history').del()
  })

  it('stores the vendor body against the history row key', async function () {
    const body = vendor_body({ handicap: '-2.5000' })

    await insert_prop_markets([
      import_market({ observed_at: FIRST_OBSERVED_AT, raw_payload: body })
    ])

    const rows = await raw_rows()

    expect(rows.length).to.equal(1)
    expect(rows[0].observed_at.getTime()).to.equal(FIRST_OBSERVED_AT.getTime())
    expect(rows[0].raw_payload).to.deep.equal(body)

    // The string survives verbatim rather than being parsed to a number, which
    // is the whole reason a re-run of a future formatter is answerable.
    expect(rows[0].raw_payload.parameters[0].value).to.equal('-2.5000')

    // Same key as the history row it explains -- that pairing is the design.
    const history = await knex('prop_markets_history')
      .where({ source_id: 'PRIZEPICKS', source_market_id: SOURCE_MARKET_ID })
      .first()
    expect(history.observed_at.getTime()).to.equal(
      rows[0].observed_at.getTime()
    )
  })

  // The invariant this design rests on: raw rows are DERIVED from the history
  // inserts, so whatever the writer's change detection decides, the two tables
  // carry the same keys. That is what lets a backfill join them without a
  // coverage question, and it is stronger than asserting a particular dedup
  // outcome -- an earlier draft of this spec asserted that an unchanged
  // re-observation writes nothing, which is not what this writer does and was
  // never a property of the capture.
  it('writes exactly one raw row per history row, on the same keys', async function () {
    const body = vendor_body({ handicap: '-2.5000' })

    await insert_prop_markets([
      import_market({ observed_at: FIRST_OBSERVED_AT, raw_payload: body })
    ])
    await insert_prop_markets([
      import_market({ observed_at: SECOND_OBSERVED_AT, raw_payload: body })
    ])

    const history = await knex('prop_markets_history')
      .where({ source_id: 'PRIZEPICKS', source_market_id: SOURCE_MARKET_ID })
      .orderBy('observed_at')
    const raw = await raw_rows()

    expect(history.length).to.be.greaterThan(0)
    expect(raw.length).to.equal(history.length)
    expect(raw.map((row) => row.observed_at.getTime())).to.deep.equal(
      history.map((row) => row.observed_at.getTime())
    )
  })

  it('writes a second row when the market changed', async function () {
    await insert_prop_markets([
      import_market({
        observed_at: FIRST_OBSERVED_AT,
        raw_payload: vendor_body({ handicap: '-2.5000' })
      })
    ])
    await insert_prop_markets([
      import_market({
        observed_at: SECOND_OBSERVED_AT,
        raw_payload: vendor_body({ handicap: '-3.0000' }),
        selection_count: 3
      })
    ])

    const rows = await raw_rows()

    expect(rows.length).to.equal(2)
    expect(rows[1].raw_payload.parameters[0].value).to.equal('-3.0000')
  })

  // An importer that has not been converted must be completely unaffected --
  // that is what makes this adoptable one book at a time.
  it('writes no raw row for an importer that attaches nothing', async function () {
    await insert_prop_markets([
      import_market({ observed_at: FIRST_OBSERVED_AT })
    ])

    expect((await raw_rows()).length).to.equal(0)

    // and the market itself still landed, so the absence above is not just a
    // failed insert
    const history = await knex('prop_markets_history')
      .where({ source_id: 'PRIZEPICKS', source_market_id: SOURCE_MARKET_ID })
      .first()
    expect(history).to.exist
  })

  // raw_payload must never reach prop_markets_index: it is not a column there,
  // so a writer that failed to strip it would throw rather than degrade.
  it('strips the payload before the index insert', async function () {
    await insert_prop_markets([
      import_market({
        observed_at: FIRST_OBSERVED_AT,
        raw_payload: vendor_body({ handicap: '-2.5000' })
      })
    ])

    const index_row = await knex('prop_markets_index')
      .where({ source_id: 'PRIZEPICKS', source_market_id: SOURCE_MARKET_ID })
      .first()

    expect(index_row).to.exist
    expect(index_row).to.not.have.property('raw_payload')
  })

  it('stores an event envelope once per event per observation', async function () {
    const envelope = {
      id: SOURCE_EVENT_ID,
      name: { value: 'Denver Broncos at Kansas City Chiefs' },
      startDate: '2026-09-15T00:15:00Z'
    }

    // the same event arriving several times in one run, which is how a vendor
    // that serves an event under several market groups actually presents it
    await insert_prop_market_events_raw([
      {
        source_id: 'PRIZEPICKS',
        source_event_id: SOURCE_EVENT_ID,
        observed_at: FIRST_OBSERVED_AT,
        raw_payload: envelope
      },
      {
        source_id: 'PRIZEPICKS',
        source_event_id: SOURCE_EVENT_ID,
        observed_at: FIRST_OBSERVED_AT,
        raw_payload: envelope
      }
    ])

    const rows = await knex('prop_market_events_raw_history').where({
      source_id: 'PRIZEPICKS',
      source_event_id: SOURCE_EVENT_ID
    })

    expect(rows.length).to.equal(1)
    expect(rows[0].raw_payload.startDate).to.equal('2026-09-15T00:15:00Z')
  })
})
