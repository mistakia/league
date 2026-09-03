/* global describe, before, beforeEach, it */
import * as chai from 'chai'

import knex from '#db'
import insert_prop_markets from '#libs-server/insert-prop-markets.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

// Two real 2024 games. Every case below clears prop_markets_history, so the
// importer sees no cached prior observation and takes the NEW-market path --
// which is the only path that still upserts a whole OPEN row, and therefore the
// only one that can exercise the merge expression these cases are about. An
// existing market no longer rewrites its OPEN row at all; identity columns reach
// it by targeted update instead (libs-server/propagate-prop-market-identity.mjs,
// and the spec beside it).
const WEEK_12_ESBID = 2024112404
const WEEK_13_ESBID = 2024112802

const OPENED_AT = new Date('2024-11-20T17:00:00Z')
const RE_OBSERVED_AT = new Date('2024-11-28T17:00:00Z')

const market_row = ({ time_type, esbid }) => ({
  source_id: 'PRIZEPICKS',
  source_market_id: 'observed-at-market',
  time_type,
  market_type: 'GAME_RUSHING_YARDS',
  source_market_name: 'Rush Yards',
  source_event_id: 'NFL_game_PNZgCAAobQ2f5V9Mf6nwNSww',
  esbid,
  season_year: 2024,
  is_open: true,
  is_live: false,
  selection_count: 2,
  is_market_settled: false,
  observed_at: OPENED_AT
})

const import_market = ({ esbid }) => ({
  source_id: 'PRIZEPICKS',
  source_market_id: 'observed-at-market',
  market_type: 'GAME_RUSHING_YARDS',
  source_market_name: 'Rush Yards',
  source_event_id: 'NFL_game_PNZgCAAobQ2f5V9Mf6nwNSww',
  source_event_name: null,
  esbid,
  season_year: 2024,
  is_open: true,
  is_live: false,
  selection_count: 2,
  observed_at: RE_OBSERVED_AT,
  selections: []
})

const get_row = async (time_type) =>
  knex('prop_markets_index')
    .where({
      source_id: 'PRIZEPICKS',
      source_market_id: 'observed-at-market',
      time_type
    })
    .first()

describe('prop market OPEN observed_at', function () {
  this.timeout(60 * 1000)

  before(async function () {
    await knex('prop_markets_index').del()
    await knex('prop_markets_history').del()
  })

  beforeEach(async function () {
    await knex('prop_markets_index').del()
    await knex('prop_markets_history').del()

    await knex('prop_markets_index').insert([
      market_row({ time_type: 'OPEN', esbid: WEEK_12_ESBID }),
      market_row({ time_type: 'CLOSE', esbid: WEEK_12_ESBID })
    ])
  })

  // Red against the pre-fix code, which carried observed_at in
  // MARKET_INDEX_MERGE_COLUMNS and so mapped it to excluded.observed_at on both
  // rows -- moving the OPEN row's timestamp to the re-observation.
  it('holds the OPEN row at its first observation across a re-observation', async function () {
    await insert_prop_markets([import_market({ esbid: WEEK_13_ESBID })])

    const row = await get_row('OPEN')

    expect(row.observed_at.getTime()).to.equal(OPENED_AT.getTime())
  })

  // The paired control, and the reason the assertion above is not vacuous. A
  // merge that froze observed_at on EVERY row -- dropping the column from the
  // merge outright, say -- would pass the OPEN assertion while silently
  // stalling the CLOSE row, which is the one column that has to track the
  // latest observation. The two must disagree.
  it('still advances the CLOSE row to the re-observation', async function () {
    await insert_prop_markets([import_market({ esbid: WEEK_13_ESBID })])

    const row = await get_row('CLOSE')

    expect(row.observed_at.getTime()).to.equal(RE_OBSERVED_AT.getTime())
  })

  // The OPEN row is only meaningful if the first write lands. Nothing above
  // exercises the insert arm, so a merge expression that read the existing row
  // when there was none would be invisible to both tests.
  it('stamps a first-seen market with the observation that created it', async function () {
    await knex('prop_markets_index').del()

    await insert_prop_markets([import_market({ esbid: WEEK_12_ESBID })])

    const row = await get_row('OPEN')

    expect(row.observed_at.getTime()).to.equal(RE_OBSERVED_AT.getTime())
  })
})
