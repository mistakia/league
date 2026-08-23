/* global describe, it, after */

import * as chai from 'chai'
import MockDate from 'mockdate'
import dayjs from 'dayjs'

import { current_season } from '#constants'
import season_dates from '#libs-shared/season-dates.mjs'

const { regular_season_start, end } = current_season
const expect = chai.expect

describe('LIBS-SHARED Season', function () {
  after(() => {
    MockDate.reset()
  })

  it('isRegularSeason', function () {
    // 5 weeks before start of week 1
    MockDate.set(regular_season_start.subtract('1', 'month').toISOString())
    expect(current_season.isRegularSeason).to.equal(false)

    // 1 minute before start of week 1
    MockDate.set(
      regular_season_start.add('7', 'day').subtract('1', 'minute').toISOString()
    )
    expect(current_season.isRegularSeason).to.equal(false)

    // start of week 1
    MockDate.set(regular_season_start.add('1', 'week').toISOString())
    expect(current_season.isRegularSeason).to.equal(true)

    // start of week 4
    MockDate.set(regular_season_start.add('4', 'week').toISOString())
    expect(current_season.isRegularSeason).to.equal(true)

    // start of week 16
    MockDate.set(regular_season_start.add('16', 'week').toISOString())
    expect(current_season.isRegularSeason).to.equal(true)

    // start of week 17
    MockDate.set(regular_season_start.add('17', 'week').toISOString())
    expect(current_season.isRegularSeason).to.equal(true)

    // start of week 18
    MockDate.set(regular_season_start.add('18', 'week').toISOString())
    expect(current_season.isRegularSeason).to.equal(false)
  })

  // test before regular season waiver period
  it('isWaiverPeriod', function () {
    // start of week 0
    MockDate.set(regular_season_start.toISOString())
    expect(current_season.isWaiverPeriod).to.equal(true)

    // tuesday of week 1
    MockDate.set(regular_season_start.add('7', 'day').day(2).toISOString())
    expect(current_season.isWaiverPeriod).to.equal(true)

    // wednesday of week 1 - noon
    MockDate.set(
      regular_season_start.add('7', 'day').day(3).hour(11).toISOString()
    )
    expect(current_season.isWaiverPeriod).to.equal(true)

    // wednesday of week 1 - 3pm
    MockDate.set(
      regular_season_start.add('7', 'day').day(3).hour(15).toISOString()
    )
    expect(current_season.isWaiverPeriod).to.equal(false)

    // tuesday of week 2
    MockDate.set(regular_season_start.add('14', 'day').day(2).toISOString())
    expect(current_season.isWaiverPeriod).to.equal(true)

    // wednesday of week 2 - noon
    MockDate.set(
      regular_season_start.add('14', 'day').day(3).hour(11).toISOString()
    )
    expect(current_season.isWaiverPeriod).to.equal(true)

    // wednesday of week 16 - 3pm
    MockDate.set(
      regular_season_start.add('112', 'day').day(3).hour(15).toISOString()
    )
    expect(current_season.isWaiverPeriod).to.equal(false)

    // tuesday of week 16
    MockDate.set(regular_season_start.add('112', 'day').day(2).toISOString())
    expect(current_season.isWaiverPeriod).to.equal(true)

    // wednesday of week 16 - noon
    MockDate.set(
      regular_season_start.add('112', 'day').day(3).hour(11).toISOString()
    )
    expect(current_season.isWaiverPeriod).to.equal(true)

    // wednesday of week 16 - 3pm
    MockDate.set(
      regular_season_start.add('112', 'day').day(3).hour(15).toISOString()
    )
    expect(current_season.isWaiverPeriod).to.equal(false)

    // tuesday of week 17
    MockDate.set(regular_season_start.add('112', 'day').day(2).toISOString())
    expect(current_season.isWaiverPeriod).to.equal(true)

    // wednesday of week 17
    MockDate.set(regular_season_start.add('112', 'day').day(3).toISOString())
    expect(current_season.isWaiverPeriod).to.equal(true)
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

    // end of week 16 - day light savings
    MockDate.set(
      regular_season_start
        .add('119', 'days')
        .subtract('61', 'minute')
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
  // deliberately anchor on openingDay instead, because the opener's date is
  // independently verifiable against the NFL schedule while the anchor is not.
  it('regular_season_start places the opener in REG week 1', function () {
    const { openingDay, regular_season_start } = current_season

    // Tuesday, nine days before the always-Thursday opener.
    expect(regular_season_start.day()).to.equal(2)
    expect(openingDay.day()).to.equal(4)
    expect(openingDay.diff(regular_season_start, 'day')).to.equal(9)

    // The opener and the Sunday that follows it are both REG week 1, and the
    // Thursday a week earlier is still preseason.
    expect(current_season.calculate_week(openingDay)).to.deep.equal({
      seas_type: 'REG',
      week: 1
    })
    expect(
      current_season.calculate_week(openingDay.add('3', 'day'))
    ).to.deep.equal({ seas_type: 'REG', week: 1 })
    expect(
      current_season.calculate_week(openingDay.subtract('7', 'day')).seas_type
    ).to.equal('PRE')
  })

  it('practice_squad_protection_start', function () {
    const { openingDay, practice_squad_protection_start } = current_season

    // The constitution's definitions section: "Regular Season" begins 12:00 AM
    // EST on the first Tuesday of Week 1 of the NFL Regular Season -- the
    // Tuesday immediately preceding the (always-Thursday) opener, not
    // `regular_season_start`, which anchors preseason waiver/roster mechanics
    // ONE week earlier (nine days before the opener, per the assertion above).
    expect(practice_squad_protection_start.day()).to.equal(2)
    expect(practice_squad_protection_start.isBefore(openingDay)).to.equal(true)
    expect(openingDay.diff(practice_squad_protection_start, 'day')).to.equal(2)
  })

  // This is the assertion that lets every caller ask `isRegularSeason` and get
  // the CONSTITUTIONAL answer, and it is why `api/routes/teams/protect.mjs`
  // needs no second Article XIV check. Both sides are pinned to `openingDay`,
  // whose date is checkable against the NFL schedule; expressing either one
  // relative to `regular_season_start` would make the test vacuous with
  // respect to the anchor, which is exactly how the 2026 miscount survived.
  it('isRegularSeason turns true at the constitutional Regular Season start', function () {
    const { openingDay } = current_season
    const constitutional_start = openingDay.subtract('2', 'day')

    // the getter agrees with the openingDay-derived boundary
    expect(current_season.practice_squad_protection_start.valueOf()).to.equal(
      constitutional_start.valueOf()
    )

    // one minute before: still the offseason, for the fantasy season and for
    // Article XIV alike
    MockDate.set(constitutional_start.subtract('1', 'minute').toISOString())
    expect(current_season.isRegularSeason).to.equal(false)
    expect(
      current_season.now.isBefore(
        current_season.practice_squad_protection_start
      )
    ).to.equal(true)

    // at the boundary: both flip together, so no window exists in which the
    // regular season has started but protection has not opened
    MockDate.set(constitutional_start.toISOString())
    expect(current_season.isRegularSeason).to.equal(true)
    expect(
      current_season.now.isBefore(
        current_season.practice_squad_protection_start
      )
    ).to.equal(false)
  })

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
