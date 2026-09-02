/* global describe, it, before, after, beforeEach */

// Red/green proof for check_projections_index_floor, the post-run row-count
// oracle every WEEKLY projection importer hangs off.
//
// It shipped with no spec at all, which is how it spent a season short-
// circuiting on `current_season.is_offseason` without anyone noticing what that
// predicate actually covered. So every leg here is a PAIR -- a seeded short run
// that must throw against a healthy one that must not -- rather than a single
// green, because a check that cannot report is indistinguishable from a clean
// result and fails in the direction that looks like success.
//
// The leg that carries the design decision is `fires inside the offseason once
// the publication window is open`. `is_offseason` is `week === 0` and `week` is
// `diff(regular_season_start, 'weeks')`, so it stays TRUE for the whole run-up
// week in which the sources publish week 1 -- the check was asleep across
// exactly the imports that seed a season. That leg pins a clock where the OLD
// predicate and the NEW one DISAGREE and asserts `is_offseason` is still true
// while the check fires anyway. A clock outside the offseason would pass under
// either rule and prove nothing.

import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import { check_projections_index_floor } from '#libs-server'

const expect = chai.expect

// Local rejection helpers rather than chai-as-promised, which is not a
// dependency here. `expect_rejects` returns the error so a leg can assert on
// the tag and the message, and it fails loudly when the promise RESOLVES --
// the case a bare try/catch swallows into a pass.
const expect_rejects = async (promise, pattern) => {
  let error
  try {
    await promise
  } catch (caught) {
    error = caught
  }
  expect(error, 'expected a rejection, got a resolved promise').to.be.an(
    'error'
  )
  expect(error.message).to.match(pattern)
  return error
}

const expect_resolves = async (promise) => {
  let error
  try {
    await promise
  } catch (caught) {
    error = caught
  }
  expect(
    error,
    `expected the check to stay silent, got: ${error && error.message}`
  ).to.equal(undefined)
}

const SEASON_YEAR = 2026
const OTHER_SEASON_YEAR = 2025
const WEEK = 1
const OTHER_WEEK = 2
const SOURCE_ID = 911
const OTHER_SOURCE_ID = 912

// `regular_season_start` for 2026 is Tue Sep 1 2026 00:00 ET. The three clocks
// below straddle it deliberately.
//
// Offseason AND inside the publication window -- the window the check used to
// be blind to, and the only clock at which the old predicate and the new one
// give different answers. This is the discriminating input.
const OFFSEASON_IN_WINDOW = '2026-09-02T12:00:00Z'
// Offseason and BEFORE the sources publish anything. The one condition that
// legitimately silences this check.
const BEFORE_PUBLISH_WINDOW = '2026-08-25T12:00:00Z'
// Well inside the regular season: not the offseason, window open. Both the old
// rule and the new one leave the check awake here, which is why this clock
// alone cannot prove anything about the change.
const REGULAR_SEASON = '2026-09-22T12:00:00Z'

// `from` exists so a leg can TOP UP a seeded set without colliding on
// (source_id, pid, week, season_year, season_type) -- the below-floor /
// at-floor pair needs the second insert to add rows rather than replace them.
const seed_week_rows = async ({
  count,
  from = 0,
  source_id = SOURCE_ID,
  season_year = SEASON_YEAR,
  week = WEEK,
  season_type = 'REG'
}) => {
  if (!count) return
  await knex('projections_index').insert(
    Array.from({ length: count }, (_, index) => ({
      pid: `TEST-WKFLOOR-${String(from + index).padStart(6, '0')}`,
      source_id,
      season_year,
      week,
      season_type,
      passing_yards: 100
    }))
  )
}

const clear_week_rows = () =>
  knex('projections_index')
    .whereIn('source_id', [SOURCE_ID, OTHER_SOURCE_ID])
    .del()

