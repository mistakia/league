/* global describe before beforeEach it */
import * as chai from 'chai'

import knex from '#db'
import { simulation } from '#libs-server'
import { current_season } from '#constants'
import league_fixture from '#db/fixtures/league.mjs'

process.env.NODE_ENV = 'test'

const expect = chai.expect

// `load_actual_playoff_points` decides which playoff weeks the forecast treats
// as already played. Getting that wrong does not throw -- it hands the forecast
// a week of results it should have simulated, and the forecast reports a
// champion from them.
//
// The two write paths in scripts/process-playoffs.mjs disagree about what an
// unplayed week looks like, which is what makes the naive test wrong. SEEDING
// inserts a row with no `points` key at all, so it lands NULL. SCORING sets
// `item.points = 0` and then accumulates per starter, logging `WARN: gamelog
// not found` and continuing on every miss -- so a week whose gamelogs are not
// loaded yet is written as a real 0, not as NULL. A NULL test alone reads that
// week as complete.
//
// A per-team `points > 0` test is not the fix either: it drops a team that
// genuinely scored zero out of a week that WAS played, reporting a partial week,
// which is its own wrong answer. The oracle is per week -- a week has results if
// some team in it scored above zero, and then every team's points count,
// including a real 0.
const LEAGUE_ID = 1
const PLAYOFF_WEEK = 15
const TEAM_IDS = [1, 2, 3, 4]

const seed_playoff_rows = async (rows) =>
  knex('playoffs').insert(
    rows.map(({ tid, points, points_manual = null }) => ({
      playoff_week_number: 2,
      tid,
      lid: LEAGUE_ID,
      season_year: current_season.year,
      week: PLAYOFF_WEEK,
      points,
      points_manual
    }))
  )

const load = () =>
  simulation.load_actual_playoff_points({
    league_id: LEAGUE_ID,
    team_ids: TEAM_IDS,
    weeks: [PLAYOFF_WEEK],
    year: current_season.year
  })

describe('LIBS-SERVER simulation playoff week completeness', function () {
  this.timeout(60 * 1000)

  before(async function () {
    await knex.seed.run()
  })

  beforeEach(async function () {
    await league_fixture(knex)
    await knex('playoffs').del()
  })

  it('does not report an all-zero week as having results', async function () {
    // What process-playoffs writes when it scores a week before the gamelogs
    // are loaded: every starter misses, every team totals 0, every row is
    // non-null.
    await seed_playoff_rows(TEAM_IDS.map((tid) => ({ tid, points: 0 })))

    const { actual_points, weeks_with_results } = await load()

    expect(weeks_with_results).to.eql([])
    expect(actual_points.has(PLAYOFF_WEEK)).to.equal(false)
  })

  it('reports a played week whole, including a team that really scored zero', async function () {
    await seed_playoff_rows([
      { tid: 1, points: 120 },
      { tid: 2, points: 98 },
      { tid: 3, points: 0 },
      { tid: 4, points: 87 }
    ])

    const { actual_points, weeks_with_results } = await load()

    expect(weeks_with_results).to.eql([PLAYOFF_WEEK])

    const week_points = actual_points.get(PLAYOFF_WEEK)
    // All four teams, not the three that scored above zero -- the zero is a
    // real result here and dropping it reports a partial week.
    expect([...week_points.keys()].sort()).to.eql(TEAM_IDS)
    expect(week_points.get(3)).to.equal(0)
    expect(week_points.get(1)).to.equal(120)
  })

  it('does not report a seeded-but-unscored week as having results', async function () {
    await seed_playoff_rows(TEAM_IDS.map((tid) => ({ tid, points: null })))

    const { actual_points, weeks_with_results } = await load()

    expect(weeks_with_results).to.eql([])
    expect(actual_points.has(PLAYOFF_WEEK)).to.equal(false)
  })

  it('qualifies a week on the manual correction when the computed score is zero', async function () {
    // points_manual is the recorded post-season result and overrides the
    // computed score, so a week only the manual column has scored is played.
    await seed_playoff_rows([
      { tid: 1, points: 0, points_manual: 110 },
      { tid: 2, points: 0, points_manual: 95 },
      { tid: 3, points: 0, points_manual: 88 },
      { tid: 4, points: 0, points_manual: 76 }
    ])

    const { actual_points, weeks_with_results } = await load()

    expect(weeks_with_results).to.eql([PLAYOFF_WEEK])
    expect(actual_points.get(PLAYOFF_WEEK).get(1)).to.equal(110)
  })
})
