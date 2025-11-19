/* global describe it */
import * as chai from 'chai'

import { normalize_game_clock } from '../libs-server/play-enum-utils.mjs'

const { expect } = chai

describe('LIBS-SERVER normalize_game_clock', () => {
  describe('Valid inputs', () => {
    it('should normalize single-digit minutes with leading zero', () => {
      expect(normalize_game_clock('2:00')).to.equal('02:00')
      expect(normalize_game_clock('1:09')).to.equal('01:09')
      expect(normalize_game_clock('5:45')).to.equal('05:45')
      expect(normalize_game_clock('9:59')).to.equal('09:59')
    })

    it('should preserve already zero-padded minutes', () => {
      expect(normalize_game_clock('02:00')).to.equal('02:00')
      expect(normalize_game_clock('01:09')).to.equal('01:09')
      expect(normalize_game_clock('15:00')).to.equal('15:00')
      expect(normalize_game_clock('00:00')).to.equal('00:00')
    })

    it('should handle double-digit minutes correctly', () => {
      expect(normalize_game_clock('10:00')).to.equal('10:00')
      expect(normalize_game_clock('15:00')).to.equal('15:00')
      expect(normalize_game_clock('12:34')).to.equal('12:34')
    })

    it('should normalize single-digit seconds with leading zero', () => {
      expect(normalize_game_clock('02:5')).to.equal('02:05')
      expect(normalize_game_clock('5:7')).to.equal('05:07')
    })

    it('should handle edge cases correctly', () => {
      expect(normalize_game_clock('0:00')).to.equal('00:00')
      expect(normalize_game_clock('0:01')).to.equal('00:01')
      expect(normalize_game_clock('15:00')).to.equal('15:00')
    })

    it('should handle whitespace in input', () => {
      expect(normalize_game_clock(' 2:00 ')).to.equal('02:00')
      expect(normalize_game_clock('  1:09  ')).to.equal('01:09')
    })
  })

  describe('Invalid inputs', () => {
    it('should return null for null/undefined', () => {
      expect(normalize_game_clock(null)).to.be.null
      expect(normalize_game_clock(undefined)).to.be.null
    })

    it('should return null for empty strings', () => {
      expect(normalize_game_clock('')).to.be.null
      expect(normalize_game_clock('   ')).to.be.null
    })

    it('should return null for non-string inputs', () => {
      expect(normalize_game_clock(123)).to.be.null
      expect(normalize_game_clock({})).to.be.null
      expect(normalize_game_clock([])).to.be.null
    })

    it('should return null for invalid format', () => {
      expect(normalize_game_clock('2')).to.be.null
      expect(normalize_game_clock('2:00:00')).to.be.null
      expect(normalize_game_clock('abc:def')).to.be.null
      expect(normalize_game_clock('2-00')).to.be.null
    })

    it('should return null for out-of-range values', () => {
      expect(normalize_game_clock('16:00')).to.be.null // > 15 minutes
      expect(normalize_game_clock('20:00')).to.be.null
      expect(normalize_game_clock('-1:00')).to.be.null // negative minutes
      expect(normalize_game_clock('2:60')).to.be.null // > 59 seconds
      expect(normalize_game_clock('2:-1')).to.be.null // negative seconds
    })
  })

  describe('Collision prevention', () => {
    it('should normalize equivalent times to same format', () => {
      // These are all the same time, should normalize to same value
      const variations = ['2:00', '02:00', ' 2:00', '2:00 ']
      const normalized = variations.map(normalize_game_clock)

      // All should be equal
      normalized.forEach((val) => {
        expect(val).to.equal('02:00')
      })
    })

    it('should handle sportradar collision examples', () => {
      // Real collision examples from the import log
      expect(normalize_game_clock('02:00')).to.equal(
        normalize_game_clock('2:00')
      )
      expect(normalize_game_clock('01:09')).to.equal(
        normalize_game_clock('1:09')
      )
      expect(normalize_game_clock('01:55')).to.equal(
        normalize_game_clock('1:55')
      )
      expect(normalize_game_clock('06:45')).to.equal(
        normalize_game_clock('6:45')
      )
      expect(normalize_game_clock('07:06')).to.equal(
        normalize_game_clock('7:06')
      )
    })
  })
})
