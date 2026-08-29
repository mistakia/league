/* global describe, it, before, after, beforeEach */

// Red/green proof for check_season_projections_consensus, the output oracle for
// the season-long consensus and the valuation board that hangs off it.
//
// Every leg is a PAIR, and two of them are pairs for a specific reason rather
// than for symmetry:
//
// - `sees the incident an aggregate count would miss` prices 22 of 23 formats at
//   zero, which is the literal 2026-08-04 shape. A total-count limb reads
//   NON-ZERO on that input and passes. The share limb reads it as 1/23 and
//   fires. Running both shapes through one check is the only thing that
//   distinguishes the two designs.
//
// - `does not fire vacuously on a season nobody has published yet` is the
//   false-positive half. An oracle that reports on a correct run gets muted, and
//   a muted oracle is worse than none. The pair is: empty season silent, then
//   the SAME empty consensus with one source row present must fire.

import * as chai from 'chai'

import knex from '#db'
import { external_data_sources } from '#constants'
import {
  check_season_projections_consensus,
  read_season_consensus_baseline
} from '#libs-server'

const expect = chai.expect

const SEASON_YEAR = 2091
const SOURCE_ID = 903

const clear = async () => {
  await knex('season_projections_index')
    .where({ season_year: SEASON_YEAR })
    .del()
  await knex('league_format_player_season_projection_values')
    .where({ season_year: SEASON_YEAR })
    .del()
}

const seed_season_rows = async ({ count, source_id, from = 0 }) => {
  if (!count) return
  await knex('season_projections_index').insert(
    Array.from({ length: count }, (_, index) => ({
      pid: `TEST-SZNCONS-${String(from + index).padStart(6, '0')}`,
      source_id,
      season_year: SEASON_YEAR,
      passing_yards: 100
    }))
  )
}

// One row per format so the SHARE is unambiguous: `positive_formats` of
// `formats` carry a market_salary_positive above zero.
const seed_valuation_board = async ({ formats, positive_formats }) => {
  const rows = []
  for (let index = 0; index < formats; index++) {
    rows.push({
      pid: `TEST-SZNCONS-${String(index).padStart(6, '0')}`,
      league_format_id: `test-szn-format-${index}`,
      season_year: SEASON_YEAR,
      market_salary_positive: index < positive_formats ? 100 : 0
    })
  }
  if (rows.length) {
    await knex('league_format_player_season_projection_values').insert(rows)
  }
}

const healthy_consensus = () =>
  seed_season_rows({ count: 300, source_id: external_data_sources.AVERAGE })

