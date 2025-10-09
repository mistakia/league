/* global describe it */
import * as chai from 'chai'

import get_final_practice_day from '../../libs-shared/get-final-practice-day.mjs'

const expect = chai.expect

describe('LIBS-SHARED get_final_practice_day', function () {
  it('should return 3 (Wednesday) for Thursday games', function () {
    const result = get_final_practice_day({ game_day: 'THU' })
    expect(result).to.equal(3)
  })

  it('should return 4 (Thursday) for Friday games', function () {
    const result = get_final_practice_day({ game_day: 'FRI' })
    expect(result).to.equal(4)
  })

  it('should return 5 (Friday) for Saturday games', function () {
    const result = get_final_practice_day({ game_day: 'SAT' })
    expect(result).to.equal(5)
  })

  it('should return 5 (Friday) for Sunday games', function () {
    const result = get_final_practice_day({ game_day: 'SUN' })
    expect(result).to.equal(5)
  })

  it('should return 5 (Friday) for Sunday night games', function () {
    const result = get_final_practice_day({ game_day: 'SN' })
    expect(result).to.equal(5)
  })

  it('should return 6 (Saturday) for Monday night games', function () {
    const result = get_final_practice_day({ game_day: 'MN' })
    expect(result).to.equal(6)
  })

  it('should return 1 (Monday) for Tuesday games', function () {
    const result = get_final_practice_day({ game_day: 'TUE' })
    expect(result).to.equal(1)
  })

  it('should return 2 (Tuesday) for Wednesday games', function () {
    const result = get_final_practice_day({ game_day: 'WED' })
    expect(result).to.equal(2)
  })

  it('should return 5 (Friday) for null game_day', function () {
    const result = get_final_practice_day({ game_day: null })
    expect(result).to.equal(5)
  })

  it('should return 5 (Friday) for undefined game_day', function () {
    const result = get_final_practice_day({ game_day: undefined })
    expect(result).to.equal(5)
  })

  it('should return 5 (Friday) when called with no parameters', function () {
    const result = get_final_practice_day()
    expect(result).to.equal(5)
  })

  it('should return 5 (Friday) for unknown game_day string', function () {
    const result = get_final_practice_day({ game_day: 'UNKNOWN' })
    expect(result).to.equal(5)
  })
})