describe('libs-server check_projections_index_floor', function () {
  this.timeout(20000)

  before(async () => {
    await clear_week_rows()
  })

  after(async () => {
    // Restore the SUITE's clock, not the wall clock. test/global.mjs pins the
    // whole run when LEAGUE_MOCK_DATE is set, and a bare MockDate.reset() here
    // would silently unpin every spec that runs after this file.
    if (process.env.LEAGUE_MOCK_DATE) MockDate.set(process.env.LEAGUE_MOCK_DATE)
    else MockDate.reset()
    await clear_week_rows()
  })

  beforeEach(async () => {
    MockDate.set(REGULAR_SEASON)
    await clear_week_rows()
  })

  it('throws a tagged shortfall below the floor, and is silent at it', async () => {
    await seed_week_rows({ count: 3 })
    const error = await expect_rejects(
      check_projections_index_floor({
        season_year: SEASON_YEAR,
        week: WEEK,
        source_id: SOURCE_ID,
        season_type: 'REG'
      }),
      /row-count shortfall/
    )
    expect(error.row_count_shortfall).to.equal(true)
    expect(error.message).to.include(`source_id=${SOURCE_ID}`)
    expect(error.message).to.include(': 3 rows (floor=30)')

    await seed_week_rows({ count: 27, from: 3 })
    await expect_resolves(
      check_projections_index_floor({
        season_year: SEASON_YEAR,
        week: WEEK,
        source_id: SOURCE_ID,
        season_type: 'REG'
      })
    )
  })

  it('honours an explicit floor in both directions', async () => {
    await seed_week_rows({ count: 5 })
    await expect_rejects(
      check_projections_index_floor({
        season_year: SEASON_YEAR,
        week: WEEK,
        source_id: SOURCE_ID,
        floor: 6,
        season_type: 'REG'
      }),
      /floor=6/
    )
    await expect_resolves(
      check_projections_index_floor({
        season_year: SEASON_YEAR,
        week: WEEK,
        source_id: SOURCE_ID,
        floor: 5,
        season_type: 'REG'
      })
    )
  })

  it('counts the sourceids arm as a set, not one source at a time', async () => {
    await seed_week_rows({ count: 3, source_id: SOURCE_ID })
    await seed_week_rows({ count: 3, source_id: OTHER_SOURCE_ID })
    const sourceids = [SOURCE_ID, OTHER_SOURCE_ID]

    await expect_rejects(
      check_projections_index_floor({
        season_year: SEASON_YEAR,
        week: WEEK,
        sourceids,
        floor: 7,
        season_type: 'REG'
      }),
      /source_id=911,912/
    )
    await expect_resolves(
      check_projections_index_floor({
        season_year: SEASON_YEAR,
        week: WEEK,
        sourceids,
        floor: 6,
        season_type: 'REG'
      })
    )
  })

  it('scopes its count to the asked season_year, week and source', async () => {
    // Rows that must NOT be counted: 30 for the right source in the wrong
    // year, 30 in the wrong week, 30 for the wrong source.
    await seed_week_rows({ count: 30, season_year: OTHER_SEASON_YEAR })
    await seed_week_rows({ count: 30, week: OTHER_WEEK })
    await seed_week_rows({ count: 30, source_id: OTHER_SOURCE_ID })

    // ANCHORED, and it has to be. `/0 rows/` unanchored is a substring of
    // "30 rows", so dropping any one predicate would leave this leg green on
    // the wrong count. The count is the whole assertion here, so the pattern
    // pins the count and nothing else.
    await expect_rejects(
      check_projections_index_floor({
        season_year: SEASON_YEAR,
        week: WEEK,
        source_id: SOURCE_ID,
        season_type: 'REG'
      }),
      /: 0 rows \(floor=30\)/
    )
  })

  it('fires inside the offseason once the publication window is open', async () => {
    // The discriminating clock: `is_offseason` is TRUE here, so the predicate
    // this check used to carry would return silently. Asserting that first is
    // what makes the rejection below evidence of the change rather than
    // evidence that the clock happened to sit in the regular season.
    MockDate.set(OFFSEASON_IN_WINDOW)
    const { current_season } = await import('#constants')
    expect(current_season.is_offseason).to.equal(true)

    await seed_week_rows({ count: 1 })
    await expect_rejects(
      check_projections_index_floor({
        season_year: SEASON_YEAR,
        week: WEEK,
        source_id: SOURCE_ID,
        season_type: 'REG'
      }),
      /row-count shortfall/
    )
  })

  it('is silent before sources publish, and that window is the only skip', async () => {
    // Same empty slice, same offseason, eight days apart across
    // `regular_season_start`. Pairing the two is what proves the skip is
    // bounded by the publication window rather than by the offseason -- both
    // clocks are inside the offseason, and only one of them silences the check.
    MockDate.set(BEFORE_PUBLISH_WINDOW)
    const { current_season } = await import('#constants')
    expect(current_season.is_offseason).to.equal(true)
    await expect_resolves(
      check_projections_index_floor({
        season_year: SEASON_YEAR,
        week: WEEK,
        source_id: SOURCE_ID,
        season_type: 'REG'
      })
    )

    MockDate.set(OFFSEASON_IN_WINDOW)
    expect(current_season.is_offseason).to.equal(true)
    await expect_rejects(
      check_projections_index_floor({
        season_year: SEASON_YEAR,
        week: WEEK,
        source_id: SOURCE_ID,
        season_type: 'REG'
      }),
      /row-count shortfall/
    )
  })
})
