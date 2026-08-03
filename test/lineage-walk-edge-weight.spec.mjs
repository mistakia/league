/* global describe before beforeEach it */
import * as chai from 'chai'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import {
  ASSET_TYPE,
  TRANSFORMATION_TYPE
} from '#libs-server/roster-asset-lineage/constants.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

const LID = 1

// Regression lock for the edge-weight formula in view_roster_asset_lineage_walk.
//
// The view originally accumulated `cumulative_weight * (source_share *
// target_share)` per hop. That double-counts: a holding's source_share is the
// fraction of its outbound basket, which is the SAME fraction already applied
// as the target_share that minted it one hop earlier. Multiplying both
// compounds it twice along a chain. The corrected form -- target_share only --
// shipped in league 17e469052.
//
// The bug was latent for its entire life because every share in production is
// 1.0 under the v1 START_TEAM_BEARS rule, and 1*1 === 1. So no fixture built
// from real data can distinguish the two formulas, and none did. This spec
// exists to make the distinction observable: it is the only place non-unit
// shares occur anywhere in the codebase, and without it the formula is free to
// regress silently until multi-leg trade weighting ships.
//
// Chain: H1 --(0.5)--> H2 --(0.4)--> H3
//   corrected: 1.0 * 0.5 = 0.5, then 0.5 * 0.4 = 0.2
//   original:  1.0 * (1.0 * 0.5) = 0.5, then 0.5 * (0.5 * 0.4) = 0.1
// Note leg 2's source_share is deliberately 0.5 -- equal to leg 1's
// target_share -- because that equality is precisely the double-count the fix
// removes. Setting it to anything else would make the spec pass for the wrong
// reason.
describe('LINEAGE - walk edge weight', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  beforeEach(async function () {
    this.timeout(60 * 1000)
    await league(knex)
    await knex('roster_asset_transformation').del()
    await knex('roster_asset_holding').del()
  })

  // roster_asset_holding.league_format_id is NOT NULL with a foreign key, so
  // the fixture has to borrow a real format rather than invent one.
  // The foreign key targets league_formats(id), not a league_format_id column.
  const resolve_league_format_id = async () => {
    const row = await knex('league_formats').select('id').first()
    expect(row, 'seed did not provide a league_format').to.exist
    return row.id
  }

  const insert_holding = async ({
    tid,
    league_format_id,
    salary_paid = null
  }) => {
    const [row] = await knex('roster_asset_holding')
      .insert({
        lid: LID,
        tid,
        asset_type: ASSET_TYPE.PLAYER,
        period_start: new Date('2026-01-01T00:00:00Z'),
        league_format_id,
        salary_paid
      })
      .returning('holding_id')
    return row.holding_id
  }

  const insert_edge = async ({
    source_holding_id,
    target_holding_id,
    source_share,
    target_share,
    occurred_at
  }) => {
    await knex('roster_asset_transformation').insert({
      transformation_id: knex.raw('gen_random_uuid()'),
      lid: LID,
      transformation_type: TRANSFORMATION_TYPE.TRADE,
      occurred_at,
      source_holding_id,
      target_holding_id,
      source_share,
      target_share
    })
  }

  it('multiplies target_share only, not source_share * target_share', async function () {
    this.timeout(60 * 1000)

    const league_format_id = await resolve_league_format_id()

    // salary_paid > 0 makes H1 a 'salary' root, the shape cost-attribution
    // walks actually filter on.
    const first_holding_id = await insert_holding({
      tid: 1,
      league_format_id,
      salary_paid: 10
    })
    const second_holding_id = await insert_holding({ tid: 2, league_format_id })
    const third_holding_id = await insert_holding({ tid: 3, league_format_id })

    await insert_edge({
      source_holding_id: first_holding_id,
      target_holding_id: second_holding_id,
      source_share: 1.0,
      target_share: 0.5,
      occurred_at: new Date('2026-02-01T00:00:00Z')
    })
    await insert_edge({
      source_holding_id: second_holding_id,
      target_holding_id: third_holding_id,
      source_share: 0.5,
      target_share: 0.4,
      occurred_at: new Date('2026-03-01T00:00:00Z')
    })

    const rows = await knex('view_roster_asset_lineage_walk')
      .where('originating_holding_id', first_holding_id)
      .orderBy('depth', 'asc')

    expect(rows.length).to.equal(3)

    expect(rows[0].depth).to.equal(0)
    expect(Number(rows[0].cumulative_weight)).to.equal(1)
    expect(rows[0].root_kind).to.equal('salary')

    expect(rows[1].depth).to.equal(1)
    expect(Number(rows[1].current_holding_id)).to.equal(
      Number(second_holding_id)
    )
    expect(Number(rows[1].cumulative_weight)).to.equal(0.5)

    expect(rows[2].depth).to.equal(2)
    expect(Number(rows[2].current_holding_id)).to.equal(
      Number(third_holding_id)
    )
    // 0.2 under the corrected formula; 0.1 under the original.
    expect(Number(rows[2].cumulative_weight)).to.equal(0.2)
  })
})
