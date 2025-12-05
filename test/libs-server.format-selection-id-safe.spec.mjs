/* global describe it */

import * as chai from 'chai'

import { format_standard_selection_id } from '#libs-shared'

chai.should()
const expect = chai.expect

describe('LIBS-SHARED format_standard_selection_id with safe option', function () {
  describe('successful formatting (safe=true)', function () {
    it('formats valid game event selection', () => {
      const result = format_standard_selection_id({
        esbid: '2024111011',
        market_type: 'GAME_PASSING_YARDS',
        pid: 'JARE-GOFF-2016-1994-10-14',
        selection_type: 'OVER',
        line: 249.5,
        safe: true,
        source_id: 'FANDUEL'
      })
      expect(result).to.equal(
        'ESBID:2024111011|MARKET:GAME_PASSING_YARDS|PID:JARE-GOFF-2016-1994-10-14|SEL:OVER|LINE:249.5'
      )
    })

    it('formats valid season event selection', () => {
      const result = format_standard_selection_id({
        year: 2024,
        seas_type: 'REG',
        market_type: 'SEASON_PASSING_YARDS',
        pid: 'PATR-MAHO-2017-1995-09-17',
        selection_type: 'OVER',
        line: 4500.5,
        safe: true,
        source_id: 'DRAFTKINGS'
      })
      expect(result).to.equal(
        'SEAS:2024|SEAS_TYPE:REG|MARKET:SEASON_PASSING_YARDS|PID:PATR-MAHO-2017-1995-09-17|SEL:OVER|LINE:4500.5'
      )
    })

    it('formats valid team moneyline selection', () => {
      const result = format_standard_selection_id({
        esbid: '2024111011',
        market_type: 'GAME_MONEYLINE',
        team: 'DET',
        safe: true,
        source_id: 'FANATICS'
      })
      expect(result).to.equal('ESBID:2024111011|MARKET:GAME_MONEYLINE|TEAM:DET')
    })
  })

  describe('error handling with safe=true - returns UNKNOWN format', function () {
    it('returns UNKNOWN for invalid market_type', () => {
      const result = format_standard_selection_id({
        esbid: '2024111011',
        market_type: 'INVALID_MARKET_TYPE',
        pid: 'JARE-GOFF-2016-1994-10-14',
        selection_type: 'OVER',
        line: 249.5,
        safe: true,
        source_id: 'FANDUEL'
      })
      expect(result).to.match(/^UNKNOWN\|SOURCE:FANDUEL\|RAW:/)
      expect(result).to.include('esbid=2024111011')
      expect(result).to.include('market_type=INVALID_MARKET_TYPE')
      expect(result).to.include('pid=JARE-GOFF-2016-1994-10-14')
      expect(result).to.include('sel=OVER')
      expect(result).to.include('line=249.5')
    })

    it('returns UNKNOWN for invalid team abbreviation', () => {
      const result = format_standard_selection_id({
        esbid: '2024111011',
        market_type: 'GAME_MONEYLINE',
        team: 'INVALID_TEAM',
        safe: true,
        source_id: 'DRAFTKINGS'
      })
      expect(result).to.match(/^UNKNOWN\|SOURCE:DRAFTKINGS\|RAW:/)
      expect(result).to.include('esbid=2024111011')
      expect(result).to.include('market_type=GAME_MONEYLINE')
      expect(result).to.include('team=INVALID_TEAM')
    })

    it('returns UNKNOWN for invalid selection_type', () => {
      const result = format_standard_selection_id({
        esbid: '2024111011',
        market_type: 'GAME_PASSING_YARDS',
        pid: 'JARE-GOFF-2016-1994-10-14',
        selection_type: 'INVALID_TYPE',
        line: 249.5,
        safe: true,
        source_id: 'FANATICS'
      })
      expect(result).to.match(/^UNKNOWN\|SOURCE:FANATICS\|RAW:/)
      expect(result).to.include('sel=INVALID_TYPE')
    })

    it('returns UNKNOWN for missing event identifier', () => {
      const result = format_standard_selection_id({
        market_type: 'GAME_PASSING_YARDS',
        pid: 'JARE-GOFF-2016-1994-10-14',
        selection_type: 'OVER',
        line: 249.5,
        safe: true,
        source_id: 'FANDUEL'
      })
      expect(result).to.match(/^UNKNOWN\|SOURCE:FANDUEL\|RAW:/)
      expect(result).to.include('market_type=GAME_PASSING_YARDS')
    })

    it('returns UNKNOWN for historical team code', () => {
      const result = format_standard_selection_id({
        esbid: '2024111011',
        market_type: 'GAME_MONEYLINE',
        team: 'STL', // St. Louis Rams - historical
        safe: true,
        source_id: 'DRAFTKINGS'
      })
      expect(result).to.match(/^UNKNOWN\|SOURCE:DRAFTKINGS\|RAW:/)
      expect(result).to.include('team=STL')
    })

    it('uses UNKNOWN as default source_id when not provided', () => {
      const result = format_standard_selection_id({
        esbid: '2024111011',
        market_type: 'INVALID_MARKET',
        safe: true
      })
      expect(result).to.match(/^UNKNOWN\|SOURCE:UNKNOWN\|RAW:/)
    })
  })

  describe('raw_data preservation', function () {
    it('includes raw_data in UNKNOWN format', () => {
      const result = format_standard_selection_id({
        esbid: '2024111011',
        market_type: 'INVALID_MARKET',
        safe: true,
        source_id: 'FANDUEL',
        raw_data: {
          event_id: '12345',
          market_id: '67890',
          selection_id: 'abc123'
        }
      })
      expect(result).to.match(/^UNKNOWN\|SOURCE:FANDUEL\|RAW:/)
      expect(result).to.include('event_id=12345')
      expect(result).to.include('market_id=67890')
      expect(result).to.include('selection_id=abc123')
    })

    it('ignores raw_data when formatting succeeds', () => {
      const result = format_standard_selection_id({
        esbid: '2024111011',
        market_type: 'GAME_MONEYLINE',
        team: 'DET',
        safe: true,
        source_id: 'FANDUEL',
        raw_data: {
          event_id: '12345'
        }
      })
      // Should be standard format, not UNKNOWN
      expect(result).to.equal('ESBID:2024111011|MARKET:GAME_MONEYLINE|TEAM:DET')
      expect(result).to.not.include('event_id')
    })
  })

  describe('edge cases', function () {
    it('handles null/undefined values gracefully', () => {
      const result = format_standard_selection_id({
        esbid: '2024111011',
        market_type: 'GAME_PASSING_YARDS',
        pid: null,
        team: undefined,
        selection_type: 'OVER',
        line: 249.5,
        safe: true,
        source_id: 'FANDUEL'
      })
      // Should succeed since pid/team are optional
      expect(result).to.equal(
        'ESBID:2024111011|MARKET:GAME_PASSING_YARDS|SEL:OVER|LINE:249.5'
      )
    })

    it('handles zero line value', () => {
      const result = format_standard_selection_id({
        esbid: '2024111011',
        market_type: 'GAME_SPREAD',
        team: 'DET',
        line: 0,
        safe: true,
        source_id: 'DRAFTKINGS'
      })
      expect(result).to.equal(
        'ESBID:2024111011|MARKET:GAME_SPREAD|TEAM:DET|LINE:0'
      )
    })

    it('handles negative line value', () => {
      const result = format_standard_selection_id({
        esbid: '2024111011',
        market_type: 'GAME_SPREAD',
        team: 'DET',
        line: -3.5,
        safe: true,
        source_id: 'FANATICS'
      })
      expect(result).to.equal(
        'ESBID:2024111011|MARKET:GAME_SPREAD|TEAM:DET|LINE:-3.5'
      )
    })
  })

  describe('safe=false (default) still throws', function () {
    it('throws for invalid market_type when safe is not set', () => {
      expect(() =>
        format_standard_selection_id({
          esbid: '2024111011',
          market_type: 'INVALID_MARKET'
        })
      ).to.throw('Invalid market_type: INVALID_MARKET')
    })

    it('throws for invalid team when safe=false', () => {
      expect(() =>
        format_standard_selection_id({
          esbid: '2024111011',
          market_type: 'GAME_MONEYLINE',
          team: 'INVALID',
          safe: false
        })
      ).to.throw('Invalid team abbreviation: INVALID')
    })
  })
})
