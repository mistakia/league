/* global describe, it, after */

import * as chai from 'chai'
import MockDate from 'mockdate'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

import * as constants_barrel from '#constants'
import * as season_constants from '#constants/season-constants.mjs'
import { current_season } from '#constants'
import season_dates from '#libs-shared/season-dates.mjs'

dayjs.extend(utc)
dayjs.extend(timezone)

const { regular_season_start, end } = current_season
const expect = chai.expect
const league_timezone = 'America/New_York'

describe('LIBS-SHARED Season', function () {
  after(() => {
    MockDate.reset()
  })

  it('is_regular_season', function () {
    // 5 weeks before start of week 1
    MockDate.set(regular_season_start.subtract('1', 'month').toISOString())
    expect(current_season.is_regular_season).to.equal(false)

    // 1 minute before start of week 1
    MockDate.set(
      regular_season_start.add('7', 'day').subtract('1', 'minute').toISOString()
    )
    expect(current_season.is_regular_season).to.equal(false)

    // start of week 1
    MockDate.set(regular_season_start.add('1', 'week').toISOString())
    expect(current_season.is_regular_season).to.equal(true)

    // start of week 4
    MockDate.set(regular_season_start.add('4', 'week').toISOString())
    expect(current_season.is_regular_season).to.equal(true)

    // start of week 16
    MockDate.set(regular_season_start.add('16', 'week').toISOString())
    expect(current_season.is_regular_season).to.equal(true)

    // start of week 17
    MockDate.set(regular_season_start.add('17', 'week').toISOString())
    expect(current_season.is_regular_season).to.equal(true)

    // start of week 18
    MockDate.set(regular_season_start.add('18', 'week').toISOString())
    expect(current_season.is_regular_season).to.equal(false)
  })

  // test before regular season waiver period
  it('is_waiver_period', function () {
    // start of week 0
    MockDate.set(regular_season_start.toISOString())
    expect(current_season.is_waiver_period).to.equal(true)

    // tuesday of week 1
    MockDate.set(regular_season_start.add('7', 'day').day(2).toISOString())
    expect(current_season.is_waiver_period).to.equal(true)

    // wednesday of week 1 - noon
    MockDate.set(
      regular_season_start.add('7', 'day').day(3).hour(11).toISOString()
    )
    expect(current_season.is_waiver_period).to.equal(true)

    // wednesday of week 1 - 3pm
    MockDate.set(
      regular_season_start.add('7', 'day').day(3).hour(15).toISOString()
    )
    expect(current_season.is_waiver_period).to.equal(false)

    // tuesday of week 2
    MockDate.set(regular_season_start.add('14', 'day').day(2).toISOString())
    expect(current_season.is_waiver_period).to.equal(true)

    // wednesday of week 2 - noon
    MockDate.set(
      regular_season_start.add('14', 'day').day(3).hour(11).toISOString()
    )
    expect(current_season.is_waiver_period).to.equal(true)

    // wednesday of week 16 - 3pm
    MockDate.set(
      regular_season_start.add('112', 'day').day(3).hour(15).toISOString()
    )
    expect(current_season.is_waiver_period).to.equal(false)

    // tuesday of week 16
    MockDate.set(regular_season_start.add('112', 'day').day(2).toISOString())
    expect(current_season.is_waiver_period).to.equal(true)

    // wednesday of week 16 - noon
    MockDate.set(
      regular_season_start.add('112', 'day').day(3).hour(11).toISOString()
    )
    expect(current_season.is_waiver_period).to.equal(true)

    // wednesday of week 16 - 3pm
    MockDate.set(
      regular_season_start.add('112', 'day').day(3).hour(15).toISOString()
    )
    expect(current_season.is_waiver_period).to.equal(false)

    // tuesday of week 17
    MockDate.set(regular_season_start.add('112', 'day').day(2).toISOString())
    expect(current_season.is_waiver_period).to.equal(true)

    // wednesday of week 17
    MockDate.set(regular_season_start.add('112', 'day').day(3).toISOString())
    expect(current_season.is_waiver_period).to.equal(true)
  })

  it('week', function () {
    // start of week 0
    MockDate.set(regular_season_start.toISOString())
    expect(current_season.week).to.equal(0)

    // end of week 0
    MockDate.set(
      regular_season_start
        .add('7', 'days')
        .subtract('1', 'minute')
        .toISOString()
    )
    expect(current_season.week).to.equal(0)

    // start of week 1
    MockDate.set(regular_season_start.add('7', 'days').toISOString())
    expect(current_season.week).to.equal(1)

    // end of week 1
    MockDate.set(
      regular_season_start
        .add('14', 'days')
        .subtract('1', 'minute')
        .toISOString()
    )
    expect(current_season.week).to.equal(1)

    // start of week 16
    MockDate.set(regular_season_start.add('112', 'days').toISOString())
    expect(current_season.week).to.equal(16)

    // last minute of week 16. The 61-minute offset this used to carry, labelled
    // "day light savings", was compensating for nothing -- week 17 begins in
    // December, nowhere near a transition. The real DST boundary is week 9, and
    // it has its own assertion below.
    MockDate.set(
      regular_season_start
        .add('119', 'days')
        .subtract('1', 'minute')
        .toISOString()
    )
    expect(current_season.week).to.equal(16)

    // start of week 17
    MockDate.set(regular_season_start.add('119', 'days').toISOString())
    expect(current_season.week).to.equal(17)
  })

  // Every other assertion in this file is expressed RELATIVE to
  // regular_season_start, which makes them all vacuous with respect to the
  // anchor itself -- they stayed green through a 2026 value set a full week
  // early, which shifted every regular-season game to week N+1 and silently
  // unlinked all 4,632 2026 rows in prop_markets_index. These assertions
  // deliberately anchor on opening_day instead, because the opener's date is
  // independently verifiable against the NFL schedule while the anchor is not.
  it('regular_season_start places the opener in REG week 1', function () {
    const { opening_day, regular_season_start } = current_season

    // Tuesday, nine days before the always-Thursday opener.
    expect(regular_season_start.day()).to.equal(2)
    expect(opening_day.day()).to.equal(4)
    expect(opening_day.diff(regular_season_start, 'day')).to.equal(9)

    // The opener and the Sunday that follows it are both REG week 1, and the
    // Thursday a week earlier is still preseason.
    expect(current_season.calculate_week(opening_day)).to.deep.equal({
      seas_type: 'REG',
      week: 1
    })
    expect(
      current_season.calculate_week(opening_day.add('3', 'day'))
    ).to.deep.equal({ seas_type: 'REG', week: 1 })
    expect(
      current_season.calculate_week(opening_day.subtract('7', 'day')).seas_type
    ).to.equal('PRE')
  })

  // The offsets used to be four hardcoded utcOffset(-5)/utcOffset(-4) literals,
  // each correct only while its date stayed on one side of a DST boundary, with
  // nothing anywhere enforcing that. They are now derived from the zone; this is
  // what enforces it. Reads the anchors' OWN rendering, which is what every
  // .day() / .hour() / .startOf('day') on them sees -- the offset never moves
  // the instant, so an assertion on the instant cannot catch this.
  it('season anchors render as Eastern local midnight', function () {
    const anchors = {
      offseason: current_season.offseason,
      regular_season_start: current_season.regular_season_start,
      end: current_season.end,
      opening_day: current_season.opening_day
    }

    for (const [name, anchor] of Object.entries(anchors)) {
      expect(anchor.format('HH:mm:ss'), name).to.equal('00:00:00')
      expect(anchor.utcOffset(), name).to.equal(
        dayjs.unix(anchor.unix()).tz(league_timezone).utcOffset()
      )
    }
  })

  // The fantasy week flips at local Tuesday 00:00 ET on both sides of the
  // November fall-back.
  //
  // This is the assertion a `.tz()` zone object fails: dayjs carries the
  // construction-time offset through .add(), so every boundary past the
  // transition slides to Monday 23:00. `week_end` is built with .add() and
  // feeds the event windows in libs-server/gambet.mjs and
  // import-caesars-odds-v4.mjs, so the drift would misfile an hour of betting
  // events every week from November on.
  it('week boundaries stay at Tuesday 00:00 ET across the fall-back', function () {
    // week 9 of a September-anchored season falls just after the fall-back;
    // 1 and 17 bracket it on either side of the transition
    for (const week of [1, 9, 17, 20]) {
      const local = dayjs
        .unix(regular_season_start.add(week, 'week').unix())
        .tz(league_timezone)
      expect(local.format('HH:mm'), `week ${week}`).to.equal('00:00')
      expect(local.day(), `week ${week} weekday`).to.equal(2)
    }

    // and the counter turns over there, not an hour early
    const week_9 = regular_season_start.add(9, 'week')
    MockDate.set(week_9.subtract('1', 'minute').toISOString())
    expect(current_season.week).to.equal(8)
    MockDate.set(week_9.toISOString())
    expect(current_season.week).to.equal(9)
  })

  it('practice_squad_protection_start', function () {
    const { opening_day, practice_squad_protection_start } = current_season

    // The constitution's definitions section: "Regular Season" begins 12:00 AM
    // EST on the first Tuesday of Week 1 of the NFL Regular Season -- the
    // Tuesday immediately preceding the (always-Thursday) opener, not
    // `regular_season_start`, which anchors preseason waiver/roster mechanics
    // ONE week earlier (nine days before the opener, per the assertion above).
    expect(practice_squad_protection_start.day()).to.equal(2)
    expect(practice_squad_protection_start.isBefore(opening_day)).to.equal(true)
    expect(opening_day.diff(practice_squad_protection_start, 'day')).to.equal(2)
  })

  // This is the assertion that lets every caller ask `is_regular_season` and get
  // the CONSTITUTIONAL answer, and it is why `api/routes/teams/protect.mjs`
  // needs no second Article XIV check. Both sides are pinned to `opening_day`,
  // whose date is checkable against the NFL schedule; expressing either one
  // relative to `regular_season_start` would make the test vacuous with
  // respect to the anchor, which is exactly how the 2026 miscount survived.
  it('is_regular_season turns true at the constitutional Regular Season start', function () {
    const { opening_day } = current_season
    const constitutional_start = opening_day.subtract('2', 'day')

    // the getter agrees with the opening_day-derived boundary
    expect(current_season.practice_squad_protection_start.valueOf()).to.equal(
      constitutional_start.valueOf()
    )

    // one minute before: still the offseason, for the fantasy season and for
    // Article XIV alike
    MockDate.set(constitutional_start.subtract('1', 'minute').toISOString())
    expect(current_season.is_regular_season).to.equal(false)
    expect(
      current_season.now.isBefore(
        current_season.practice_squad_protection_start
      )
    ).to.equal(true)

    // at the boundary: both flip together, so no window exists in which the
    // regular season has started but protection has not opened
    MockDate.set(constitutional_start.toISOString())
    expect(current_season.is_regular_season).to.equal(true)
    expect(
      current_season.now.isBefore(
        current_season.practice_squad_protection_start
      )
    ).to.equal(false)
  })

  // `#constants` used to export current_week, current_year,
  // current_fantasy_season_week, is_offseason and is_regular_season as
  // module-level consts. They read like aliases of the getters and were not --
  // each held the getter's value at IMPORT time and never moved again, so in
  // the long-running API `is_offseason` stayed frozen at whatever it was when
  // the process booted. Measured at the deletion: with the clock moved to
  // 2026-11-17, the getters reported `is_regular_season=true, week=11` while the
  // frozen exports still read `is_regular_season=false, current_week=0`.
  //
  // Both halves are asserted, because either alone is satisfiable the wrong
  // way: absence without liveness passes on a module that exports nothing
  // useful, and liveness without absence passes while a frozen copy sits
  // beside the getter waiting to be imported.
  //
  // And BOTH modules are checked. Asserting only the `#constants` barrel is
  // vacuous against the reintroduction that actually matters: season-constants
  // is the file a snapshot gets added back to, and its own header tells
  // callers to import it directly for tree shaking, so a frozen export could
  // reappear there and be imported by name while the barrel stayed clean.
  // Verified by re-adding `is_offseason` to season-constants -- the
  // barrel-only assertion stayed green.
  it('exposes no clock-dependent value outside a getter', function () {
    for (const name of [
      'current_week',
      'current_year',
      'current_fantasy_season_week',
      'is_offseason',
      'is_regular_season'
    ]) {
      expect(constants_barrel[name], `barrel ${name}`).to.equal(undefined)
      expect(season_constants[name], `season-constants ${name}`).to.equal(
        undefined
      )
    }

    MockDate.set(regular_season_start.subtract('1', 'month').toISOString())
    expect(current_season.is_regular_season).to.equal(false)
    expect(current_season.week).to.equal(0)

    MockDate.set(regular_season_start.add('11', 'week').toISOString())
    expect(current_season.is_regular_season).to.equal(true)
    expect(current_season.week).to.equal(11)
  })

  // `end` is the one anchor with no independently observable date on it -- it
  // is not a game day, it is the midnight after one -- so it was set by hand
  // from a header comment naming the wrong Super Bowl and landed five days
  // early. The `year` test below could not report that: it took both its clock
  // and its expectation from `end` itself, so it was green for any value.
  //
  // This derives the Super Bowl from `regular_season_start` the same way
  // `calculate_week` does, which makes the assertion answerable against the
  // NFL schedule rather than against the constant under test.
  it('end is the midnight after Super Bowl Sunday', function () {
    const { regular_season_start, end, nfl_final_week, super_bowl_bye_weeks } =
      current_season

    const super_bowl_week = regular_season_start.add(
      nfl_final_week + super_bowl_bye_weeks + 4,
      'week'
    )
    expect(current_season.calculate_week(super_bowl_week)).to.deep.equal({
      seas_type: 'POST',
      week: 4
    })

    // weeks begin Tuesday, so the game is that week's Sunday
    const super_bowl_sunday = super_bowl_week.add(5, 'day')
    expect(super_bowl_sunday.day()).to.equal(0)
    expect(end.unix()).to.equal(super_bowl_sunday.add(1, 'day').unix())

    // the season contains its own Super Bowl -- kickoff is hours before `end`,
    // never after it
    expect(super_bowl_sunday.isBefore(end)).to.equal(true)
    expect(end.diff(super_bowl_sunday, 'hour')).to.equal(24)

    // `offseason` is the same instant for the PRIOR season's Super Bowl, and
    // the day after a Sunday game is always a Monday. The two fields drifted
    // apart once already, with `offseason` at the start of game day and `end`
    // at the start of Super Bowl week.
    expect(current_season.offseason.day()).to.equal(1)
    expect(end.day()).to.equal(1)
  })

  // The boundaries below are deliberately RELATIVE to `end`: the assertion
  // above pins `end` to the schedule, so this one is free to test only what
  // the getter does on either side of it.
  it('year', function () {
    const current_year = dayjs.unix(season_dates.offseason).year()
    const next_year = dayjs.unix(season_dates.end).year()

    // start of week 0
    MockDate.set(regular_season_start.toISOString())
    expect(current_season.year).to.equal(current_year)

    // start of year
    MockDate.set(regular_season_start.startOf('year').toISOString())
    expect(current_season.year).to.equal(current_year)

    // last day of year
    MockDate.set(regular_season_start.endOf('year').toISOString())
    expect(current_season.year).to.equal(current_year)

    // first day of new year
    MockDate.set(end.startOf('year').toISOString())
    expect(current_season.year).to.equal(current_year)

    // before super bowl
    MockDate.set(end.subtract('1', 'day').toISOString())
    expect(current_season.year).to.equal(current_year)

    // after super bowl
    MockDate.set(end.add('1', 'minute').toISOString())
    expect(current_season.year).to.equal(next_year)
  })
})
