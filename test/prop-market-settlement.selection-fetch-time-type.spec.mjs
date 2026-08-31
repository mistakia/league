/* global describe, before, beforeEach, it */
import * as chai from 'chai'

import knex from '#db'
import { fetch_markets_for_games } from '#libs-server/prop-market-settlement/prop-market-utils.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

// Two real 2023 games. The shape under test is production market
// FANDUEL 734.77171513 (Amon-Ra St. Brown receiving yards), whose OPEN row
// resolved to a game at line 88.5 and whose CLOSE row never resolved at all and
// carries line 162.5. Two settled selection rows beneath it still hold the OPEN
// grade written against the OPEN line, which is only reachable if a selection
// row can be paired with a market row of a different time_type.
const OPEN_ESBID = 2023111208
const CLOSE_ESBID = 2023111900

const OPEN_LINE = 88.5
const CLOSE_LINE = 162.5

const market_row = ({
  time_type,
  esbid,
  season_year = 2023,
  source_market_id = '734.77171513'
}) => ({
  source_id: 'FANDUEL',
  source_market_id,
  time_type,
  market_type: 'GAME_RECEIVING_YARDS',
  source_market_name: 'Amon-Ra St. Brown - Receiving Yds',
  source_event_id: '32763016',
  esbid,
  season_year,
  is_open: true,
  is_live: time_type === 'CLOSE',
  selection_count: 2,
  is_market_settled: false,
  observed_at: new Date('2023-11-09T19:45:42Z')
})

const selection_row = ({
  time_type,
  selection_type,
  selection_metric_line,
  source_market_id = '734.77171513'
}) => ({
  source_id: 'FANDUEL',
  source_market_id,
  source_selection_id: selection_type === 'OVER' ? '40891132' : '40891131',
  time_type,
  selection_pid: 'AMON-STBR-007533',
  selection_name: `Amon-Ra St. Brown ${selection_type}`,
  selection_type,
  selection_metric_line,
  odds_american: -114,
  observed_at: new Date('2023-11-09T22:04:46Z')
})

const seed = async (market_rows, selection_rows) => {
  await knex('prop_markets_index').insert(market_rows)
  await knex('prop_market_selections_index').insert(selection_rows)
}

const fetch_for = ({ esbids, year = 2023, missing_only = false }) =>
  fetch_markets_for_games({
    esbids,
    year,
    missing_only,
    supported_market_types: ['GAME_RECEIVING_YARDS']
  })

describe('prop market settlement selection fetch', function () {
  this.timeout(60 * 1000)

  before(async function () {
    await knex('prop_market_selections_index').del()
    await knex('prop_markets_index').del()
  })

  beforeEach(async function () {
    await knex('prop_market_selections_index').del()
    await knex('prop_markets_index').del()
  })

  describe('a selection row is paired only with its own time_type market row', function () {
    // The two market rows name DIFFERENT games and the two selection rows carry
    // DIFFERENT lines, so a pairing that ignores time_type cannot produce the
    // same answer as one that honors it. Without both differences the case
    // could not tell the two rules apart.
    const both_snapshots = async () =>
      seed(
        [
          market_row({ time_type: 'OPEN', esbid: OPEN_ESBID }),
          market_row({ time_type: 'CLOSE', esbid: CLOSE_ESBID })
        ],
        [
          selection_row({
            time_type: 'OPEN',
            selection_type: 'OVER',
            selection_metric_line: OPEN_LINE
          }),
          selection_row({
            time_type: 'OPEN',
            selection_type: 'UNDER',
            selection_metric_line: OPEN_LINE
          }),
          selection_row({
            time_type: 'CLOSE',
            selection_type: 'OVER',
            selection_metric_line: CLOSE_LINE
          }),
          selection_row({
            time_type: 'CLOSE',
            selection_type: 'UNDER',
            selection_metric_line: CLOSE_LINE
          })
        ]
      )

    it('fetches the OPEN rows only, on the OPEN line, for the OPEN game', async function () {
      await both_snapshots()

      const rows = await fetch_for({ esbids: [OPEN_ESBID] })

      expect(rows).to.have.length(2)
      for (const row of rows) {
        expect(row.time_type).to.equal('OPEN')
        expect(Number(row.esbid)).to.equal(OPEN_ESBID)
        expect(Number(row.selection_metric_line)).to.equal(OPEN_LINE)
      }
    })

    it('fetches the CLOSE rows only, on the CLOSE line, for the CLOSE game', async function () {
      // The control for the case above: the same corpus asked for the other
      // game must answer with the other snapshot, or "returns the OPEN rows"
      // would be satisfied by a fetch that always returns the OPEN rows.
      await both_snapshots()

      const rows = await fetch_for({ esbids: [CLOSE_ESBID] })

      expect(rows).to.have.length(2)
      for (const row of rows) {
        expect(row.time_type).to.equal('CLOSE')
        expect(Number(row.esbid)).to.equal(CLOSE_ESBID)
        expect(Number(row.selection_metric_line)).to.equal(CLOSE_LINE)
      }
    })
  })

  describe('a selection whose own market row resolved no game is not gradeable', function () {
    it('leaves the CLOSE selections out when the CLOSE market has no esbid', async function () {
      // The production shape exactly: the CLOSE market row never resolved to a
      // game. Its selections must not be graded against the OPEN row's game and
      // the OPEN row's line, which is how the two standing FANDUEL rows acquired
      // an OVER WON at 156 against a line of 162.5.
      await seed(
        [
          market_row({ time_type: 'OPEN', esbid: OPEN_ESBID }),
          market_row({
            time_type: 'CLOSE',
            esbid: null,
            season_year: null
          })
        ],
        [
          selection_row({
            time_type: 'OPEN',
            selection_type: 'OVER',
            selection_metric_line: OPEN_LINE
          }),
          selection_row({
            time_type: 'CLOSE',
            selection_type: 'OVER',
            selection_metric_line: CLOSE_LINE
          })
        ]
      )

      const rows = await fetch_for({ esbids: [OPEN_ESBID] })

      expect(rows).to.have.length(1)
      expect(rows[0].time_type).to.equal('OPEN')
      expect(Number(rows[0].selection_metric_line)).to.equal(OPEN_LINE)
    })
  })
})
