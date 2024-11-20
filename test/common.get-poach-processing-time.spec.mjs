/* global describe it afterEach */

import chai from 'chai'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone.js'
import MockDate from 'mockdate'

import { constants, getPoachProcessingTime } from '#libs-shared'

dayjs.extend(timezone)
chai.should()
const expect = chai.expect

describe('LIBS-SHARED getPoachProcessingTime', function () {
  afterEach(() => {
    MockDate.reset()
  })

  it('should add 48 hours during offseason', () => {
    const offseason = constants.season.start.subtract('1', 'week')
    MockDate.set(offseason.toISOString())
    const submitted = dayjs().unix()
    const processing_time = getPoachProcessingTime(submitted)

    expect(processing_time.unix()).to.equal(
      dayjs.unix(submitted).add('48', 'hours').unix()
    )
  })

  it('should add 48 hours during regular season outside Thu-Sun window', () => {
    const wednesday = constants.season.start.add('5', 'week').day(3)
    MockDate.set(wednesday.toISOString())
    const submitted = dayjs().unix()
    const processing_time = getPoachProcessingTime(submitted)

    expect(processing_time.unix()).to.equal(
      dayjs.unix(submitted).add('48', 'hours').unix()
    )
  })

  it('should set to next Tuesday 3pm if submitted during Thu-Sun window', () => {
    const thursday_after_6pm = constants.season.start
      .add('5', 'week')
      .day(4)
      .hour(19)
    MockDate.set(thursday_after_6pm.toISOString())
    const submitted = dayjs().unix()
    const processing_time = getPoachProcessingTime(submitted)

    const next_tuesday_3pm = constants.season.start
      .add('6', 'week')
      .day(2)
      .hour(15)
    expect(processing_time.unix()).to.equal(next_tuesday_3pm.unix())
  })

  it('should set to Tuesday 3pm if submitted on Sunday before 3pm', () => {
    const sunday_before_3pm = constants.season.start
      .add('5', 'week')
      .day(0)
      .hour(14)
    MockDate.set(sunday_before_3pm.toISOString())
    const submitted = dayjs().unix()
    const processing_time = getPoachProcessingTime(submitted)

    const next_tuesday_3pm = constants.season.start
      .add('5', 'week')
      .day(2)
      .hour(15)
    expect(processing_time.unix()).to.equal(next_tuesday_3pm.unix())
  })
})
