/* global describe, before, beforeEach, it */
import * as chai from 'chai'

import knex from '#db'
import { fetch_markets_for_games } from '#libs-server/prop-market-settlement/prop-market-utils.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

// One game holding TWO markets of the same type. That is the whole point of the
// fixture: a game-scoped fetch cannot tell the two apart, so an assertion that
// passes here can only be honoring source_market_ids. A single-market game
// would let a filter that does nothing score clean.
const ESBID = 2024102708
const TARGET_MARKET = 'target-market'
const BYSTANDER_MARKET = 'bystander-market'

const market_row = ({ source_market_id }) => ({
  source_id: 'DRAFTKINGS',
  source_market_id,
  time_type: 'CLOSE',
  market_type: 'GAME_RECEIVING_YARDS',
  source_market_name: `Receiving Props - ${source_market_id}`,
  esbid: ESBID,
  season_year: 2024,
  is_open: true,
  is_live: false,
  selection_count: 2,
  is_market_settled: false,
  observed_at: new Date('2024-10-27T16:00:00Z')
})

const selection_row = ({ source_market_id, selection_type }) => ({
  source_id: 'DRAFTKINGS',
  source_market_id,
  source_selection_id: `${source_market_id}-${selection_type}`,
  time_type: 'CLOSE',
  selection_pid: 'ANDR-MCCO-004333',
  selection_name: selection_type,
  selection_type,
  selection_metric_line: 55.5,
  odds_american: -110,
  observed_at: new Date('2024-10-27T16:00:00Z')
})

const seed = async () => {
  await knex('prop_markets_index').insert([
    market_row({ source_market_id: TARGET_MARKET }),
    market_row({ source_market_id: BYSTANDER_MARKET })
  ])
  await knex('prop_market_selections_index').insert([
    selection_row({ source_market_id: TARGET_MARKET, selection_type: 'OVER' }),
    selection_row({ source_market_id: TARGET_MARKET, selection_type: 'UNDER' }),
    selection_row({
      source_market_id: BYSTANDER_MARKET,
      selection_type: 'OVER'
    }),
    selection_row({
      source_market_id: BYSTANDER_MARKET,
      selection_type: 'UNDER'
    })
  ])
}

const fetch_for = ({ source_market_ids = null } = {}) =>
  fetch_markets_for_games({
    esbids: [ESBID],
    year: 2024,
    missing_only: false,
    supported_market_types: ['GAME_RECEIVING_YARDS'],
    source_market_ids
  })

describe('prop market settlement selection fetch market scope', function () {
  this.timeout(60 * 1000)

  before(async function () {
    await knex('prop_market_selections_index').del()
    await knex('prop_markets_index').del()
  })

  beforeEach(async function () {
    await knex('prop_market_selections_index').del()
    await knex('prop_markets_index').del()
    await seed()
  })

  // The control. Both markets come back without the filter, which is what makes
  // the narrowed result below evidence rather than an artifact of the fixture.
  it('fetches every market in the game when no market ids are given', async function () {
    const rows = await fetch_for()

    expect(rows).to.have.length(4)
    expect(new Set(rows.map((row) => row.source_market_id))).to.deep.equal(
      new Set([TARGET_MARKET, BYSTANDER_MARKET])
    )
  })

  it('fetches only the named market when source_market_ids is given', async function () {
    const rows = await fetch_for({ source_market_ids: [TARGET_MARKET] })

    expect(rows).to.have.length(2)
    for (const row of rows) {
      expect(row.source_market_id).to.equal(TARGET_MARKET)
    }
  })

  // An empty list is the shape a caller produces by splitting an empty string,
  // and it must mean "no restriction" rather than "match nothing" -- the latter
  // would turn a mis-parsed flag into a silent zero-market run that reports a
  // clean pass.
  it('treats an empty list as no restriction rather than as matching nothing', async function () {
    const rows = await fetch_for({ source_market_ids: [] })

    expect(rows).to.have.length(4)
  })

  it('returns nothing when the named market is not in the game', async function () {
    const rows = await fetch_for({ source_market_ids: ['absent-market'] })

    expect(rows).to.have.length(0)
  })
})
