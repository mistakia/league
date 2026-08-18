/* global describe before it */
import * as chai from 'chai'

import knex from '#db'
import { default_points_added, external_data_sources } from '#constants'
import process_projections_for_league_format from '#scripts/process-projections-for-league-format.mjs'

import league from '#db/fixtures/league.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect
chai.should()

const VALUES_TABLE = 'league_format_player_projection_values'
const POINTS_TABLE = 'scoring_format_player_projection_points'
const YEAR = 2024
const WEEKS = [0, 1, 2, 3]

// Enough of a board that calculateBaselines can fill a starting lineup and
// produce a `starter` at each position -- without one, calculateValues leaves
// every player on the sentinel for a reason that has nothing to do with the
// defect under test.
const POSITION_COUNTS = { QB: 8, RB: 16, WR: 20, TE: 8 }

describe('SCRIPTS process-projections-for-league-format', function () {
  this.timeout(90 * 1000)

  let league_format_id
  let scoring_format_id
  let seeded_pids = []

  before(async function () {
    await knex.seed.run()
    await league(knex)

    const format_row = await knex('league_formats')
      .select('id', 'scoring_format_id')
      .first()
    league_format_id = format_row.id
    scoring_format_id = format_row.scoring_format_id

    // Draw real players per position from the seeded pool.
    for (const [position, count] of Object.entries(POSITION_COUNTS)) {
      const rows = await knex('player')
        .select('pid')
        .where({ primary_position: position })
        .limit(count)
      seeded_pids = seeded_pids.concat(rows.map((row) => row.pid))
    }

    await knex(VALUES_TABLE)
      .where({ league_format_id, season_year: YEAR })
      .del()
    await knex(POINTS_TABLE)
      .where({ scoring_format_id, season_year: YEAR })
      .del()

    const projection_rows = []
    const point_rows = []
    seeded_pids.forEach((pid, index) => {
      for (const week of WEEKS) {
        // A descending spread so the board has a real ordering to rank; a flat
        // board would make every projected_points_added identical and hide an inversion.
        const total = 300 - index * 5 - week
        projection_rows.push({
          pid,
          source_id: external_data_sources.AVERAGE,
          week,
          season_year: YEAR,
          season_type: 'REG',
          passing_yards: total * 2,
          rushing_yards: total,
          receiving_yards: total
        })
        point_rows.push({
          pid,
          scoring_format_id,
          week,
          season_year: YEAR,
          projected_points_total: total
        })
      }
    })

    await knex('projections_index').insert(projection_rows)
    await knex(POINTS_TABLE).insert(point_rows)

    await process_projections_for_league_format({
      year: YEAR,
      league_format_id
    })
  })

  // This is the regression that the missing `projected_points_total as total`
  // alias produced: get_player_week_total read `.total` off a row that did not
  // carry it, so every player fell back to the sentinel and the delete-then-
  // reinsert writer replaced a whole year with -999.
  it('writes non-sentinel values when scoring-format points exist', async () => {
    // Numeric weeks only. The 'ros'/'ros_net' aggregates SKIP the sentinel and
    // so land at 0, which reads as a real value -- asserting over every row
    // passes at the broken revision and proves nothing.
    const rows = await knex(VALUES_TABLE)
      .select('projected_points_added')
      .where({ league_format_id, season_year: YEAR })
      .whereRaw("week ~ '^[0-9]+$'")

    expect(rows.length).to.be.greaterThan(0)

    const non_sentinel = rows.filter(
      (row) => Number(row.projected_points_added) !== default_points_added
    )
    expect(
      non_sentinel.length,
      'every computed value was the sentinel -- projected_points_total did not reach get_player_week_total'
    ).to.be.greaterThan(0)
  })

  it('spreads values across the board rather than collapsing to one number', async () => {
    const rows = await knex(VALUES_TABLE)
      .select('projected_points_added')
      .where({ league_format_id, season_year: YEAR, week: '0' })
      .whereNot({ projected_points_added: default_points_added })

    const distinct = new Set(
      rows.map((row) => Number(row.projected_points_added))
    )
    expect(distinct.size).to.be.greaterThan(1)
  })

  // The oracle's negative control. Without this, "no throw" is indistinguishable
  // from "the check cannot fire at all". Points rows that exist but carry a null
  // total reproduce the defect's exact shape -- the rows are READ, so the
  // denominator is nonzero, and none of them reach get_player_week_total.
  it('refuses to write, and preserves stored values, when points exist but no value is usable', async () => {
    const before_rows = await knex(VALUES_TABLE)
      .select('pid', 'week', 'projected_points_added')
      .where({ league_format_id, season_year: YEAR })
      .orderBy(['pid', 'week'])
    expect(before_rows.length).to.be.greaterThan(0)

    await knex(POINTS_TABLE)
      .where({ scoring_format_id, season_year: YEAR })
      .update({ projected_points_total: null })

    let caught
    try {
      await process_projections_for_league_format({
        year: YEAR,
        league_format_id
      })
    } catch (err) {
      caught = err
    }

    expect(caught, 'oracle did not fire').to.be.an('error')
    expect(caught.message).to.match(/refusing to write/)

    // The write is delete-then-reinsert, so the point of aborting before it is
    // that the prior year survives intact.
    const after_rows = await knex(VALUES_TABLE)
      .select('pid', 'week', 'projected_points_added')
      .where({ league_format_id, season_year: YEAR })
      .orderBy(['pid', 'week'])
    expect(after_rows).to.deep.equal(before_rows)
  })

  // The oracle's own gate. A year whose scoring format has no points rows is a
  // legitimate all-sentinel year (most historical years in production are this
  // shape), so the check must stay quiet for it rather than refusing the write.
  it('does not refuse a year that has no scoring-format points at all', async () => {
    const empty_year = YEAR - 1
    await knex(POINTS_TABLE)
      .where({ scoring_format_id, season_year: empty_year })
      .del()
    await knex('projections_index')
      .where({
        season_year: empty_year,
        source_id: external_data_sources.AVERAGE
      })
      .del()

    const projection_rows = seeded_pids.map((pid) => ({
      pid,
      source_id: external_data_sources.AVERAGE,
      week: 1,
      season_year: empty_year,
      season_type: 'REG',
      rushing_yards: 100
    }))
    await knex('projections_index').insert(projection_rows)

    let caught
    try {
      await process_projections_for_league_format({
        year: empty_year,
        league_format_id
      })
    } catch (err) {
      caught = err
    }

    expect(caught, caught && caught.message).to.equal(undefined)
  })
})