describe('libs-server check_season_projections_consensus', function () {
  this.timeout(20000)

  before(clear)
  after(clear)
  beforeEach(clear)

  it('does not fire vacuously on a season nobody has published yet', async () => {
    // Nothing at all: no sources, no consensus, no board. A correct first run.
    expect(
      await check_season_projections_consensus({ season_year: SEASON_YEAR })
    ).to.equal(null)

    // One source row and nothing else, and the silence has to end. This is the
    // half that proves the skip is bounded by the absence of SOURCES rather
    // than being an unconditional early return.
    await seed_season_rows({ count: 1, source_id: SOURCE_ID })
    const shortfall = await check_season_projections_consensus({
      season_year: SEASON_YEAR
    })
    expect(shortfall).to.be.a('string')
    expect(shortfall).to.match(/season consensus row-count shortfall/)
  })

  it('is silent on a healthy season', async () => {
    await seed_season_rows({ count: 500, source_id: SOURCE_ID, from: 1000 })
    await healthy_consensus()
    await seed_valuation_board({ formats: 25, positive_formats: 23 })

    expect(
      await check_season_projections_consensus({ season_year: SEASON_YEAR })
    ).to.equal(null)
  })

  it('fires on an empty consensus over a populated source set', async () => {
    // The 2026-08-04 read-path shape: sources are there, the consensus is not.
    await seed_season_rows({ count: 500, source_id: SOURCE_ID, from: 1000 })
    await seed_valuation_board({ formats: 25, positive_formats: 23 })

    const shortfall = await check_season_projections_consensus({
      season_year: SEASON_YEAR
    })
    expect(shortfall).to.match(/0 AVERAGE rows against 500 source rows/)
  })

  it('sees the incident an aggregate count would miss', async () => {
    await seed_season_rows({ count: 500, source_id: SOURCE_ID, from: 1000 })
    await healthy_consensus()

    // 22 of 23 formats priced at zero -- the literal incident. The single
    // surviving format keeps the AGGREGATE positive count non-zero, so a
    // total-count limb reads this as healthy.
    await seed_valuation_board({ formats: 23, positive_formats: 1 })
    const shortfall = await check_season_projections_consensus({
      season_year: SEASON_YEAR
    })
    expect(shortfall).to.match(/market_salary population collapsed/)
    expect(shortfall).to.include('1 of 23 league formats')

    // The control, at the same aggregate scale: 23 of 25 positive is the
    // measured production shape and must stay silent. Without this half the leg
    // above would also pass a check that simply always fires.
    await clear()
    await seed_season_rows({ count: 500, source_id: SOURCE_ID, from: 1000 })
    await healthy_consensus()
    await seed_valuation_board({ formats: 25, positive_formats: 23 })
    expect(
      await check_season_projections_consensus({ season_year: SEASON_YEAR })
    ).to.equal(null)
  })

  it('fires when the board is not written at all', async () => {
    await seed_season_rows({ count: 500, source_id: SOURCE_ID, from: 1000 })
    await healthy_consensus()

    const shortfall = await check_season_projections_consensus({
      season_year: SEASON_YEAR
    })
    expect(shortfall).to.match(/no season valuation board written/)
  })

  it('ratchets against a baseline read before the upsert', async () => {
    await seed_season_rows({ count: 500, source_id: SOURCE_ID, from: 1000 })
    await seed_valuation_board({ formats: 25, positive_formats: 23 })
    await healthy_consensus()

    const baseline = await read_season_consensus_baseline({
      season_year: SEASON_YEAR
    })
    expect(baseline.consensus_row_count).to.equal(300)

    // Unchanged: the ratchet must not fire on a run that wrote the same rows.
    expect(
      await check_season_projections_consensus({
        season_year: SEASON_YEAR,
        baseline
      })
    ).to.equal(null)

    // A halving. Still comfortably above the ABSOLUTE floor of 250 by design --
    // if this leg tripped the absolute limb instead, it would prove nothing
    // about the ratchet.
    await knex('season_projections_index')
      .where({
        season_year: SEASON_YEAR,
        source_id: external_data_sources.AVERAGE
      })
      .whereRaw("pid > 'TEST-SZNCONS-000139'")
      .del()
    const remaining = await read_season_consensus_baseline({
      season_year: SEASON_YEAR
    })
    expect(remaining.consensus_row_count).to.equal(140)
    expect(remaining.consensus_row_count).to.be.below(300 * 0.5)

    const shortfall = await check_season_projections_consensus({
      season_year: SEASON_YEAR,
      baseline,
      consensus_floor: 100
    })
    expect(shortfall).to.match(/shrank past its ratchet/)
    expect(shortfall).to.include('300 rows before the run, 140 after')
  })

  it('is silent on a zero baseline, the first run of a new season_year', async () => {
    // This leg pins the BEHAVIOUR, and it is honest about what it does not
    // prove. Deleting the `consensus_row_count > 0` guard from the check leaves
    // this green -- measured -- because the ratchet floor is computed as
    // `baseline * (1 - shrink)`, which is 0 for a zero baseline and which no
    // row count falls below. The guard is intent and future-proofing, not a
    // condition this input can distinguish. What this leg WOULD catch is the
    // ratchet being rewritten as a ratio against the baseline, which divides by
    // zero here.
    await seed_season_rows({ count: 500, source_id: SOURCE_ID, from: 1000 })
    await healthy_consensus()
    await seed_valuation_board({ formats: 25, positive_formats: 23 })

    expect(
      await check_season_projections_consensus({
        season_year: SEASON_YEAR,
        baseline: { season_year: SEASON_YEAR, consensus_row_count: 0 }
      })
    ).to.equal(null)
  })
})
