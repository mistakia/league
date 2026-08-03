/* global describe, beforeEach, it */
import * as chai from 'chai'

import knex from '#db'
import { prune_stale_prop_pairings } from '../scripts/generate-prop-pairings.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

// prop_pairings is not per-league state, so db/fixtures/league.mjs does not
// reset it. Every test here clears both tables itself.
const reset = async () => {
  await knex('prop_pairing_props').del()
  await knex('prop_pairings').del()
}

const insert_pairing = async ({
  pairing_id,
  season_year,
  season_type,
  week
}) => {
  await knex('prop_pairings').insert({
    pairing_id,
    source_id: 'FANDUEL',
    name: `${pairing_id} (pending)`,
    nfl_team: 'KC',
    season_year,
    season_type,
    week,
    size: 1
  })
  await knex('prop_pairing_props').insert({
    pairing_id,
    source_market_id: `m-${pairing_id}`,
    source_selection_id: `s-${pairing_id}`
  })
}

const surviving_ids = async () => {
  const rows = await knex('prop_pairings')
    .select('pairing_id')
    .orderBy('pairing_id')
  return rows.map((row) => row.pairing_id)
}

describe('prop pairings prune', function () {
  this.timeout(60 * 1000)

  beforeEach(reset)

  it('retains the current week and the one before it, deletes older', async () => {
    await insert_pairing({
      pairing_id: 'p_w3',
      season_year: 2026,
      season_type: 'REG',
      week: 3
    })
    await insert_pairing({
      pairing_id: 'p_w4',
      season_year: 2026,
      season_type: 'REG',
      week: 4
    })
    await insert_pairing({
      pairing_id: 'p_w5',
      season_year: 2026,
      season_type: 'REG',
      week: 5
    })

    const result = await prune_stale_prop_pairings({
      week: 5,
      year: 2026,
      seas_type: 'REG'
    })

    expect(result.skipped).to.equal(false)
    expect(result.pairings_deleted).to.equal(1)
    expect(await surviving_ids()).to.eql(['p_w4', 'p_w5'])
  })

  it('deletes prior seasons at the same week number', async () => {
    await insert_pairing({
      pairing_id: 'p_2025',
      season_year: 2025,
      season_type: 'REG',
      week: 5
    })
    await insert_pairing({
      pairing_id: 'p_2026',
      season_year: 2026,
      season_type: 'REG',
      week: 5
    })

    await prune_stale_prop_pairings({ week: 5, year: 2026, seas_type: 'REG' })

    expect(await surviving_ids()).to.eql(['p_2026'])
  })

  // The postseason case the week-encoding guideline requires. POST week 1 and
  // REG week 1 are the same week NUMBER, so a prune that keyed on
  // (season_year, week) alone would retain the REG rows as though they were
  // the live ones.
  it('does not retain REG rows when pruning in POST at the same week number', async () => {
    await insert_pairing({
      pairing_id: 'p_reg1',
      season_year: 2026,
      season_type: 'REG',
      week: 1
    })
    await insert_pairing({
      pairing_id: 'p_reg2',
      season_year: 2026,
      season_type: 'REG',
      week: 2
    })
    await insert_pairing({
      pairing_id: 'p_post1',
      season_year: 2026,
      season_type: 'POST',
      week: 1
    })

    await prune_stale_prop_pairings({ week: 1, year: 2026, seas_type: 'POST' })

    expect(await surviving_ids()).to.eql(['p_post1'])
  })

  it('deletes the child props of every pruned pairing', async () => {
    await insert_pairing({
      pairing_id: 'p_old',
      season_year: 2025,
      season_type: 'REG',
      week: 9
    })
    await insert_pairing({
      pairing_id: 'p_new',
      season_year: 2026,
      season_type: 'REG',
      week: 9
    })

    const result = await prune_stale_prop_pairings({
      week: 9,
      year: 2026,
      seas_type: 'REG'
    })

    expect(result.props_deleted).to.equal(1)
    const props = await knex('prop_pairing_props').select('pairing_id')
    expect(props.map((row) => row.pairing_id)).to.eql(['p_new'])
  })

  // The footgun this guard exists for: in PRE and the offseason nfl_seas_week
  // reads 0 or 1, so a window computed from it selects nothing and the prune
  // becomes a truncate arrived at by arithmetic.
  it('refuses to run outside REG and POST rather than wiping the table', async () => {
    await insert_pairing({
      pairing_id: 'p_reg5',
      season_year: 2026,
      season_type: 'REG',
      week: 5
    })

    const result = await prune_stale_prop_pairings({
      week: 0,
      year: 2026,
      seas_type: 'PRE'
    })

    expect(result.skipped).to.equal(true)
    expect(result.pairings_deleted).to.equal(0)
    expect(await surviving_ids()).to.eql(['p_reg5'])
  })

  it('never deletes below week 1 when the window would underflow', async () => {
    await insert_pairing({
      pairing_id: 'p_w1',
      season_year: 2026,
      season_type: 'REG',
      week: 1
    })

    await prune_stale_prop_pairings({ week: 1, year: 2026, seas_type: 'REG' })

    expect(await surviving_ids()).to.eql(['p_w1'])
  })
})
