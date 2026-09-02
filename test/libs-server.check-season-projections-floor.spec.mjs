/* global describe, it, before, after, beforeEach */

// Red/green proof for check_season_projections_floor, the post-run row-count
// oracle the six season importers hang off.
//
// It shipped unproved, and an unproved check is the failure mode it exists to
// prevent: a check that cannot report is indistinguishable from a clean result
// and fails in the direction that looks like success. So every leg here is a
// PAIR -- a seeded short run that must throw and a healthy one that must not --
// rather than a single green.
//
// The leg that carries the design decision is `stays awake in the offseason`.
// The weekly counterpart, check_projections_index_floor, short-circuits on
// current_season.is_offseason because a WEEKLY row is legitimately absent then.
// A SEASON row is the opposite: the offseason is exactly when these importers
// run and exactly when the row must exist. Inheriting that skip would have
// shipped a check blind for the whole window it watches, so that leg runs both
// functions under one pinned offseason clock and requires them to DISAGREE --
// the season check throws, the weekly check returns. Asserting only that the
// season check throws would pass just as well if it had inherited the skip and
// the clock happened to sit outside the offseason.

import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import {
  check_season_projections_floor,
  check_projections_index_floor
} from '#libs-server'

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
const SOURCE_ID = 901
const OTHER_SOURCE_ID = 902

// Inside the publish window and inside the offseason at once -- the window the
// weekly check is deliberately blind to.
const OFFSEASON_IN_WINDOW = '2026-08-15T12:00:00Z'
// Offseason and BEFORE sources publish. The one condition that legitimately
// silences this check.
const OFFSEASON_BEFORE_PUBLISH = '2026-03-15T12:00:00Z'

// `from` exists so a leg can TOP UP a seeded set without colliding on
// (source_id, pid, season_year) -- the below-floor / at-floor pair needs the
// second insert to add rows rather than replace them.
const seed_season_rows = async ({
  count,
  from = 0,
  source_id = SOURCE_ID,
  season_year = SEASON_YEAR
}) => {
  if (!count) return
  await knex('season_projections_index').insert(
    Array.from({ length: count }, (_, index) => ({
      pid: `TEST-SZNFLOOR-${String(from + index).padStart(6, '0')}`,
      source_id,
      season_year,
      passing_yards: 100
    }))
  )
}

const clear_season_rows = () =>
  knex('season_projections_index')
    .whereIn('source_id', [SOURCE_ID, OTHER_SOURCE_ID])
    .del()

