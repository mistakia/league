/* global describe, it, before, after, beforeEach, afterEach */

// get_player_projections floors its result set at a week, and the floor has to
// be stated in the same week vocabulary the rows are stored in.
//
// projections_index.week is a FANTASY week: 0 is the season-long row, 1..N are
// the game weeks. The floor used to default to current_season.nfl_seas_week,
// which is the NFL week and steps 0 -> 1 -> 2 -> 3 across the preseason. On
// 2026-08-04 at 04:00 UTC it left 0 for the first time, the floor amputated
// every week-0 row, process-projections wrote an all-null season consensus,
// every player fell out of the drawn pool in calculate-distributional-baselines
// and market_salary priced at $0 on 22 of 23 league formats.
//
// Nothing failed anywhere: the query stayed valid and kept returning rows, just
// never the season ones. So the only thing that can catch the next instance is
// a test that pins the clock inside the preseason, where the two vocabularies
// disagree. Asserting against today's clock proves nothing -- the two agree for
// most of the year, which is exactly why this shipped.

import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import { current_season } from '#constants'
import { get_player_projections } from '#libs-server'

const expect = chai.expect

const TEST_PID = 'TEST-WEEKFLOOR-000001'
const TEST_SOURCEID = 1

const seed_projection = async ({ week, season_type }) =>
  knex('projections_index')
    .insert({
      pid: TEST_PID,
      source_id: TEST_SOURCEID,
      user_id: 0,
      week,
      season_year: current_season.year,
      season_type,
      passing_yards: 100
    })
    .onConflict([
      'source_id',
      'pid',
      'user_id',
      'week',
      'season_year',
      'season_type'
    ])
    .merge()

const weeks_returned = async (params) => {
  const rows = await get_player_projections({ pids: [TEST_PID], ...params })
  return rows.map((row) => row.week).sort((a, b) => a - b)
}

describe('LIBS-SERVER get_player_projections week floor', function () {
  this.timeout(30 * 1000)

  afterEach(function () {
    MockDate.reset()
  })

  describe('during the preseason, where the NFL week has left 0', function () {
    // Three weeks before regular_season_start puts nfl_seas_week at 1 while
    // current_season.week is still 0 -- the window the defect lived in.
    const preseason_instant = () =>
      current_season.regular_season_start.subtract(20, 'days').toISOString()

    before(async function () {
      MockDate.set(preseason_instant())
      await seed_projection({ week: 0, season_type: 'REG' })
      await seed_projection({ week: 1, season_type: 'REG' })
      MockDate.reset()
    })

    after(async function () {
      await knex('projections_index').where({ pid: TEST_PID }).del()
    })

    beforeEach(function () {
      MockDate.set(preseason_instant())
    })

    it('has the two week vocabularies disagreeing, which is the premise', function () {
      expect(current_season.nfl_seas_week).to.be.greaterThan(0)
      expect(current_season.week).to.equal(0)
    })

    it('returns the season row', async function () {
      expect(await weeks_returned({ seas_type: 'REG' })).to.eql([0, 1])
    })

    it('still honors an explicit week floor', async function () {
      expect(await weeks_returned({ seas_type: 'REG', week: 1 })).to.eql([1])
    })
  })

  describe('during the postseason, where the rows ARE keyed by the NFL week', function () {
    // POST rows carry nfl_seas_week (1..4) rather than a fantasy week, so the
    // postseason floor legitimately comes from there. current_season.week keeps
    // counting past nflFinalWeek and would exclude every POST row.
    const postseason_instant = () =>
      current_season.regular_season_start
        .add(current_season.nflFinalWeek + 2, 'weeks')
        .toISOString()

    before(async function () {
      MockDate.set(postseason_instant())
      await seed_projection({
        week: current_season.nfl_seas_week,
        season_type: 'POST'
      })
      MockDate.reset()
    })

    after(async function () {
      await knex('projections_index').where({ pid: TEST_PID }).del()
    })

    beforeEach(function () {
      MockDate.set(postseason_instant())
    })

    it('returns the current playoff week', async function () {
      expect(await weeks_returned({ seas_type: 'POST' })).to.eql([
        current_season.nfl_seas_week
      ])
    })
  })
})
