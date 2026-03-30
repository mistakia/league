/* global describe it */

import * as chai from 'chai'

import {
  parse_nfl_week_identifier,
  format_nfl_week_identifier,
  validate_nfl_week_identifier,
  get_nfl_week_identifiers_for_year,
  apply_year_offset_to_nfl_weeks,
  decompose_nfl_weeks
} from '#libs-shared/nfl-week-identifier.mjs'

chai.should()
const expect = chai.expect

describe('LIBS-SHARED nfl-week-identifier', function () {
  describe('parse_nfl_week_identifier', function () {
    it('parses regular season week', () => {
      const result = parse_nfl_week_identifier({
        identifier: '2024_REG_WEEK_5'
      })
      expect(result).to.deep.equal({ year: 2024, seas_type: 'REG', week: 5 })
    })

    it('parses preseason week', () => {
      const result = parse_nfl_week_identifier({
        identifier: '2024_PRE_WEEK_2'
      })
      expect(result).to.deep.equal({ year: 2024, seas_type: 'PRE', week: 2 })
    })

    it('parses postseason week', () => {
      const result = parse_nfl_week_identifier({
        identifier: '2019_POST_WEEK_1'
      })
      expect(result).to.deep.equal({ year: 2019, seas_type: 'POST', week: 1 })
    })

    it('parses double-digit week', () => {
      const result = parse_nfl_week_identifier({
        identifier: '2024_REG_WEEK_18'
      })
      expect(result).to.deep.equal({ year: 2024, seas_type: 'REG', week: 18 })
    })

    it('returns null for invalid format', () => {
      expect(parse_nfl_week_identifier({ identifier: 'invalid' })).to.be.null
      expect(parse_nfl_week_identifier({ identifier: '2024_REG_5' })).to.be.null
      expect(parse_nfl_week_identifier({ identifier: '2024_PRO_WEEK_1' })).to.be
        .null
      expect(parse_nfl_week_identifier({ identifier: '' })).to.be.null
      expect(parse_nfl_week_identifier({ identifier: null })).to.be.null
      expect(parse_nfl_week_identifier({ identifier: undefined })).to.be.null
    })
  })

  describe('format_nfl_week_identifier', function () {
    it('formats regular season week', () => {
      const result = format_nfl_week_identifier({
        year: 2024,
        seas_type: 'REG',
        week: 5
      })
      expect(result).to.equal('2024_REG_WEEK_5')
    })

    it('formats preseason week', () => {
      const result = format_nfl_week_identifier({
        year: 2024,
        seas_type: 'PRE',
        week: 2
      })
      expect(result).to.equal('2024_PRE_WEEK_2')
    })

    it('formats postseason week', () => {
      const result = format_nfl_week_identifier({
        year: 2019,
        seas_type: 'POST',
        week: 1
      })
      expect(result).to.equal('2019_POST_WEEK_1')
    })
  })

  describe('validate_nfl_week_identifier', function () {
    it('accepts valid regular season weeks', () => {
      expect(validate_nfl_week_identifier({ identifier: '2024_REG_WEEK_1' })).to
        .be.true
      expect(validate_nfl_week_identifier({ identifier: '2024_REG_WEEK_21' }))
        .to.be.true
    })

    it('accepts valid preseason weeks', () => {
      expect(validate_nfl_week_identifier({ identifier: '2024_PRE_WEEK_1' })).to
        .be.true
      expect(validate_nfl_week_identifier({ identifier: '2024_PRE_WEEK_4' })).to
        .be.true
    })

    it('accepts valid postseason weeks', () => {
      expect(validate_nfl_week_identifier({ identifier: '2024_POST_WEEK_1' }))
        .to.be.true
      expect(validate_nfl_week_identifier({ identifier: '2024_POST_WEEK_4' }))
        .to.be.true
    })

    it('rejects weeks out of range', () => {
      expect(validate_nfl_week_identifier({ identifier: '2024_REG_WEEK_0' })).to
        .be.false
      expect(validate_nfl_week_identifier({ identifier: '2024_REG_WEEK_22' }))
        .to.be.false
      expect(validate_nfl_week_identifier({ identifier: '2024_PRE_WEEK_5' })).to
        .be.false
      expect(validate_nfl_week_identifier({ identifier: '2024_POST_WEEK_5' }))
        .to.be.false
    })

    it('rejects years out of range', () => {
      expect(validate_nfl_week_identifier({ identifier: '1999_REG_WEEK_1' })).to
        .be.false
    })

    it('rejects PRO season type', () => {
      expect(validate_nfl_week_identifier({ identifier: '2024_PRO_WEEK_1' })).to
        .be.false
    })

    it('rejects invalid format', () => {
      expect(validate_nfl_week_identifier({ identifier: 'invalid' })).to.be
        .false
    })
  })

  describe('get_nfl_week_identifiers_for_year', function () {
    it('returns all identifiers for a year', () => {
      const result = get_nfl_week_identifiers_for_year({ year: 2024 })
      // PRE: 4 weeks + REG: 21 weeks + POST: 4 weeks = 29
      expect(result).to.have.length(29)
      expect(result[0]).to.equal('2024_PRE_WEEK_1')
      expect(result[4]).to.equal('2024_REG_WEEK_1')
      expect(result[result.length - 1]).to.equal('2024_POST_WEEK_4')
    })

    it('returns identifiers for specific season type', () => {
      const result = get_nfl_week_identifiers_for_year({
        year: 2024,
        seas_type: 'REG'
      })
      expect(result).to.have.length(21)
      expect(result[0]).to.equal('2024_REG_WEEK_1')
      expect(result[result.length - 1]).to.equal('2024_REG_WEEK_21')
    })

    it('returns preseason identifiers', () => {
      const result = get_nfl_week_identifiers_for_year({
        year: 2024,
        seas_type: 'PRE'
      })
      expect(result).to.have.length(4)
    })

    it('returns postseason identifiers', () => {
      const result = get_nfl_week_identifiers_for_year({
        year: 2024,
        seas_type: 'POST'
      })
      expect(result).to.have.length(4)
    })
  })

  describe('apply_year_offset_to_nfl_weeks', function () {
    it('applies single offset value', () => {
      const result = apply_year_offset_to_nfl_weeks({
        nfl_weeks: ['2024_REG_WEEK_5'],
        year_offset: [-1, 1]
      })
      expect(result).to.include('2023_REG_WEEK_5')
      expect(result).to.include('2024_REG_WEEK_5')
      expect(result).to.include('2025_REG_WEEK_5')
    })

    it('returns original when no offset', () => {
      const input = ['2024_REG_WEEK_5']
      const result = apply_year_offset_to_nfl_weeks({
        nfl_weeks: input,
        year_offset: null
      })
      expect(result).to.deep.equal(input)
    })

    it('filters out years below 2000', () => {
      const result = apply_year_offset_to_nfl_weeks({
        nfl_weeks: ['2001_REG_WEEK_1'],
        year_offset: [-5, 0]
      })
      expect(result).to.include('2000_REG_WEEK_1')
      expect(result).to.include('2001_REG_WEEK_1')
      expect(result).to.not.include('1999_REG_WEEK_1')
    })

    it('deduplicates expanded values', () => {
      const result = apply_year_offset_to_nfl_weeks({
        nfl_weeks: ['2024_REG_WEEK_5', '2024_REG_WEEK_5'],
        year_offset: [0, 0]
      })
      expect(result).to.have.length(1)
    })

    it('handles multiple weeks with offset', () => {
      const result = apply_year_offset_to_nfl_weeks({
        nfl_weeks: ['2024_REG_WEEK_5', '2024_REG_WEEK_6'],
        year_offset: [-1, 0]
      })
      expect(result).to.have.length(4)
      expect(result).to.include('2023_REG_WEEK_5')
      expect(result).to.include('2024_REG_WEEK_5')
      expect(result).to.include('2023_REG_WEEK_6')
      expect(result).to.include('2024_REG_WEEK_6')
    })
  })

  describe('decompose_nfl_weeks', function () {
    it('extracts unique years, weeks, and seas_types', () => {
      const result = decompose_nfl_weeks({
        nfl_weeks: ['2024_REG_WEEK_5', '2020_REG_WEEK_6', '2019_POST_WEEK_1']
      })
      expect(result.years).to.have.members([2024, 2020, 2019])
      expect(result.weeks).to.have.members([5, 6, 1])
      expect(result.seas_types).to.have.members(['REG', 'POST'])
    })

    it('deduplicates values', () => {
      const result = decompose_nfl_weeks({
        nfl_weeks: ['2024_REG_WEEK_5', '2024_REG_WEEK_6']
      })
      expect(result.years).to.deep.equal([2024])
      expect(result.seas_types).to.deep.equal(['REG'])
    })

    it('handles empty array', () => {
      const result = decompose_nfl_weeks({ nfl_weeks: [] })
      expect(result.years).to.deep.equal([])
      expect(result.weeks).to.deep.equal([])
      expect(result.seas_types).to.deep.equal([])
    })

    it('skips invalid identifiers', () => {
      const result = decompose_nfl_weeks({
        nfl_weeks: ['2024_REG_WEEK_5', 'invalid']
      })
      expect(result.years).to.deep.equal([2024])
      expect(result.weeks).to.deep.equal([5])
    })
  })
})
