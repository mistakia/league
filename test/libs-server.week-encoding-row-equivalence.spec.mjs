/* global describe before after it */

import * as chai from 'chai'

import knex from '#db'
import { apply_scope_to_query } from '#libs-server/data-views/apply-scope-to-query.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

// The row-level half of the week-encoding gate.
//
// The sibling spec (libs-server.apply-scope-week-encoding) asserts WHICH
// encoding the builder chooses by reading the emitted SQL. That is a statement
// about the builder. This one is a statement about Postgres: that the encoding
// the builder chose actually selects the same rows the composite would have.
// A string assertion cannot establish that, because the whole risk is a
// predicate that reads correct and matches a different set.
//
// It needs real rows, and the pathology tables are empty in league_test, so it
// seeds the handful of nfl_games it needs and removes them afterwards. The
// fixture is deliberately built to make a WRONG answer visible: it contains the
// off-diagonal games (2024 week 2, 2025 week 1) that a ragged scope must NOT
// return, so an emitter that wrongly decomposed would come back with four rows
// where two were asked for.

// esbid is int4, so the fixture ids have to stay under 2147483647 -- a naive
// 99000000xx overflows the column. A fake 2099 season sits inside the range and
// cannot collide with a real game.
const FIXTURE_ESBIDS = [
  2099000001, 2099000002, 2099000003, 2099000004, 2099000005
]

// away_nfl_team and home_nfl_team are NOT NULL; the values are arbitrary
// because nothing here reads them, but the row will not insert without them.
const FIXTURE_GAMES = [
  {
    esbid: FIXTURE_ESBIDS[0],
    season_year: 2024,
    season_type: 'REG',
    week: 1,
    away_nfl_team: 'BUF',
    home_nfl_team: 'KC'
  },
  {
    esbid: FIXTURE_ESBIDS[1],
    season_year: 2024,
    season_type: 'REG',
    week: 2,
    away_nfl_team: 'BUF',
    home_nfl_team: 'KC'
  },
  {
    esbid: FIXTURE_ESBIDS[2],
    season_year: 2025,
    season_type: 'REG',
    week: 1,
    away_nfl_team: 'BUF',
    home_nfl_team: 'KC'
  },
  {
    esbid: FIXTURE_ESBIDS[3],
    season_year: 2025,
    season_type: 'REG',
    week: 2,
    away_nfl_team: 'BUF',
    home_nfl_team: 'KC'
  },
  {
    esbid: FIXTURE_ESBIDS[4],
    season_year: 2025,
    season_type: 'POST',
    week: 1,
    away_nfl_team: 'BUF',
    home_nfl_team: 'KC'
  }
]

const esbids_for = async ({ nfl_week_ids, ...rest }) => {
  const query = knex('nfl_games').select('esbid')
  apply_scope_to_query({
    query,
    table_name: 'nfl_games',
    query_context: { nfl_week_ids },
    ...rest
  })
  query.whereIn('nfl_games.esbid', FIXTURE_ESBIDS)
  const rows = await query
  return rows.map((row) => row.esbid).sort()
}

// The composite is correct by construction -- nfl_week_id is GENERATED from the
// three components -- so it is the reference every case is checked against.
const composite_esbids = async (nfl_week_ids) => {
  const rows = await knex('nfl_games')
    .select('esbid')
    .whereIn('nfl_games.nfl_week_id', nfl_week_ids)
    .whereIn('nfl_games.esbid', FIXTURE_ESBIDS)
  return rows.map((row) => row.esbid).sort()
}

describe('week encoding row equivalence', () => {
  before(async () => {
    await knex('nfl_games').whereIn('esbid', FIXTURE_ESBIDS).del()
    await knex('nfl_games').insert(FIXTURE_GAMES)
  })

  after(async () => {
    await knex('nfl_games').whereIn('esbid', FIXTURE_ESBIDS).del()
  })

  it('seeds a fixture that can actually distinguish the two encodings', async () => {
    // The control for the controls. If the off-diagonal games were missing,
    // every case below would agree no matter which encoding was emitted.
    const all = await knex('nfl_games')
      .whereIn('esbid', FIXTURE_ESBIDS)
      .select('esbid')
    expect(all).to.have.lengthOf(5)
    const ragged = ['2024_REG_WEEK_1', '2025_REG_WEEK_2']
    const decomposed_would_return = await knex('nfl_games')
      .select('esbid')
      .whereIn('nfl_games.season_year', [2024, 2025])
      .whereIn('nfl_games.season_type', ['REG'])
      .whereIn('nfl_games.week', [1, 2])
      .whereIn('nfl_games.esbid', FIXTURE_ESBIDS)
    expect(await composite_esbids(ragged)).to.have.lengthOf(2)
    expect(decomposed_would_return).to.have.lengthOf(4)
  })

  const cases = [
    [
      'a contiguous single-season slice',
      ['2025_REG_WEEK_1', '2025_REG_WEEK_2']
    ],
    [
      'a clean multi-year cross product',
      [
        '2024_REG_WEEK_1',
        '2024_REG_WEEK_2',
        '2025_REG_WEEK_1',
        '2025_REG_WEEK_2'
      ]
    ],
    ['a ragged multi-year list', ['2024_REG_WEEK_1', '2025_REG_WEEK_2']],
    [
      'a list ragged across season types',
      ['2025_REG_WEEK_1', '2025_POST_WEEK_1']
    ],
    ['a single week', ['2025_POST_WEEK_1']]
  ]

  for (const [label, nfl_week_ids] of cases) {
    it(`returns exactly the composite's rows for ${label}`, async () => {
      const emitted = await esbids_for({ nfl_week_ids })
      const reference = await composite_esbids(nfl_week_ids)
      expect(emitted).to.deep.equal(reference)
      // Guard against the degenerate pass where both come back empty.
      expect(reference.length).to.be.greaterThan(0)
    })
  }

  it('returns the composite rows when a caller suppresses the season-year half', async () => {
    const nfl_week_ids = ['2025_REG_WEEK_1', '2025_REG_WEEK_2']
    const emitted = await esbids_for({ nfl_week_ids, has_season_year: false })
    expect(emitted).to.deep.equal(await composite_esbids(nfl_week_ids))
  })
})
