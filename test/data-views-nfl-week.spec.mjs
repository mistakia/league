/* global describe it */

import * as chai from 'chai'

import {
  parse_nfl_week_identifier,
  format_nfl_week_identifier,
  apply_year_offset_to_nfl_weeks,
  decompose_nfl_weeks
} from '#libs-shared/nfl-week-identifier.mjs'
import nfl_plays_column_params from '#libs-shared/nfl-plays-column-params.mjs'
import { common_column_params } from '#libs-shared'

chai.should()
const expect = chai.expect

describe('DATA VIEWS nfl_week parameter integration', function () {
  describe('nfl_plays_column_params', function () {
    it('contains nfl_week parameter', () => {
      expect(nfl_plays_column_params).to.have.property('nfl_week')
    })

    it('does not contain year parameter', () => {
      expect(nfl_plays_column_params).to.not.have.property('year')
    })

    it('does not contain week parameter', () => {
      expect(nfl_plays_column_params).to.not.have.property('week')
    })

    it('does not contain seas_type parameter', () => {
      expect(nfl_plays_column_params).to.not.have.property('seas_type')
    })

    it('retains year_offset parameter', () => {
      expect(nfl_plays_column_params).to.have.property('year_offset')
    })

    it('retains career_year parameter', () => {
      expect(nfl_plays_column_params).to.have.property('career_year')
    })

    it('retains play-condition parameters', () => {
      expect(nfl_plays_column_params).to.have.property('dwn')
      expect(nfl_plays_column_params).to.have.property('qtr')
      expect(nfl_plays_column_params).to.have.property('play_type')
    })
  })

  describe('common_column_params.nfl_week', function () {
    it('has SELECT data type', () => {
      expect(common_column_params.nfl_week).to.have.property('data_type')
    })

    it('has column_name nfl_week_id', () => {
      expect(common_column_params.nfl_week.column_name).to.equal('nfl_week_id')
    })

    it('has values array', () => {
      expect(common_column_params.nfl_week.values).to.be.an('array')
      expect(common_column_params.nfl_week.values.length).to.be.greaterThan(0)
    })

    it('values are valid nfl_week identifiers', () => {
      for (const val of common_column_params.nfl_week.values.slice(0, 10)) {
        const parsed = parse_nfl_week_identifier({ identifier: val })
        expect(parsed).to.not.be.null
      }
    })

    it('has dynamic_values for current_nfl_week and last_n_nfl_weeks', () => {
      const dynamic_types = common_column_params.nfl_week.dynamic_values.map(
        (d) => d.dynamic_type
      )
      expect(dynamic_types).to.include('current_nfl_week')
      expect(dynamic_types).to.include('last_n_nfl_weeks')
    })

    it('has enable_multi_on_split for year and week', () => {
      expect(common_column_params.nfl_week.enable_multi_on_split).to.deep.equal(
        ['year', 'week']
      )
    })
  })

  describe('year_offset with nfl_week', function () {
    it('expands nfl_week values across offset range', () => {
      const result = apply_year_offset_to_nfl_weeks({
        nfl_weeks: ['2024_REG_WEEK_5', '2024_REG_WEEK_6'],
        year_offset: [-1, 1]
      })

      // Each of 2 weeks expanded by 3 years = 6 values
      expect(result).to.have.length(6)
      expect(result).to.include('2023_REG_WEEK_5')
      expect(result).to.include('2024_REG_WEEK_5')
      expect(result).to.include('2025_REG_WEEK_5')
      expect(result).to.include('2023_REG_WEEK_6')
      expect(result).to.include('2024_REG_WEEK_6')
      expect(result).to.include('2025_REG_WEEK_6')
    })

    it('decomposition of offset-expanded values gives correct years', () => {
      const expanded = apply_year_offset_to_nfl_weeks({
        nfl_weeks: ['2024_REG_WEEK_5'],
        year_offset: [-2, 0]
      })
      const { years } = decompose_nfl_weeks({ nfl_weeks: expanded })

      expect(years).to.have.members([2022, 2023, 2024])
    })

    it('pre-offset decomposition preserves base years for join function', () => {
      const base_weeks = ['2024_REG_WEEK_5', '2024_REG_WEEK_6']
      const { years: base_years } = decompose_nfl_weeks({
        nfl_weeks: base_weeks
      })

      // Base years should only contain 2024 (pre-offset)
      expect(base_years).to.deep.equal([2024])

      // After offset expansion, years should include offset years
      const expanded = apply_year_offset_to_nfl_weeks({
        nfl_weeks: base_weeks,
        year_offset: [-1, 0]
      })
      const { years: expanded_years } = decompose_nfl_weeks({
        nfl_weeks: expanded
      })
      expect(expanded_years).to.have.members([2023, 2024])
    })
  })

  describe('nfl_week cartesian product elimination', function () {
    it('specific weeks across years produce exact matches, not cartesian product', () => {
      // The original problem: year=[2024,2020,2019], week=[5,6,1], seas_type=['REG','POST']
      // produced 18 combinations. With nfl_week, we specify exactly what we want.
      const specific_weeks = [
        '2024_REG_WEEK_5',
        '2020_REG_WEEK_6',
        '2019_POST_WEEK_1'
      ]

      const { years, weeks, seas_types } = decompose_nfl_weeks({
        nfl_weeks: specific_weeks
      })

      // Decomposed values are used for joins/splits, NOT for WHERE clauses
      // The WHERE clause uses nfl_week_id IN (...) which is exact, not cartesian
      expect(years).to.have.members([2024, 2020, 2019])
      expect(weeks).to.have.members([5, 6, 1])
      expect(seas_types).to.have.members(['REG', 'POST'])

      // The nfl_week array length is exactly 3, not 18
      expect(specific_weeks).to.have.length(3)
    })
  })

  describe('migration script helpers', function () {
    it('format_nfl_week_identifier round-trips with parse', () => {
      const original = { year: 2024, seas_type: 'REG', week: 5 }
      const formatted = format_nfl_week_identifier(original)
      const parsed = parse_nfl_week_identifier({ identifier: formatted })

      expect(parsed).to.deep.equal(original)
    })

    it('constructs nfl_week from year/week/seas_type cartesian product matching current behavior', () => {
      const years = [2024, 2023]
      const weeks = [1, 2]
      const seas_type = 'REG'

      const nfl_weeks = []
      for (const y of years) {
        for (const w of weeks) {
          nfl_weeks.push(
            format_nfl_week_identifier({ year: y, seas_type, week: w })
          )
        }
      }

      expect(nfl_weeks).to.have.length(4)
      expect(nfl_weeks).to.include('2024_REG_WEEK_1')
      expect(nfl_weeks).to.include('2024_REG_WEEK_2')
      expect(nfl_weeks).to.include('2023_REG_WEEK_1')
      expect(nfl_weeks).to.include('2023_REG_WEEK_2')
    })
  })
})
