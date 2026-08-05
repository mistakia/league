/* global describe it */
import * as chai from 'chai'

import get_most_recent_practice_status from '#libs-shared/get-most-recent-practice-status.mjs'

const expect = chai.expect

describe('LIBS-SHARED get_most_recent_practice_status', function () {
  it('should return null when all days are null', function () {
    const practice = {
      monday_practice_status: null,
      tuesday_practice_status: null,
      wednesday_practice_status: null,
      thursday_practice_status: null,
      friday_practice_status: null,
      saturday_practice_status: null,
      sunday_practice_status: null
    }
    const current_date = new Date('2024-01-10') // Wednesday
    const result = get_most_recent_practice_status({ practice, current_date })
    expect(result).to.equal(null)
  })

  it('should return current day status when available', function () {
    const practice = {
      monday_practice_status: null,
      tuesday_practice_status: null,
      wednesday_practice_status: 'DNP',
      thursday_practice_status: null,
      friday_practice_status: null,
      saturday_practice_status: null,
      sunday_practice_status: null
    }
    const current_date = new Date('2024-01-10') // Wednesday
    const result = get_most_recent_practice_status({ practice, current_date })
    expect(result).to.equal('DNP')
  })

  it('should walk backward to find most recent previous day', function () {
    const practice = {
      monday_practice_status: 'FP',
      tuesday_practice_status: 'LP',
      wednesday_practice_status: null,
      thursday_practice_status: null,
      friday_practice_status: null,
      saturday_practice_status: null,
      sunday_practice_status: null
    }
    const current_date = new Date('2024-01-10') // Wednesday
    const result = get_most_recent_practice_status({ practice, current_date })
    expect(result).to.equal('LP')
  })

  it('should return DNP from Friday when current day is Sunday', function () {
    const practice = {
      monday_practice_status: null,
      tuesday_practice_status: null,
      wednesday_practice_status: null,
      thursday_practice_status: null,
      friday_practice_status: 'DNP',
      saturday_practice_status: null,
      sunday_practice_status: null
    }
    const current_date = new Date('2024-01-14') // Sunday
    const result = get_most_recent_practice_status({ practice, current_date })
    expect(result).to.equal('DNP')
  })

  it('should return LP from Wednesday when current day is Thursday', function () {
    const practice = {
      monday_practice_status: null,
      tuesday_practice_status: null,
      wednesday_practice_status: 'LP',
      thursday_practice_status: null,
      friday_practice_status: null,
      saturday_practice_status: null,
      sunday_practice_status: null
    }
    const current_date = new Date('2024-01-11') // Thursday
    const result = get_most_recent_practice_status({ practice, current_date })
    expect(result).to.equal('LP')
  })

  it('should return FP when all days have FP status', function () {
    const practice = {
      monday_practice_status: 'FP',
      tuesday_practice_status: 'FP',
      wednesday_practice_status: 'FP',
      thursday_practice_status: 'FP',
      friday_practice_status: 'FP',
      saturday_practice_status: 'FP',
      sunday_practice_status: 'FP'
    }
    const current_date = new Date('2024-01-10') // Wednesday
    const result = get_most_recent_practice_status({ practice, current_date })
    expect(result).to.equal('FP')
  })

  it('should return closest status with mixed statuses across week', function () {
    const practice = {
      monday_practice_status: 'FP',
      tuesday_practice_status: 'LP',
      wednesday_practice_status: 'DNP',
      thursday_practice_status: null,
      friday_practice_status: null,
      saturday_practice_status: null,
      sunday_practice_status: null
    }
    const current_date = new Date('2024-01-12') // Friday
    const result = get_most_recent_practice_status({ practice, current_date })
    expect(result).to.equal('DNP')
  })

  it('should walk backward through entire week if needed', function () {
    const practice = {
      monday_practice_status: 'DNP',
      tuesday_practice_status: null,
      wednesday_practice_status: null,
      thursday_practice_status: null,
      friday_practice_status: null,
      saturday_practice_status: null,
      sunday_practice_status: null
    }
    const current_date = new Date('2024-01-14') // Sunday
    const result = get_most_recent_practice_status({ practice, current_date })
    expect(result).to.equal('DNP')
  })

  it('should return null when practice object is null', function () {
    const practice = null
    const current_date = new Date('2024-01-10')
    const result = get_most_recent_practice_status({ practice, current_date })
    expect(result).to.equal(null)
  })

  it('should return null when practice object is undefined', function () {
    const practice = undefined
    const current_date = new Date('2024-01-10')
    const result = get_most_recent_practice_status({ practice, current_date })
    expect(result).to.equal(null)
  })

  it('should handle Monday as current day', function () {
    const practice = {
      monday_practice_status: 'FULL',
      tuesday_practice_status: null,
      wednesday_practice_status: null,
      thursday_practice_status: null,
      friday_practice_status: 'LP',
      saturday_practice_status: null,
      sunday_practice_status: null
    }
    const current_date = new Date('2024-01-08T12:00:00') // Monday
    const result = get_most_recent_practice_status({ practice, current_date })
    // Legacy FULL is normalized to FP, same as every other case in this file
    expect(result).to.equal('FP')
  })

  it('should handle Saturday as current day', function () {
    const practice = {
      monday_practice_status: null,
      tuesday_practice_status: null,
      wednesday_practice_status: null,
      thursday_practice_status: 'DNP',
      friday_practice_status: 'LP',
      saturday_practice_status: null,
      sunday_practice_status: null
    }
    const current_date = new Date('2024-01-13') // Saturday
    const result = get_most_recent_practice_status({ practice, current_date })
    expect(result).to.equal('LP')
  })
})
