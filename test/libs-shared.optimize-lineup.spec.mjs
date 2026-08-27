/* global describe it after */
import * as chai from 'chai'
import MockDate from 'mockdate'

import optimizeLineup from '#libs-shared/optimize-lineup.mjs'

const expect = chai.expect

// use_baseline_when_missing inserts one phantom player per fantasy position so
// the LP can always fill a starting slot even when the roster has nobody
// eligible. The phantom is supposed to score at replacement level (baseline
// points), not zero -- scoring it at zero understates the projected total for
// every team missing a starter, and that total is persisted as
// league_team_lineups.baseline_total and consumed directly as each team's
// projected matchup score.
//
// A league with only a single required starting slot (QB) and an empty
// roster forces the LP to fill that slot entirely from the phantom, so the
// phantom's value is exactly the returned baseline_total.
const empty_starter_league = {
  starter_slots_quarterback: 1,
  starter_slots_running_back: 0,
  starter_slots_wide_receiver: 0,
  starter_slots_tight_end: 0,
  starter_slots_kicker: 0,
  starter_slots_defense_special_teams: 0
}

describe('LIBS-SHARED optimizeLineup', function () {
  after(function () {
    MockDate.reset()
  })

  it('scores the phantom starter at the supplied baseline points, not zero', function () {
    // Pin the clock inside the regular season so current_season.week and
    // final_week both resolve to a small, deterministic range.
    MockDate.set('2026-10-01T12:00:00Z')

    const baseline_points = {}
    for (let week = 0; week <= 25; week++) {
      baseline_points[week] = { QB: 22 }
    }

    const result = optimizeLineup({
      players: [],
      league: empty_starter_league,
      use_baseline_when_missing: true,
      baseline_points
    })

    const weeks = Object.keys(result)
    expect(weeks.length).to.be.greaterThan(0)
    for (const week of weeks) {
      expect(result[week].baseline_total).to.equal(22)
    }
  })

  it('falls back to zero when no baseline points are supplied for the week', function () {
    MockDate.set('2026-10-01T12:00:00Z')

    const result = optimizeLineup({
      players: [],
      league: empty_starter_league,
      use_baseline_when_missing: true
    })

    for (const week of Object.keys(result)) {
      expect(result[week].baseline_total).to.equal(0)
    }
  })
})
