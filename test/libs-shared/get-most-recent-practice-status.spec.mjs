/* global describe it */
import * as chai from 'chai'

import get_most_recent_practice_status from '../../libs-shared/get-most-recent-practice-status.mjs'

const expect = chai.expect

describe('LIBS-SHARED get_most_recent_practice_status', function () {
  it('should return null when all days are null', function () {
    const practice = {
      m: null,
      tu: null,
      w: null,
      th: null,
      f: null,
      s: null,
      su: null
    }
    const current_date = new Date('2024-01-10') // Wednesday
    const result = get_most_recent_practice_status({ practice, current_date })
    expect(result).to.equal(null)
  })

  it('should return current day status when available', function () {
    const practice = {
      m: null,
      tu: null,
      w: 'DNP',
      th: null,
      f: null,
      s: null,
      su: null
    }
    const current_date = new Date('2024-01-10') // Wednesday
    const result = get_most_recent_practice_status({ practice, current_date })
    expect(result).to.equal('DNP')
  })

  it('should walk backward to find most recent previous day', function () {
    const practice = {
      m: 'FULL',
      tu: 'LIMITED',
      w: null,
      th: null,
      f: null,
      s: null,
      su: null
    }
    const current_date = new Date('2024-01-10') // Wednesday
    const result = get_most_recent_practice_status({ practice, current_date })
    expect(result).to.equal('LIMITED')
  })

  it('should return DNP from Friday when current day is Sunday', function () {
    const practice = {
      m: null,
      tu: null,
      w: null,
      th: null,
      f: 'DNP',
      s: null,
      su: null
    }
    const current_date = new Date('2024-01-14') // Sunday
    const result = get_most_recent_practice_status({ practice, current_date })
    expect(result).to.equal('DNP')
  })

  it('should return LIMITED from Wednesday when current day is Thursday', function () {
    const practice = {
      m: null,
      tu: null,
      w: 'LIMITED',
      th: null,
      f: null,
      s: null,
      su: null
    }
    const current_date = new Date('2024-01-11') // Thursday
    const result = get_most_recent_practice_status({ practice, current_date })
    expect(result).to.equal('LIMITED')
  })

  it('should return FULL when all days have FULL status', function () {
    const practice = {
      m: 'FULL',
      tu: 'FULL',
      w: 'FULL',
      th: 'FULL',
      f: 'FULL',
      s: 'FULL',
      su: 'FULL'
    }
    const current_date = new Date('2024-01-10') // Wednesday
    const result = get_most_recent_practice_status({ practice, current_date })
    expect(result).to.equal('FULL')
  })

  it('should return closest status with mixed statuses across week', function () {
    const practice = {
      m: 'FULL',
      tu: 'LIMITED',
      w: 'DNP',
      th: null,
      f: null,
      s: null,
      su: null
    }
    const current_date = new Date('2024-01-12') // Friday
    const result = get_most_recent_practice_status({ practice, current_date })
    expect(result).to.equal('DNP')
  })

  it('should walk backward through entire week if needed', function () {
    const practice = {
      m: 'DNP',
      tu: null,
      w: null,
      th: null,
      f: null,
      s: null,
      su: null
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
      m: 'FULL',
      tu: null,
      w: null,
      th: null,
      f: 'LIMITED',
      s: null,
      su: null
    }
    const current_date = new Date('2024-01-08T12:00:00') // Monday
    const result = get_most_recent_practice_status({ practice, current_date })
    expect(result).to.equal('FULL')
  })

  it('should handle Saturday as current day', function () {
    const practice = {
      m: null,
      tu: null,
      w: null,
      th: 'DNP',
      f: 'LIMITED',
      s: null,
      su: null
    }
    const current_date = new Date('2024-01-13') // Saturday
    const result = get_most_recent_practice_status({ practice, current_date })
    expect(result).to.equal('LIMITED')
  })
})
