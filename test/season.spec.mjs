/* global describe, it, after */

import * as chai from 'chai'
import MockDate from 'mockdate'
import dayjs from 'dayjs'

import { constants } from '#libs-shared'
import season_dates from '#libs-shared/season-dates.mjs'

const { regular_season_start, end } = constants.season
const expect = chai.expect

describe('LIBS-SHARED Season', function () {
  after(() => {
    MockDate.reset()
  })

  it('isRegularSeason', function () {
    // 5 weeks before start of week 1
    MockDate.set(regular_season_start.subtract('1', 'month').toISOString())
    expect(constants.season.isRegularSeason).to.equal(false)

    // 1 minute before start of week 1
    MockDate.set(
      regular_season_start.add('7', 'day').subtract('1', 'minute').toISOString()
    )
    expect(constants.season.isRegularSeason).to.equal(false)

    // start of week 1
    MockDate.set(regular_season_start.add('1', 'week').toISOString())
    expect(constants.season.isRegularSeason).to.equal(true)

    // start of week 4
    MockDate.set(regular_season_start.add('4', 'week').toISOString())
    expect(constants.season.isRegularSeason).to.equal(true)

    // start of week 16
    MockDate.set(regular_season_start.add('16', 'week').toISOString())
    expect(constants.season.isRegularSeason).to.equal(true)

    // start of week 17
    MockDate.set(regular_season_start.add('17', 'week').toISOString())
    expect(constants.season.isRegularSeason).to.equal(true)

    // start of week 18
    MockDate.set(regular_season_start.add('18', 'week').toISOString())
    expect(constants.season.isRegularSeason).to.equal(false)
  })

  // test before regular season waiver period
  it('isWaiverPeriod', function () {
    // start of week 0
    MockDate.set(regular_season_start.toISOString())
    expect(constants.season.isWaiverPeriod).to.equal(true)

    // tuesday of week 1
    MockDate.set(regular_season_start.add('7', 'day').day(2).toISOString())
    expect(constants.season.isWaiverPeriod).to.equal(true)

    // wednesday of week 1 - noon
    MockDate.set(
      regular_season_start.add('7', 'day').day(3).hour(11).toISOString()
    )
    expect(constants.season.isWaiverPeriod).to.equal(true)

    // wednesday of week 1 - 3pm
    MockDate.set(
      regular_season_start.add('7', 'day').day(3).hour(15).toISOString()
    )
    expect(constants.season.isWaiverPeriod).to.equal(false)

    // tuesday of week 2
    MockDate.set(regular_season_start.add('14', 'day').day(2).toISOString())
    expect(constants.season.isWaiverPeriod).to.equal(true)

    // wednesday of week 2 - noon
    MockDate.set(
      regular_season_start.add('14', 'day').day(3).hour(11).toISOString()
    )
    expect(constants.season.isWaiverPeriod).to.equal(true)

    // wednesday of week 16 - 3pm
    MockDate.set(
      regular_season_start.add('112', 'day').day(3).hour(15).toISOString()
    )
    expect(constants.season.isWaiverPeriod).to.equal(false)

    // tuesday of week 16
    MockDate.set(regular_season_start.add('112', 'day').day(2).toISOString())
    expect(constants.season.isWaiverPeriod).to.equal(true)

    // wednesday of week 16 - noon
    MockDate.set(
      regular_season_start.add('112', 'day').day(3).hour(11).toISOString()
    )
    expect(constants.season.isWaiverPeriod).to.equal(true)

    // wednesday of week 16 - 3pm
    MockDate.set(
      regular_season_start.add('112', 'day').day(3).hour(15).toISOString()
    )
    expect(constants.season.isWaiverPeriod).to.equal(false)

    // tuesday of week 17
    MockDate.set(regular_season_start.add('112', 'day').day(2).toISOString())
    expect(constants.season.isWaiverPeriod).to.equal(true)

    // wednesday of week 17
    MockDate.set(regular_season_start.add('112', 'day').day(3).toISOString())
    expect(constants.season.isWaiverPeriod).to.equal(true)
  })

  it('week', function () {
    // start of week 0
    MockDate.set(regular_season_start.toISOString())
    expect(constants.season.week).to.equal(0)

    // end of week 0
    MockDate.set(
      regular_season_start
        .add('7', 'days')
        .subtract('1', 'minute')
        .toISOString()
    )
    expect(constants.season.week).to.equal(0)

    // start of week 1
    MockDate.set(regular_season_start.add('7', 'days').toISOString())
    expect(constants.season.week).to.equal(1)

    // end of week 1
    MockDate.set(
      regular_season_start
        .add('14', 'days')
        .subtract('1', 'minute')
        .toISOString()
    )
    expect(constants.season.week).to.equal(1)

    // start of week 16
    MockDate.set(regular_season_start.add('112', 'days').toISOString())
    expect(constants.season.week).to.equal(16)

    // end of week 16 - day light savings
    MockDate.set(
      regular_season_start
        .add('119', 'days')
        .subtract('61', 'minute')
        .toISOString()
    )
    expect(constants.season.week).to.equal(16)

    // start of week 17
    MockDate.set(regular_season_start.add('119', 'days').toISOString())
    expect(constants.season.week).to.equal(17)
  })

  it('year', function () {
    const current_year = dayjs.unix(season_dates.offseason).year()
    const next_year = dayjs.unix(season_dates.end).year()

    // start of week 0
    MockDate.set(regular_season_start.toISOString())
    expect(constants.season.year).to.equal(current_year)

    // start of year
    MockDate.set(regular_season_start.startOf('year').toISOString())
    expect(constants.season.year).to.equal(current_year)

    // last day of year
    MockDate.set(regular_season_start.endOf('year').toISOString())
    expect(constants.season.year).to.equal(current_year)

    // first day of new year
    MockDate.set(end.startOf('year').toISOString())
    expect(constants.season.year).to.equal(current_year)

    // before super bowl
    MockDate.set(end.subtract('1', 'day').toISOString())
    expect(constants.season.year).to.equal(current_year)

    // after super bowl
    MockDate.set(end.add('1', 'minute').toISOString())
    expect(constants.season.year).to.equal(next_year)
  })
})
