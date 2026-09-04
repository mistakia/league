/* global describe before beforeEach it */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'

import server from '#api'
import knex from '#db'

process.env.NODE_ENV = 'test'

chai.should()
chai.use(chai_http)
const expect = chai.expect

// GET /players/:pid/markets joins prop_markets_index to
// prop_market_selections_index. Both tables are keyed on
// (source_id, source_market_id, time_type) and carry an OPEN and a CLOSE row per
// market, so a join that matches on the first two columns alone crosses every
// selection against both market rows -- exactly 2.00x corpus-wide, 7,638,485
// rows served where 3,824,019 are needed:
//
//   WITH per_player AS (
//     SELECT s.selection_pid, count(*) AS cur_rows,
//            count(*) FILTER (WHERE m.time_type = s.time_type) AS fixed_rows
//     FROM prop_markets_index m
//     JOIN prop_market_selections_index s
//       ON m.source_id = s.source_id AND m.source_market_id = s.source_market_id
//     WHERE s.selection_pid IS NOT NULL GROUP BY 1)
//   SELECT sum(cur_rows), sum(fixed_rows) FROM per_player;
//
// The duplication was invisible from the tab because the component re-keys rows
// on (source_id, selection timestamp, year, week, selection_type) and collapses
// them again. What was NOT invisible is the second half of the same defect: the
// market object is built from whichever row the ordering saw first, and the two
// market rows genuinely disagree -- is_market_settled differs across the pair for
// 55,541 market keys, and the OPEN row is the stale one in 99.4% of them:
//
//   SELECT time_type, count(*) FILTER (WHERE is_market_settled) FROM prop_markets_index m
//   WHERE EXISTS (SELECT 1 FROM prop_markets_index m2
//     WHERE m2.source_id = m.source_id AND m2.source_market_id = m.source_market_id
//       AND m2.is_market_settled IS DISTINCT FROM m.is_market_settled)
//   GROUP BY 1;
//
// The fixture below reproduces that case rather than the easy one: the OPEN row
// is observed LATER than the CLOSE row, so ordering by observed_at alone picks
// the unsettled OPEN row for a market that has settled. 394,509 of the 1,536,119
// two-row market keys have an OPEN row winning that ordering today.
describe('API /players/:pid/markets - time_type dedup', function () {
  const pid = 'TEST-PLAY-000001'
  const source_id = 'DRAFTKINGS'
  const source_market_id = 'mk_dedup_fixture'
  const esbid = 2025090700

  const market_row = ({ time_type, observed_at, is_market_settled }) => ({
    market_type: 'GAME_PASSING_YARDS',
    source_id,
    source_market_id,
    source_market_name: 'Pass Yards O/U',
    esbid,
    source_event_id: 'ev_dedup_fixture',
    source_event_name: 'Test Event',
    is_open: !is_market_settled,
    is_live: false,
    selection_count: 2,
    time_type,
    observed_at,
    season_year: 2025,
    is_market_settled
  })

  const selection_row = ({ time_type, selection_type, observed_at }) => ({
    source_id,
    source_market_id,
    source_selection_id: `sel_${time_type}_${selection_type}`,
    selection_pid: pid,
    selection_name: selection_type,
    selection_metric_line: 267.5,
    odds_decimal: 1.909,
    odds_american: -110,
    observed_at,
    time_type,
    selection_type
  })

  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  beforeEach(async function () {
    this.timeout(60 * 1000)
    await knex('prop_market_selections_index')
      .where({ source_id, source_market_id })
      .del()
    await knex('prop_markets_index')
      .where({ source_id, source_market_id })
      .del()
    await knex('nfl_games').where({ esbid }).del()

    // The route leftJoins nfl_games for week and kickoff, and the response
    // schema requires week to be an integer -- so a market pointing at no game
    // fails validation before any dedup assertion is reached. Every real prop
    // market has one.
    await knex('nfl_games').insert({
      esbid,
      week: 1,
      season_year: 2025,
      season_type: 'REG',
      home_nfl_team: 'BUF',
      away_nfl_team: 'KC',
      date: '2025-09-07',
      time_eastern: '13:00:00'
    })

    const close_observed_at = '2025-09-07T17:00:00Z'
    const open_observed_at = '2025-09-07T18:00:00Z'

    await knex('prop_markets_index').insert([
      market_row({
        time_type: 'CLOSE',
        observed_at: close_observed_at,
        is_market_settled: true
      }),
      market_row({
        time_type: 'OPEN',
        observed_at: open_observed_at,
        is_market_settled: false
      })
    ])

    await knex('prop_market_selections_index').insert([
      selection_row({
        time_type: 'CLOSE',
        selection_type: 'OVER',
        observed_at: close_observed_at
      }),
      selection_row({
        time_type: 'CLOSE',
        selection_type: 'UNDER',
        observed_at: close_observed_at
      }),
      selection_row({
        time_type: 'OPEN',
        selection_type: 'OVER',
        observed_at: open_observed_at
      }),
      selection_row({
        time_type: 'OPEN',
        selection_type: 'UNDER',
        observed_at: open_observed_at
      })
    ])
  })

  const fetch_market = async () => {
    const res = await chai_request
      .execute(server)
      .get(`/api/players/${pid}/markets`)
    // The route catches every throw into a 500 with the message in the body, so
    // asserting on the status alone reports "not 200" and hides which query broke.
    expect(res.status, JSON.stringify(res.body)).to.equal(200)
    const markets = res.body.filter(
      (market) => market.source_market_id === source_market_id
    )
    markets.length.should.equal(1)
    return markets[0]
  }

  it('returns each selection once, not once per market row', async () => {
    const market = await fetch_market()

    // Four selection rows exist. Without time_type on the join each is matched
    // against both market rows and the route returns eight.
    market.selections.length.should.equal(4)

    const selection_ids = market.selections.map((s) => s.source_selection_id)
    new Set(selection_ids).size.should.equal(selection_ids.length)
  })

  it('takes market-level fields from the CLOSE observation, not the latest one', async () => {
    const market = await fetch_market()

    // The OPEN row is the later observation and says the market is still open.
    // The CLOSE row is the settled one and is authoritative.
    market.is_market_settled.should.equal(true)
    market.is_open.should.equal(false)
    new Date(market.timestamp)
      .toISOString()
      .should.equal('2025-09-07T17:00:00.000Z')
  })

  it('does not publish a market-level time_type', async () => {
    const market = await fetch_market()

    // A market is returned once with its OPEN and CLOSE selections together, so
    // time_type is a property of a selection and not of the market. Publishing
    // one at market level can only report a value that half the selections
    // contradict.
    expect(market.time_type).to.equal(undefined)
    market.selections
      .map((s) => s.time_type)
      .sort()
      .should.deep.equal(['CLOSE', 'CLOSE', 'OPEN', 'OPEN'])
  })
})
