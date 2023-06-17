/* global describe, it, after */

import chai from 'chai'
import MockDate from 'mockdate'

import { constants } from '#libs-shared'

const { start, end } = constants.season
const expect = chai.expect

describe('LIBS-SHARED Season', function () {
  after(() => {
    MockDate.reset()
  })

  it('isRegularSeason', function () {
    // 5 weeks before start of week 1
    MockDate.set(start.subtract('1', 'month').toISOString())
    expect(constants.season.isRegularSeason).to.equal(false)

    // 1 minute before start of week 1
    MockDate.set(start.add('7', 'day').subtract('1', 'minute').toISOString())
    expect(constants.season.isRegularSeason).to.equal(false)

    // start of week 1
    MockDate.set(start.add('1', 'week').toISOString())
    expect(constants.season.isRegularSeason).to.equal(true)

    // start of week 4
    MockDate.set(start.add('4', 'week').toISOString())
    expect(constants.season.isRegularSeason).to.equal(true)

    // start of week 16
    MockDate.set(start.add('16', 'week').toISOString())
    expect(constants.season.isRegularSeason).to.equal(true)

    // start of week 17
    MockDate.set(start.add('17', 'week').toISOString())
    expect(constants.season.isRegularSeason).to.equal(true)

    // start of week 18
    MockDate.set(start.add('18', 'week').toISOString())
    expect(constants.season.isRegularSeason).to.equal(false)
  })

  // test before regular season waiver period
  it('isWaiverPeriod', function () {
    // start of week 0
    MockDate.set(start.toISOString())
    expect(constants.season.isWaiverPeriod).to.equal(true)

    // tuesday of week 1
    MockDate.set(start.add('7', 'day').day(2).toISOString())
    expect(constants.season.isWaiverPeriod).to.equal(true)

    // wednesday of week 1 - noon
    MockDate.set(start.add('7', 'day').day(3).hour(11).toISOString())
    expect(constants.season.isWaiverPeriod).to.equal(true)

    // wednesday of week 1 - 3pm
    MockDate.set(start.add('7', 'day').day(3).hour(15).toISOString())
    expect(constants.season.isWaiverPeriod).to.equal(false)

    // tuesday of week 2
    MockDate.set(start.add('14', 'day').day(2).toISOString())
    expect(constants.season.isWaiverPeriod).to.equal(true)

    // wednesday of week 2 - noon
    MockDate.set(start.add('14', 'day').day(3).hour(11).toISOString())
    expect(constants.season.isWaiverPeriod).to.equal(true)

    // wednesday of week 16 - 3pm
    MockDate.set(start.add('112', 'day').day(3).hour(15).toISOString())
    expect(constants.season.isWaiverPeriod).to.equal(false)

    // tuesday of week 16
    MockDate.set(start.add('112', 'day').day(2).toISOString())
    expect(constants.season.isWaiverPeriod).to.equal(true)

    // wednesday of week 16 - noon
    MockDate.set(start.add('112', 'day').day(3).hour(11).toISOString())
    expect(constants.season.isWaiverPeriod).to.equal(true)

    // wednesday of week 16 - 3pm
    MockDate.set(start.add('112', 'day').day(3).hour(15).toISOString())
    expect(constants.season.isWaiverPeriod).to.equal(false)

    // tuesday of week 17
    MockDate.set(start.add('112', 'day').day(2).toISOString())
    expect(constants.season.isWaiverPeriod).to.equal(true)

    // wednesday of week 17
    MockDate.set(start.add('112', 'day').day(3).toISOString())
    expect(constants.season.isWaiverPeriod).to.equal(true)
  })

  it('week', function () {
    // start of week 0
    MockDate.set(start.toISOString())
    expect(constants.season.week).to.equal(0)

    // end of week 0
    MockDate.set(start.add('7', 'days').subtract('1', 'minute').toISOString())
    expect(constants.season.week).to.equal(0)

    // start of week 1
    MockDate.set(start.add('7', 'days').toISOString())
    expect(constants.season.week).to.equal(1)

    // end of week 1
    MockDate.set(start.add('14', 'days').subtract('1', 'minute').toISOString())
    expect(constants.season.week).to.equal(1)

    // start of week 16
    MockDate.set(start.add('112', 'days').toISOString())
    expect(constants.season.week).to.equal(16)

    // end of week 16 - day light savings
    MockDate.set(
      start.add('119', 'days').subtract('61', 'minute').toISOString()
    )
    expect(constants.season.week).to.equal(16)

    // start of week 17
    MockDate.set(start.add('119', 'days').toISOString())
    expect(constants.season.week).to.equal(17)
  })

  it('year', function () {
    // start of week 0
    MockDate.set(start.toISOString())
    expect(constants.season.year).to.equal(2023)

    // start of year
    MockDate.set(start.startOf('year').toISOString())
    expect(constants.season.year).to.equal(2023)

    // last day of year
    MockDate.set(start.endOf('year').toISOString())
    expect(constants.season.year).to.equal(2023)

    // first day of new year
    MockDate.set(end.startOf('year').toISOString())
    expect(constants.season.year).to.equal(2023)

    // before super bowl
    MockDate.set(end.subtract('1', 'day').toISOString())
    expect(constants.season.year).to.equal(2023)

    // after super bowl
    MockDate.set(end.add('1', 'minute').toISOString())
    expect(constants.season.year).to.equal(2024)
  })
})
