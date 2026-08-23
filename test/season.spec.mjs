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

    // Article XIV: "Regular Season" begins 12:00 AM EST on the first Tuesday
    // of Week 1 of the NFL Regular Season -- the Tuesday immediately
    // preceding the (always-Thursday) opener, not `regular_season_start`
    // (which anchors preseason waiver/roster mechanics two weeks earlier).
    expect(practice_squad_protection_start.day()).to.equal(2)
    expect(practice_squad_protection_start.isBefore(openingDay)).to.equal(true)
    expect(openingDay.diff(practice_squad_protection_start, 'day')).to.equal(2)
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
