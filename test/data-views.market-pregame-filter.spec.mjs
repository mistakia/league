/* global describe, before, beforeEach, it */
import * as chai from 'chai'

import knex from '#db'
import { apply_pregame_market_filter } from '#libs-server/data-views/market-pregame-filter.mjs'
import { get_data_view_results_query } from '#libs-server'

process.env.NODE_ENV = 'test'
const expect = chai.expect

// One real 2023 game, three market shapes on one player, because the three are
// what the filter has to tell apart:
//
//   PREGAME  is_live = false  -- survives
//   LIVE     is_live = true   -- removed, that is the point
//   UNKNOWN  is_live = NULL   -- survives, and this is the one that catches the
//                                bug. Four of the six books never populate the
//                                column, so a NULL means "this importer does
//                                not report the distinction", not "live".
//                                `whereNot('is_live', true)` compiles to
//                                `NOT (is_live = true)`, which is NULL on a
//                                NULL row and gets discarded -- that spelling
//                                would blank 1,359,857 production rows.
const ESBID = 2023111208
const PID = 'AMON-STBR-007533'

const market_row = ({ source_market_id, is_live, observed_at }) => ({
  source_id: 'FANDUEL',
  source_market_id,
  time_type: 'CLOSE',
  market_type: 'GAME_RECEIVING_YARDS',
  source_market_name: 'Amon-Ra St. Brown - Receiving Yds',
  source_event_id: '32763016',
  esbid: ESBID,
  season_year: 2023,
  is_open: true,
  is_live,
  selection_count: 2,
  is_market_settled: false,
  observed_at
})

const selection_row = ({ source_market_id, line, observed_at }) => ({
  source_id: 'FANDUEL',
  source_market_id,
  source_selection_id: `${source_market_id}-over`,
  time_type: 'CLOSE',
  selection_pid: PID,
  selection_name: 'Amon-Ra St. Brown OVER',
  selection_type: 'OVER',
  selection_metric_line: line,
  odds_american: -110,
  observed_at
})

// The live row is the NEWEST, so it wins market-row-dedup.mjs's
// newest-observation ordering. A fixture where the pregame row happened to be
// newer could not distinguish the filter from the ordering.
const PREGAME = {
  source_market_id: 'pregame-1',
  is_live: false,
  line: 88.5,
  observed_at: new Date('2023-11-12T16:00:00Z')
}
const LIVE = {
  source_market_id: 'live-1',
  is_live: true,
  line: 162.5,
  observed_at: new Date('2023-11-12T19:30:00Z')
}
const UNKNOWN = {
  source_market_id: 'unknown-1',
  is_live: null,
  line: 71.5,
  observed_at: new Date('2023-11-12T15:00:00Z')
}

const seed = async (shapes) => {
  await knex('prop_market_selections_index')
    .where('source_id', 'FANDUEL')
    .whereIn(
      'source_market_id',
      [PREGAME, LIVE, UNKNOWN].map((s) => s.source_market_id)
    )
    .del()
  await knex('prop_markets_index')
    .where('source_id', 'FANDUEL')
    .whereIn(
      'source_market_id',
      [PREGAME, LIVE, UNKNOWN].map((s) => s.source_market_id)
    )
    .del()

  for (const shape of shapes) {
    await knex('prop_markets_index').insert(market_row(shape))
    await knex('prop_market_selections_index').insert(selection_row(shape))
  }
}

const surviving_market_ids = async () => {
  const qb = knex('prop_markets_index')
    .select('source_market_id')
    .where('source_id', 'FANDUEL')
    .whereIn(
      'source_market_id',
      [PREGAME, LIVE, UNKNOWN].map((s) => s.source_market_id)
    )
  apply_pregame_market_filter({ qb })
  const rows = await qb
  return rows.map((r) => r.source_market_id).sort()
}

describe('data views pregame market filter', function () {
  this.timeout(60 * 1000)

  before(async () => {
    await knex.seed.run()
  })

  beforeEach(async () => {
    await seed([PREGAME, LIVE, UNKNOWN])
  })

  it('keeps a pregame row', async () => {
    expect(await surviving_market_ids()).to.include(PREGAME.source_market_id)
  })

  it('removes an in-play row', async () => {
    expect(await surviving_market_ids()).to.not.include(LIVE.source_market_id)
  })

  it('keeps a row whose book does not report is_live', async () => {
    // The discriminating case. This assertion is what fails on the
    // whereNot('is_live', true) spelling, which passes the other two.
    expect(await surviving_market_ids()).to.include(UNKNOWN.source_market_id)
  })

  it('is not vacuous -- all three shapes are present before filtering', async () => {
    const all = await knex('prop_markets_index')
      .select('source_market_id')
      .where('source_id', 'FANDUEL')
      .whereIn(
        'source_market_id',
        [PREGAME, LIVE, UNKNOWN].map((s) => s.source_market_id)
      )
    expect(all.length).to.equal(3)
  })

  describe('the generated data-view SQL carries the predicate', function () {
    // A wiring check, not a behaviour one: it asserts the filter REACHED the
    // generated query on each path. The behaviour it enforces is pinned by the
    // three cases above; this is what catches a future edit that drops one of
    // the two call sites, which those cases cannot see.
    // Anchored on the ALIAS each path uses, not on the bare column name. The
    // two CTEs land in ONE generated statement, so a matcher on `is_live`
    // alone passes for the bridge on the column CTE's predicate -- verified:
    // deleting the bridge call site left such a matcher green.
    const column_cte_predicate = /"prop_markets_index"\."is_live" is null/i
    const line_axis_predicate = /"m"\."is_live" is null/i

    it('on the betting-market column CTE', async () => {
      const { query } = await get_data_view_results_query({
        columns: [
          {
            column_id: 'player_game_prop_line_from_betting_markets',
            params: {
              year: [2023],
              market_type: ['GAME_RECEIVING_YARDS'],
              source_id: ['FANDUEL'],
              time_type: ['CLOSE']
            }
          }
        ],
        where: [],
        sort: [],
        splits: []
      })
      const sql = query.toString()
      expect(sql).to.match(column_cte_predicate)
      // The bridge is not active on this request, so its alias must be absent
      // -- which is what makes the assertion below meaningful rather than a
      // restatement of this one.
      expect(sql).to.not.match(line_axis_predicate)
    })

    it('on the line-axis identity bridge', async () => {
      const { query } = await get_data_view_results_query({
        columns: [
          {
            column_id: 'player_game_prop_line_from_betting_markets',
            params: {
              year: [2023],
              market_type: ['GAME_ALT_PASSING_YARDS'],
              source_id: ['FANDUEL'],
              time_type: ['CLOSE']
            }
          }
        ],
        where: [],
        sort: [],
        splits: [],
        row_axes: ['year', 'week', 'line']
      })
      expect(query.toString()).to.match(line_axis_predicate)
    })
  })
})
