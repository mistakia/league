/* global describe before after beforeEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'
import dayjs from 'dayjs'

import knex from '#db'
import { run_season_forecast } from '#scripts/process-projections.mjs'
import { current_season } from '#constants'
import season_dates from '#libs-shared/season-dates.mjs'
import league_fixture from '#db/fixtures/league.mjs'

process.env.NODE_ENV = 'test'

const expect = chai.expect

// simulate_season_forecast used to catch a failed week simulation and substitute
// a 50/50 outcome; b89f5ab53 removed that and made it throw, on the reasoning
// that no substitute result is acceptable -- a fabricated probability is
// persisted as a real forecast and nothing downstream can tell.
//
// run_season_forecast then undid the fix in its caller. Its catch logged to
// `debug` and `console.error` and returned normally, so under the hourly cron
// the failure was still silent: run() saw no throw, main() emitted
// pipeline_success, and that success CLOSES any open pipeline_failure. The fix
// was inert exactly where it mattered.
//
// What this spec pins is narrow and is the whole defect: run_season_forecast
// REJECTS rather than resolving. run() already wraps each league in its own
// try/catch that collects the failure as stage 'process_league', which feeds
// the one pipeline_failure signal main() emits -- so propagation out of this
// function is the only link that was broken.
//
// The exit code is deliberately not the surface under test. The cron line in
// server/crontab-main/league-imports.cron runs bare node with no job-wrapper,
// and main() ends in a bare process.exit() that returns 0 either way, so
// rethrowing to the exit code would surface nothing.

const LEAGUE_ID = 1
const DAY_SECONDS = 24 * 60 * 60

// Mid regular season, so run_season_forecast takes its simulate_season_forecast
// branch rather than a playoff one.
const REGULAR_SEASON_WEEK = 5

const pin_to_regular_season = () =>
  MockDate.set(
    dayjs
      .unix(
        season_dates.regular_season_start +
          (REGULAR_SEASON_WEEK * 7 + 1) * DAY_SECONDS
      )
      .toDate()
  )

describe('SCRIPTS process-projections forecast failure propagation', function () {
  this.timeout(60 * 1000)

  before(async function () {
    await knex.seed.run()
  })

  beforeEach(async function () {
    await league_fixture(knex)
    pin_to_regular_season()
  })

  after(function () {
    MockDate.reset()
  })

  it('propagates a failure raised inside the simulation', async function () {
    // Removing the season row makes load_simulation_context throw, which is a
    // failure raised BELOW run_season_forecast and inside the forecast call --
    // the same position as the failed week simulation the library now refuses
    // to paper over. The old catch swallowed every one of them alike.
    await knex('seasons')
      .where({ lid: LEAGUE_ID, season_year: current_season.year })
      .del()

    let error
    try {
      await run_season_forecast(LEAGUE_ID)
    } catch (err) {
      error = err
    }

    expect(
      error,
      'run_season_forecast resolved on a forecast that could not be produced'
    ).to.exist
  })

  it('propagates a missing league rather than returning quietly', async function () {
    // run() only calls this for hosted leagues, so a missing league row is a
    // broken invariant. The old code logged "League N not found, skipping
    // forecast" and returned, which is indistinguishable from a league that
    // legitimately had no forecast to run.
    const absent_league_id = 987654

    let error
    try {
      await run_season_forecast(absent_league_id)
    } catch (err) {
      error = err
    }

    expect(
      error,
      'run_season_forecast resolved for a league that does not exist'
    ).to.exist
    expect(error.message).to.include('cannot run forecast')
  })
})
