/* global describe, it, after */

// eslint-disable-next-line
require = require('esm')(module /*, options*/)

const chai = require('chai')
const MockDate = require('mockdate')
const expect = chai.expect

const { constants } = require('../common')
const { start, end } = constants.season

describe('COMMON Season', function () {
  after(() => { MockDate.reset() })

  it('isRegularSeason', function () {
    // 5 weeks before start of week 1
    MockDate.set(start.clone().subtract('1', 'month').toDate())
    expect(constants.season.isRegularSeason).to.equal(false)

    // 1 minute before start of week 1
    MockDate.set(start.clone().add('7', 'day').subtract('1', 'minute').toDate())
    expect(constants.season.isRegularSeason).to.equal(false)

    // start of week 1
    MockDate.set(start.clone().add('7', 'day').toDate())
    expect(constants.season.isRegularSeason).to.equal(true)

    // start of week 4
    MockDate.set(start.clone().add('28', 'day').toDate())
    expect(constants.season.isRegularSeason).to.equal(true)

    // start of week 16
    MockDate.set(start.clone().add('60', 'day').toDate())
    expect(constants.season.isRegularSeason).to.equal(true)

    // start of week 17
    MockDate.set(start.clone().add('119', 'day').toDate())
    expect(constants.season.isRegularSeason).to.equal(false)
  })

  // test before regular season waiver period
  it('isWaiverPeriod', function () {
    // start of week 0
    MockDate.set(start.clone().toDate())
    expect(constants.season.isWaiverPeriod).to.equal(true)

    // tuesday of week 1
    MockDate.set(start.clone().add('7', 'day').day(2).toDate())
    expect(constants.season.isWaiverPeriod).to.equal(true)

    // wednesday of week 1 - noon
    MockDate.set(start.clone().add('7', 'day').day(3).hour(11).toDate())
    expect(constants.season.isWaiverPeriod).to.equal(true)

    // wednesday of week 1 - 3pm
    MockDate.set(start.clone().add('7', 'day').day(3).hour(14).toDate())
    expect(constants.season.isWaiverPeriod).to.equal(false)

    // tuesday of week 2
    MockDate.set(start.clone().add('14', 'day').day(2).toDate())
    expect(constants.season.isWaiverPeriod).to.equal(true)

    // wednesday of week 2 - noon
    MockDate.set(start.clone().add('14', 'day').day(3).hour(11).toDate())
    expect(constants.season.isWaiverPeriod).to.equal(true)

    // wednesday of week 16 - 3pm
    MockDate.set(start.clone().add('112', 'day').day(3).hour(14).toDate())
    expect(constants.season.isWaiverPeriod).to.equal(false)

    // tuesday of week 16
    MockDate.set(start.clone().add('112', 'day').day(2).toDate())
    expect(constants.season.isWaiverPeriod).to.equal(true)

    // wednesday of week 16 - noon
    MockDate.set(start.clone().add('112', 'day').day(3).hour(11).toDate())
    expect(constants.season.isWaiverPeriod).to.equal(true)

    // wednesday of week 16 - 3pm
    MockDate.set(start.clone().add('112', 'day').day(3).hour(14).toDate())
    expect(constants.season.isWaiverPeriod).to.equal(false)

    // tuesday of week 17
    MockDate.set(start.clone().add('112', 'day').day(2).toDate())
    expect(constants.season.isWaiverPeriod).to.equal(true)

    // wednesday of week 17
    MockDate.set(start.clone().add('112', 'day').day(3).toDate())
    expect(constants.season.isWaiverPeriod).to.equal(true)
  })

  it('week', function () {
    // start of week 0
    MockDate.set(start.clone().toDate())
    expect(constants.season.week).to.equal(0)

    // end of week 0
    MockDate.set(start.clone().add('7', 'days').subtract('1', 'minute').toDate())
    expect(constants.season.week).to.equal(0)

    // start of week 1
    MockDate.set(start.clone().add('7', 'days').toDate())
    expect(constants.season.week).to.equal(1)

    // end of week 1
    MockDate.set(start.clone().add('14', 'days').subtract('1', 'minute').toDate())
    expect(constants.season.week).to.equal(1)

    // start of week 16
    MockDate.set(start.clone().add('112', 'days').toDate())
    expect(constants.season.week).to.equal(16)

    // end of week 16 - day light savings
    MockDate.set(start.clone().add('119', 'days').subtract('61', 'minute').toDate())
    expect(constants.season.week).to.equal(16)

    // start of week 17
    MockDate.set(start.clone().add('119', 'days').toDate())
    expect(constants.season.week).to.equal(17)
  })

  it('year', function () {
    // start of week 0
    MockDate.set(start.clone().toDate())
    expect(constants.season.year).to.equal(2020)

    // start of year
    MockDate.set(start.clone().startOf('year').toDate())
    expect(constants.season.year).to.equal(2020)

    // last day of year
    MockDate.set(start.clone().endOf('year').toDate())
    expect(constants.season.year).to.equal(2020)

    // first day of new year
    MockDate.set(end.clone().startOf('year').toDate())
    expect(constants.season.year).to.equal(2020)

    // before super bowl
    MockDate.set(end.clone().subtract('1', 'day').toDate())
    expect(constants.season.year).to.equal(2020)

    // after super bowl
    MockDate.set(end.clone().toDate())
    expect(constants.season.year).to.equal(2021)
  })
})