describe('libs-server check_season_projections_floor', function () {
  this.timeout(20000)

  before(async () => {
    await clear_season_rows()
  })

  after(async () => {
    // Restore the SUITE's clock, not the wall clock. test/global.mjs pins the
    // whole run when LEAGUE_MOCK_DATE is set, and a bare MockDate.reset() here
    // would silently unpin every spec that runs after this file.
    if (process.env.LEAGUE_MOCK_DATE) MockDate.set(process.env.LEAGUE_MOCK_DATE)
    else MockDate.reset()
    await clear_season_rows()
  })

  beforeEach(async () => {
    MockDate.set(OFFSEASON_IN_WINDOW)
    await clear_season_rows()
  })

  it('throws a tagged shortfall below the floor, and is silent at it', async () => {
    await seed_season_rows({ count: 3 })
    const error = await expect_rejects(
      check_season_projections_floor({
        season_year: SEASON_YEAR,
        source_id: SOURCE_ID
      }),
      /row-count shortfall/
    )
    expect(error.row_count_shortfall).to.equal(true)
    expect(error.message).to.include(`source_id=${SOURCE_ID}`)
    expect(error.message).to.include(': 3 rows (floor=50)')

    await seed_season_rows({ count: 47, from: 3 })
    await expect_resolves(
      check_season_projections_floor({
        season_year: SEASON_YEAR,
        source_id: SOURCE_ID
      })
    )
  })

  it('honours an explicit floor in both directions', async () => {
    await seed_season_rows({ count: 5 })
    await expect_rejects(
      check_season_projections_floor({
        season_year: SEASON_YEAR,
        source_id: SOURCE_ID,
        floor: 6
      }),
      /floor=6/
    )
    await expect_resolves(
      check_season_projections_floor({
        season_year: SEASON_YEAR,
        source_id: SOURCE_ID,
        floor: 5
      })
    )
  })

  it('counts the sourceids arm as a set, not one source at a time', async () => {
    await seed_season_rows({ count: 3, source_id: SOURCE_ID })
    await seed_season_rows({ count: 3, source_id: OTHER_SOURCE_ID })
    const sourceids = [SOURCE_ID, OTHER_SOURCE_ID]

    await expect_rejects(
      check_season_projections_floor({
        season_year: SEASON_YEAR,
        sourceids,
        floor: 7
      }),
      /source_id=901,902/
    )
    await expect_resolves(
      check_season_projections_floor({
        season_year: SEASON_YEAR,
        sourceids,
        floor: 6
      })
    )
  })

  it('scopes its count to the asked season_year and source', async () => {
    // Rows that must NOT be counted: 30 for the right source in the WRONG
    // year, 30 for the wrong source in the right year.
    await seed_season_rows({ count: 30, season_year: OTHER_SEASON_YEAR })
    await seed_season_rows({ count: 30, source_id: OTHER_SOURCE_ID })

    // ANCHORED, and it has to be. `/0 rows/` unanchored is a substring of
    // "30 rows", so dropping the season_year predicate entirely left this leg
    // green -- measured, not theorised. The count is the whole assertion here,
    // so the pattern pins the count and nothing else.
    await expect_rejects(
      check_season_projections_floor({
        season_year: SEASON_YEAR,
        source_id: SOURCE_ID
      }),
      /: 0 rows \(floor=50\)/
    )
  })

  it('stays awake in the offseason where the weekly check sleeps', async () => {
    // One clock, two checks, opposite verdicts. The disagreement IS the
    // assertion -- a season check that had inherited the offseason skip would
    // pass a throw-only test whenever the clock sat outside the offseason.
    MockDate.set(OFFSEASON_IN_WINDOW)
    const { current_season } = await import('#constants')
    expect(current_season.is_offseason).to.equal(true)

    await seed_season_rows({ count: 1 })
    await expect_rejects(
      check_season_projections_floor({
        season_year: SEASON_YEAR,
        source_id: SOURCE_ID
      }),
      /row-count shortfall/
    )

    // The control: the weekly check, given a source with zero rows under the
    // same clock, returns silently. Both checks now gate on their OWN
    // publication window rather than on the offseason flag, and this clock
    // sits inside the season window and before the weekly one -- which is
    // exactly why the two disagree here. Do not re-read this silence as an
    // offseason short-circuit; the weekly check no longer has one, and
    // libs-server.check-projections-index-floor.spec.mjs pins a clock where it
    // fires with is_offseason still true.
    await expect_resolves(
      check_projections_index_floor({
        season_year: SEASON_YEAR,
        week: 1,
        source_id: SOURCE_ID,
        season_type: 'REG'
      })
    )
  })

  it('is silent before sources publish, and that window is the only skip', async () => {
    MockDate.set(OFFSEASON_BEFORE_PUBLISH)
    await expect_resolves(
      check_season_projections_floor({
        season_year: SEASON_YEAR,
        source_id: SOURCE_ID
      })
    )

    // Same empty table, same offseason, one month later inside the window --
    // and now it fires. Pairing the two is what proves the skip is bounded by
    // the publish window rather than by the offseason.
    MockDate.set(OFFSEASON_IN_WINDOW)
    await expect_rejects(
      check_season_projections_floor({
        season_year: SEASON_YEAR,
        source_id: SOURCE_ID
      }),
      /row-count shortfall/
    )
  })
})
