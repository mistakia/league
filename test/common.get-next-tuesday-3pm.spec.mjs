/* global describe it beforeEach afterEach */

import * as chai from 'chai'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import MockDate from 'mockdate'

import { get_next_tuesday_3pm } from '#libs-shared'

dayjs.extend(utc)
dayjs.extend(timezone)
chai.should()
const expect = chai.expect

describe('LIBS-SHARED get_next_tuesday_3pm', function () {
  // Freeze base time so .day() math is deterministic across environments
  beforeEach(() => {
    const base = dayjs.tz('2025-01-01 12:00', 'America/New_York')
    MockDate.set(base.toISOString())
  })

  afterEach(() => {
    MockDate.reset()
  })

  // Helper to create a specific day/time in EST
  const create_time = (day, hour, minute = 0) => {
    return dayjs()
      .tz('America/New_York')
      .day(day)
      .hour(hour)
      .minute(minute)
      .second(0)
      .millisecond(0)
  }

  describe('Before Tuesday 3pm cutoff', function () {
    it('should return this Tuesday 3pm when called on Monday', () => {
      const monday_noon = create_time(1, 12, 0)
      const result = get_next_tuesday_3pm(monday_noon)
      const expected_tuesday_3pm = monday_noon.day(2).startOf('day').hour(15)

      expect(result.unix()).to.equal(expected_tuesday_3pm.unix())
      expect(result.day()).to.equal(2) // Tuesday
      expect(result.hour()).to.equal(15) // 3pm
    })

    it('should return this Tuesday 3pm when called on Tuesday at 2pm', () => {
      const tuesday_2pm = create_time(2, 14, 0)
      const result = get_next_tuesday_3pm(tuesday_2pm)
      const expected_tuesday_3pm = tuesday_2pm.day(2).startOf('day').hour(15)

      expect(result.unix()).to.equal(expected_tuesday_3pm.unix())
      expect(result.day()).to.equal(2) // Tuesday
      expect(result.hour()).to.equal(15) // 3pm
    })

    it('should return this Tuesday 3pm when called on Tuesday at 2:59pm', () => {
      const tuesday_259pm = create_time(2, 14, 59)
      const result = get_next_tuesday_3pm(tuesday_259pm)
      const expected_tuesday_3pm = tuesday_259pm.day(2).startOf('day').hour(15)

      expect(result.unix()).to.equal(expected_tuesday_3pm.unix())
      expect(result.day()).to.equal(2) // Tuesday
      expect(result.hour()).to.equal(15) // 3pm
    })

    it('should return this Tuesday 3pm when called on Sunday', () => {
      const sunday_noon = create_time(0, 12, 0)
      const result = get_next_tuesday_3pm(sunday_noon)
      const expected_tuesday_3pm = sunday_noon.day(2).startOf('day').hour(15)

      expect(result.unix()).to.equal(expected_tuesday_3pm.unix())
      expect(result.day()).to.equal(2) // Tuesday
      expect(result.hour()).to.equal(15) // 3pm
    })

    it('should return next Tuesday 3pm when called on Saturday (after this week Tuesday)', () => {
      const saturday_noon = create_time(6, 12, 0)
      const result = get_next_tuesday_3pm(saturday_noon)

      // From Saturday's perspective, .day(2) goes forward to the upcoming Tuesday
      // Since Saturday is "before" that upcoming Tuesday, we should get that Tuesday
      expect(result.day()).to.equal(2) // Tuesday
      expect(result.hour()).to.equal(15) // 3pm

      // The result should be 3 days after Saturday (Sat -> Sun -> Mon -> Tue)
      const days_diff = result.diff(saturday_noon, 'day')
      expect(days_diff).to.be.within(2, 3) // Should be about 3 days (accounting for time of day)
    })
  })

  describe('At or after Tuesday 3pm cutoff', function () {
    it('should return next Tuesday 3pm when called on Tuesday at exactly 3pm', () => {
      const tuesday_3pm = create_time(2, 15, 0)
      const result = get_next_tuesday_3pm(tuesday_3pm)
      const expected_next_tuesday_3pm = tuesday_3pm
        .add('1', 'week')
        .day(2)
        .startOf('day')
        .hour(15)

      expect(result.unix()).to.equal(expected_next_tuesday_3pm.unix())
      expect(result.day()).to.equal(2) // Tuesday
      expect(result.hour()).to.equal(15) // 3pm
    })

    it('should return next Tuesday 3pm when called on Tuesday at 4pm', () => {
      const tuesday_4pm = create_time(2, 16, 0)
      const result = get_next_tuesday_3pm(tuesday_4pm)
      const expected_next_tuesday_3pm = tuesday_4pm
        .add('1', 'week')
        .day(2)
        .startOf('day')
        .hour(15)

      expect(result.unix()).to.equal(expected_next_tuesday_3pm.unix())
      expect(result.day()).to.equal(2) // Tuesday
      expect(result.hour()).to.equal(15) // 3pm
    })

    it('should return next Tuesday 3pm when called on Wednesday', () => {
      const wednesday_noon = create_time(3, 12, 0)
      const result = get_next_tuesday_3pm(wednesday_noon)
      const expected_next_tuesday_3pm = wednesday_noon
        .add('1', 'week')
        .day(2)
        .startOf('day')
        .hour(15)

      expect(result.unix()).to.equal(expected_next_tuesday_3pm.unix())
      expect(result.day()).to.equal(2) // Tuesday
      expect(result.hour()).to.equal(15) // 3pm
    })

    it('should return next Tuesday 3pm when called on Thursday', () => {
      const thursday_noon = create_time(4, 12, 0)
      const result = get_next_tuesday_3pm(thursday_noon)
      const expected_next_tuesday_3pm = thursday_noon
        .add('1', 'week')
        .day(2)
        .startOf('day')
        .hour(15)

      expect(result.unix()).to.equal(expected_next_tuesday_3pm.unix())
      expect(result.day()).to.equal(2) // Tuesday
      expect(result.hour()).to.equal(15) // 3pm
    })

    it('should return next Tuesday 3pm when called on Friday', () => {
      const friday_noon = create_time(5, 12, 0)
      const result = get_next_tuesday_3pm(friday_noon)
      const expected_next_tuesday_3pm = friday_noon
        .add('1', 'week')
        .day(2)
        .startOf('day')
        .hour(15)

      expect(result.unix()).to.equal(expected_next_tuesday_3pm.unix())
      expect(result.day()).to.equal(2) // Tuesday
      expect(result.hour()).to.equal(15) // 3pm
    })
  })

  describe('Edge cases', function () {
    it('should handle transition from Tuesday 2:59pm to 3pm correctly', () => {
      const tuesday_259pm = create_time(2, 14, 59)
      const tuesday_3pm = create_time(2, 15, 0)

      const result_before = get_next_tuesday_3pm(tuesday_259pm)
      const result_at = get_next_tuesday_3pm(tuesday_3pm)

      // Before 3pm should give this Tuesday
      expect(result_before.unix()).to.equal(
        tuesday_259pm.day(2).startOf('day').hour(15).unix()
      )

      // At 3pm should give next Tuesday
      expect(result_at.unix()).to.equal(
        tuesday_3pm.add('1', 'week').day(2).startOf('day').hour(15).unix()
      )

      // They should be exactly 1 week apart
      expect(result_at.diff(result_before, 'week')).to.equal(1)
    })

    it('should use current time when no parameter provided', () => {
      const result = get_next_tuesday_3pm()

      expect(result).to.be.an('object')
      expect(result.day()).to.equal(2) // Tuesday
      expect(result.hour()).to.equal(15) // 3pm
    })
  })
})
