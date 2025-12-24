/* global describe it */

import * as chai from 'chai'

import get_game_progress from '#libs-shared/get-game-progress.mjs'

chai.should()
const { expect } = chai

describe('LIBS-SHARED get_game_progress', function () {
  describe('game not started', function () {
    it('returns 0 when no quarter data', () => {
      expect(get_game_progress({})).to.equal(0)
    })

    it('returns 0 when quarter is 0', () => {
      expect(get_game_progress({ quarter: 0 })).to.equal(0)
    })

    it('returns 0 when quarter is negative', () => {
      expect(get_game_progress({ quarter: -1 })).to.equal(0)
    })
  })

  describe('quarter progress', function () {
    it('returns 0 at start of Q1', () => {
      const result = get_game_progress({ quarter: 1, game_clock: '15:00' })
      expect(result).to.equal(0)
    })

    it('returns 0.125 at halftime of Q1', () => {
      const result = get_game_progress({ quarter: 1, game_clock: '07:30' })
      expect(result).to.be.closeTo(0.125, 0.001)
    })

    it('returns 0.25 at start of Q2', () => {
      const result = get_game_progress({ quarter: 2, game_clock: '15:00' })
      expect(result).to.equal(0.25)
    })

    it('returns 0.5 at start of Q3 (halftime)', () => {
      const result = get_game_progress({ quarter: 3, game_clock: '15:00' })
      expect(result).to.equal(0.5)
    })

    it('returns 0.75 at start of Q4', () => {
      const result = get_game_progress({ quarter: 4, game_clock: '15:00' })
      expect(result).to.equal(0.75)
    })

    it('returns 1 at end of Q4', () => {
      const result = get_game_progress({ quarter: 4, game_clock: '00:00' })
      expect(result).to.equal(1)
    })
  })

  describe('mid-quarter progress', function () {
    it('calculates mid-Q2 correctly (5:00 left)', () => {
      const result = get_game_progress({ quarter: 2, game_clock: '05:00' })
      // Q1 complete (25%) + 10 minutes elapsed in Q2 (10/15 * 25%)
      expect(result).to.be.closeTo(0.4167, 0.001)
    })

    it('calculates mid-Q3 correctly (10:00 left)', () => {
      const result = get_game_progress({ quarter: 3, game_clock: '10:00' })
      // Q1+Q2 complete (50%) + 5 minutes elapsed in Q3 (5/15 * 25%)
      expect(result).to.be.closeTo(0.5833, 0.001)
    })
  })

  describe('overtime', function () {
    it('returns 1 for overtime (Q5)', () => {
      const result = get_game_progress({ quarter: 5, game_clock: '10:00' })
      expect(result).to.equal(1)
    })

    it('returns 1 for overtime (Q6)', () => {
      const result = get_game_progress({ quarter: 6, game_clock: '05:00' })
      expect(result).to.equal(1)
    })
  })

  describe('final games', function () {
    it('returns 1 when is_final is true', () => {
      const result = get_game_progress({
        quarter: 4,
        game_clock: '02:00',
        is_final: true
      })
      expect(result).to.equal(1)
    })

    it('returns 1 for final game with no clock data', () => {
      const result = get_game_progress({ is_final: true })
      expect(result).to.equal(1)
    })
  })

  describe('clock parsing', function () {
    it('handles single-digit minutes', () => {
      const result = get_game_progress({ quarter: 1, game_clock: '5:30' })
      // 9.5 minutes elapsed in Q1 (9.5/15 * 25%)
      expect(result).to.be.closeTo(0.1583, 0.001)
    })

    it('handles single-digit seconds', () => {
      const result = get_game_progress({ quarter: 1, game_clock: '14:05' })
      // 55 seconds elapsed
      expect(result).to.be.closeTo(0.0153, 0.001)
    })

    it('handles whitespace in clock', () => {
      const result = get_game_progress({ quarter: 1, game_clock: ' 10:00 ' })
      // 5 minutes elapsed (5/15 * 25%)
      expect(result).to.be.closeTo(0.0833, 0.001)
    })

    it('handles null game_clock', () => {
      const result = get_game_progress({ quarter: 2, game_clock: null })
      // Treats as 0 remaining in quarter = quarter fully elapsed
      expect(result).to.equal(0.5)
    })

    it('handles invalid clock format', () => {
      const result = get_game_progress({ quarter: 2, game_clock: 'invalid' })
      expect(result).to.equal(0.5)
    })
  })
})
