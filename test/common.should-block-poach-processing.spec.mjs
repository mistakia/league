/* global describe it */

import * as chai from 'chai'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone.js'

import { should_block_poach_processing } from '#libs-shared'

dayjs.extend(timezone)
chai.should()
const expect = chai.expect

describe('LIBS-SHARED should_block_poach_processing', function () {
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

  describe('Saturday (day 6)', function () {
    it('should NOT block processing before 6pm on Saturday', () => {
      const saturday_5pm = create_time(6, 17, 59)
      expect(should_block_poach_processing(saturday_5pm)).to.equal(false)
    })

    it('should NOT block processing at 5:30pm on Saturday', () => {
      const saturday_530pm = create_time(6, 17, 30)
      expect(should_block_poach_processing(saturday_530pm)).to.equal(false)
    })

    it('should NOT block processing at noon on Saturday', () => {
      const saturday_noon = create_time(6, 12, 0)
      expect(should_block_poach_processing(saturday_noon)).to.equal(false)
    })

    it('should NOT block processing at midnight on Saturday', () => {
      const saturday_midnight = create_time(6, 0, 0)
      expect(should_block_poach_processing(saturday_midnight)).to.equal(false)
    })

    it('should block processing exactly at 6pm on Saturday', () => {
      const saturday_6pm = create_time(6, 18, 0)
      expect(should_block_poach_processing(saturday_6pm)).to.equal(true)
    })

    it('should block processing at 6:30pm on Saturday', () => {
      const saturday_630pm = create_time(6, 18, 30)
      expect(should_block_poach_processing(saturday_630pm)).to.equal(true)
    })

    it('should block processing at 11pm on Saturday', () => {
      const saturday_11pm = create_time(6, 23, 0)
      expect(should_block_poach_processing(saturday_11pm)).to.equal(true)
    })

    it('should block processing at 11:59pm on Saturday', () => {
      const saturday_1159pm = create_time(6, 23, 59)
      expect(should_block_poach_processing(saturday_1159pm)).to.equal(true)
    })
  })

  describe('Sunday (day 0)', function () {
    it('should block processing at midnight on Sunday', () => {
      const sunday_midnight = create_time(0, 0, 0)
      expect(should_block_poach_processing(sunday_midnight)).to.equal(true)
    })

    it('should block processing at 6am on Sunday', () => {
      const sunday_6am = create_time(0, 6, 0)
      expect(should_block_poach_processing(sunday_6am)).to.equal(true)
    })

    it('should block processing at noon on Sunday', () => {
      const sunday_noon = create_time(0, 12, 0)
      expect(should_block_poach_processing(sunday_noon)).to.equal(true)
    })

    it('should block processing at 3pm on Sunday', () => {
      const sunday_3pm = create_time(0, 15, 0)
      expect(should_block_poach_processing(sunday_3pm)).to.equal(true)
    })

    it('should block processing at 6pm on Sunday', () => {
      const sunday_6pm = create_time(0, 18, 0)
      expect(should_block_poach_processing(sunday_6pm)).to.equal(true)
    })

    it('should block processing at 11:59pm on Sunday', () => {
      const sunday_1159pm = create_time(0, 23, 59)
      expect(should_block_poach_processing(sunday_1159pm)).to.equal(true)
    })
  })

  describe('Monday (day 1)', function () {
    it('should block processing at midnight on Monday', () => {
      const monday_midnight = create_time(1, 0, 0)
      expect(should_block_poach_processing(monday_midnight)).to.equal(true)
    })

    it('should block processing at 9am on Monday', () => {
      const monday_9am = create_time(1, 9, 0)
      expect(should_block_poach_processing(monday_9am)).to.equal(true)
    })

    it('should block processing at noon on Monday', () => {
      const monday_noon = create_time(1, 12, 0)
      expect(should_block_poach_processing(monday_noon)).to.equal(true)
    })

    it('should block processing at 3pm on Monday', () => {
      const monday_3pm = create_time(1, 15, 0)
      expect(should_block_poach_processing(monday_3pm)).to.equal(true)
    })

    it('should block processing at 6pm on Monday', () => {
      const monday_6pm = create_time(1, 18, 0)
      expect(should_block_poach_processing(monday_6pm)).to.equal(true)
    })

    it('should block processing at 11:59pm on Monday', () => {
      const monday_1159pm = create_time(1, 23, 59)
      expect(should_block_poach_processing(monday_1159pm)).to.equal(true)
    })
  })

  describe('Tuesday (day 2)', function () {
    it('should block processing at midnight on Tuesday', () => {
      const tuesday_midnight = create_time(2, 0, 0)
      expect(should_block_poach_processing(tuesday_midnight)).to.equal(true)
    })

    it('should block processing at 9am on Tuesday', () => {
      const tuesday_9am = create_time(2, 9, 0)
      expect(should_block_poach_processing(tuesday_9am)).to.equal(true)
    })

    it('should block processing at 2pm on Tuesday', () => {
      const tuesday_2pm = create_time(2, 14, 0)
      expect(should_block_poach_processing(tuesday_2pm)).to.equal(true)
    })

    it('should block processing at 2:59pm on Tuesday', () => {
      const tuesday_259pm = create_time(2, 14, 59)
      expect(should_block_poach_processing(tuesday_259pm)).to.equal(true)
    })

    it('should NOT block processing exactly at 3pm on Tuesday', () => {
      const tuesday_3pm = create_time(2, 15, 0)
      expect(should_block_poach_processing(tuesday_3pm)).to.equal(false)
    })

    it('should NOT block processing at 3:01pm on Tuesday', () => {
      const tuesday_301pm = create_time(2, 15, 1)
      expect(should_block_poach_processing(tuesday_301pm)).to.equal(false)
    })

    it('should NOT block processing at 4pm on Tuesday', () => {
      const tuesday_4pm = create_time(2, 16, 0)
      expect(should_block_poach_processing(tuesday_4pm)).to.equal(false)
    })

    it('should NOT block processing at 6pm on Tuesday', () => {
      const tuesday_6pm = create_time(2, 18, 0)
      expect(should_block_poach_processing(tuesday_6pm)).to.equal(false)
    })

    it('should NOT block processing at 11:59pm on Tuesday', () => {
      const tuesday_1159pm = create_time(2, 23, 59)
      expect(should_block_poach_processing(tuesday_1159pm)).to.equal(false)
    })
  })

  describe('Wednesday (day 3)', function () {
    it('should NOT block processing at midnight on Wednesday', () => {
      const wednesday_midnight = create_time(3, 0, 0)
      expect(should_block_poach_processing(wednesday_midnight)).to.equal(false)
    })

    it('should NOT block processing at noon on Wednesday', () => {
      const wednesday_noon = create_time(3, 12, 0)
      expect(should_block_poach_processing(wednesday_noon)).to.equal(false)
    })

    it('should NOT block processing at 6pm on Wednesday', () => {
      const wednesday_6pm = create_time(3, 18, 0)
      expect(should_block_poach_processing(wednesday_6pm)).to.equal(false)
    })

    it('should NOT block processing at 11:59pm on Wednesday', () => {
      const wednesday_1159pm = create_time(3, 23, 59)
      expect(should_block_poach_processing(wednesday_1159pm)).to.equal(false)
    })
  })

  describe('Thursday (day 4)', function () {
    it('should NOT block processing at midnight on Thursday', () => {
      const thursday_midnight = create_time(4, 0, 0)
      expect(should_block_poach_processing(thursday_midnight)).to.equal(false)
    })

    it('should NOT block processing at noon on Thursday', () => {
      const thursday_noon = create_time(4, 12, 0)
      expect(should_block_poach_processing(thursday_noon)).to.equal(false)
    })

    it('should NOT block processing at 6pm on Thursday', () => {
      const thursday_6pm = create_time(4, 18, 0)
      expect(should_block_poach_processing(thursday_6pm)).to.equal(false)
    })

    it('should NOT block processing at 11:59pm on Thursday', () => {
      const thursday_1159pm = create_time(4, 23, 59)
      expect(should_block_poach_processing(thursday_1159pm)).to.equal(false)
    })
  })

  describe('Friday (day 5)', function () {
    it('should NOT block processing at midnight on Friday', () => {
      const friday_midnight = create_time(5, 0, 0)
      expect(should_block_poach_processing(friday_midnight)).to.equal(false)
    })

    it('should NOT block processing at noon on Friday', () => {
      const friday_noon = create_time(5, 12, 0)
      expect(should_block_poach_processing(friday_noon)).to.equal(false)
    })

    it('should NOT block processing at 6pm on Friday', () => {
      const friday_6pm = create_time(5, 18, 0)
      expect(should_block_poach_processing(friday_6pm)).to.equal(false)
    })

    it('should NOT block processing at 11:59pm on Friday', () => {
      const friday_1159pm = create_time(5, 23, 59)
      expect(should_block_poach_processing(friday_1159pm)).to.equal(false)
    })
  })

  describe('Edge cases and boundary testing', function () {
    it('should handle transition from Friday to Saturday correctly', () => {
      const friday_1159pm = create_time(5, 23, 59)
      const saturday_midnight = create_time(6, 0, 0)

      expect(should_block_poach_processing(friday_1159pm)).to.equal(false)
      expect(should_block_poach_processing(saturday_midnight)).to.equal(false)
    })

    it('should handle transition from Saturday 5:59pm to 6pm correctly', () => {
      const saturday_559pm = create_time(6, 17, 59)
      const saturday_6pm = create_time(6, 18, 0)

      expect(should_block_poach_processing(saturday_559pm)).to.equal(false)
      expect(should_block_poach_processing(saturday_6pm)).to.equal(true)
    })

    it('should handle transition from Tuesday 2:59pm to 3pm correctly', () => {
      const tuesday_259pm = create_time(2, 14, 59)
      const tuesday_3pm = create_time(2, 15, 0)

      expect(should_block_poach_processing(tuesday_259pm)).to.equal(true)
      expect(should_block_poach_processing(tuesday_3pm)).to.equal(false)
    })

    it('should use current time when no parameter provided', () => {
      // This test just ensures the function can be called without parameters
      const result = should_block_poach_processing()
      expect(result).to.be.a('boolean')
    })
  })

  describe('Full window traversal', function () {
    it('should correctly identify the entire blocking window from Saturday 6pm to Tuesday 3pm', () => {
      // Before window starts
      expect(should_block_poach_processing(create_time(6, 17, 59))).to.equal(
        false
      )

      // Window starts
      expect(should_block_poach_processing(create_time(6, 18, 0))).to.equal(
        true
      )

      // Saturday night
      expect(should_block_poach_processing(create_time(6, 22, 0))).to.equal(
        true
      )

      // Sunday all day
      expect(should_block_poach_processing(create_time(0, 10, 0))).to.equal(
        true
      )

      // Monday all day
      expect(should_block_poach_processing(create_time(1, 10, 0))).to.equal(
        true
      )

      // Tuesday morning
      expect(should_block_poach_processing(create_time(2, 10, 0))).to.equal(
        true
      )

      // Just before window ends
      expect(should_block_poach_processing(create_time(2, 14, 59))).to.equal(
        true
      )

      // Window ends
      expect(should_block_poach_processing(create_time(2, 15, 0))).to.equal(
        false
      )

      // After window
      expect(should_block_poach_processing(create_time(2, 16, 0))).to.equal(
        false
      )
    })

    it('should correctly identify the entire open period from Tuesday 3pm to Saturday 6pm', () => {
      // Tuesday afternoon/evening
      expect(should_block_poach_processing(create_time(2, 15, 0))).to.equal(
        false
      )
      expect(should_block_poach_processing(create_time(2, 18, 0))).to.equal(
        false
      )

      // Wednesday all day
      expect(should_block_poach_processing(create_time(3, 10, 0))).to.equal(
        false
      )

      // Thursday all day
      expect(should_block_poach_processing(create_time(4, 10, 0))).to.equal(
        false
      )

      // Friday all day
      expect(should_block_poach_processing(create_time(5, 10, 0))).to.equal(
        false
      )

      // Saturday morning/afternoon
      expect(should_block_poach_processing(create_time(6, 10, 0))).to.equal(
        false
      )
      expect(should_block_poach_processing(create_time(6, 17, 59))).to.equal(
        false
      )

      // Window starts again
      expect(should_block_poach_processing(create_time(6, 18, 0))).to.equal(
        true
      )
    })
  })
})
