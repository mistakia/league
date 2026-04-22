/* global describe it */

import * as chai from 'chai'

import {
  parse_nfl_week_identifier,
  format_nfl_week_identifier,
  apply_year_offset_to_nfl_weeks,
  decompose_nfl_weeks,
  group_nfl_weeks,
  format_week_ranges,
  get_postseason_week_label,
  get_max_weeks_for_season_type,
  get_all_nfl_week_identifiers
} from '#libs-shared/nfl-week-identifier.mjs'
import nfl_plays_column_params from '#libs-shared/nfl-plays-column-params.mjs'
import { common_column_params } from '#libs-shared'
import resolve_single_nfl_week_id from '#libs-server/data-views/resolve-single-nfl-week-id.mjs'

chai.should()
const expect = chai.expect

describe('DATA VIEWS nfl_week parameter integration', function () {
  describe('nfl_plays_column_params', function () {
    it('contains nfl_week_id parameter', () => {
      expect(nfl_plays_column_params).to.have.property('nfl_week_id')
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

  describe('common_column_params.nfl_week_id', function () {
    it('has SELECT data type', () => {
      expect(common_column_params.nfl_week_id).to.have.property('data_type')
    })

    it('has column_name nfl_week_id', () => {
      expect(common_column_params.nfl_week_id.column_name).to.equal(
        'nfl_week_id'
      )
    })

    it('has values array', () => {
      expect(common_column_params.nfl_week_id.values).to.be.an('array')
      expect(common_column_params.nfl_week_id.values.length).to.be.greaterThan(
        0
      )
    })

    it('values are valid nfl_week identifiers', () => {
      for (const val of common_column_params.nfl_week_id.values.slice(0, 10)) {
        const parsed = parse_nfl_week_identifier({ identifier: val })
        expect(parsed).to.not.be.null
      }
    })

    it('has dynamic_values for current_nfl_week and last_n_nfl_weeks', () => {
      const dynamic_types = common_column_params.nfl_week_id.dynamic_values.map(
        (d) => d.dynamic_type
      )
      expect(dynamic_types).to.include('current_nfl_week')
      expect(dynamic_types).to.include('last_n_nfl_weeks')
    })

    it('has enable_multi_on_split for year and week', () => {
      expect(
        common_column_params.nfl_week_id.enable_multi_on_split
      ).to.deep.equal(['year', 'week'])
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

  describe('common_column_params.nfl_week_id component property', function () {
    it('does not have a component property on the shared definition', () => {
      expect(common_column_params.nfl_week_id).to.not.have.property('component')
    })
  })

  describe('group_nfl_weeks', function () {
    it('groups mixed year/type inputs', () => {
      const result = group_nfl_weeks({
        nfl_weeks: [
          '2024_REG_WEEK_5',
          '2024_REG_WEEK_3',
          '2024_REG_WEEK_1',
          '2023_POST_WEEK_2',
          '2023_POST_WEEK_1'
        ]
      })

      expect(result).to.have.property('2024_REG')
      expect(result['2024_REG']).to.deep.equal([1, 3, 5])
      expect(result).to.have.property('2023_POST')
      expect(result['2023_POST']).to.deep.equal([1, 2])
    })

    it('returns empty object for empty input', () => {
      const result = group_nfl_weeks({ nfl_weeks: [] })
      expect(result).to.deep.equal({})
    })

    it('skips invalid identifiers', () => {
      const result = group_nfl_weeks({
        nfl_weeks: ['2024_REG_WEEK_1', 'invalid', '2024_REG_WEEK_2']
      })
      expect(result['2024_REG']).to.deep.equal([1, 2])
    })
  })

  describe('format_week_ranges', function () {
    it('formats contiguous ranges', () => {
      expect(format_week_ranges({ weeks: [1, 2, 3, 4, 5] })).to.equal('1-5')
    })

    it('formats ranges with gaps', () => {
      expect(format_week_ranges({ weeks: [1, 2, 3, 5, 8, 9, 10] })).to.equal(
        '1-3, 5, 8-10'
      )
    })

    it('formats single values', () => {
      expect(format_week_ranges({ weeks: [3] })).to.equal('3')
    })

    it('formats mixed singles and ranges', () => {
      expect(format_week_ranges({ weeks: [1, 3, 5, 6, 7, 10] })).to.equal(
        '1, 3, 5-7, 10'
      )
    })

    it('returns empty string for empty input', () => {
      expect(format_week_ranges({ weeks: [] })).to.equal('')
    })

    it('handles unsorted input', () => {
      expect(format_week_ranges({ weeks: [5, 1, 3, 2] })).to.equal('1-3, 5')
    })
  })

  describe('get_postseason_week_label', function () {
    it('returns Wild Card for week 1', () => {
      expect(get_postseason_week_label({ week: 1 })).to.equal('Wild Card')
    })

    it('returns Divisional for week 2', () => {
      expect(get_postseason_week_label({ week: 2 })).to.equal('Divisional')
    })

    it('returns Conference for week 3', () => {
      expect(get_postseason_week_label({ week: 3 })).to.equal('Conference')
    })

    it('returns Super Bowl for week 4', () => {
      expect(get_postseason_week_label({ week: 4 })).to.equal('Super Bowl')
    })

    it('returns fallback for unknown week', () => {
      expect(get_postseason_week_label({ week: 5 })).to.equal('Week 5')
    })
  })

  describe('get_max_weeks_for_season_type', function () {
    it('returns 4 for PRE', () => {
      expect(get_max_weeks_for_season_type({ seas_type: 'PRE' })).to.equal(4)
    })

    it('returns 21 for REG', () => {
      expect(get_max_weeks_for_season_type({ seas_type: 'REG' })).to.equal(21)
    })

    it('returns 4 for POST', () => {
      expect(get_max_weeks_for_season_type({ seas_type: 'POST' })).to.equal(4)
    })

    it('returns 0 for unknown type', () => {
      expect(get_max_weeks_for_season_type({ seas_type: 'INVALID' })).to.equal(
        0
      )
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

  describe('get_all_nfl_week_identifiers', function () {
    it('returns identifiers for all years from 2000 to current season', () => {
      const all = get_all_nfl_week_identifiers()
      expect(all).to.be.an('array')
      expect(all.length).to.be.greaterThan(0)

      // Should include identifiers from year 2000
      const has_2000 = all.some((id) => id.startsWith('2000_'))
      expect(has_2000).to.equal(true)

      // All identifiers should be valid
      for (const val of all.slice(0, 20)) {
        const parsed = parse_nfl_week_identifier({ identifier: val })
        expect(parsed).to.not.be.null
      }
    })

    it('includes all 3 season types per year', () => {
      const all = get_all_nfl_week_identifiers()
      const has_pre = all.some((id) => id.includes('_PRE_'))
      const has_reg = all.some((id) => id.includes('_REG_'))
      const has_post = all.some((id) => id.includes('_POST_'))
      expect(has_pre).to.equal(true)
      expect(has_reg).to.equal(true)
      expect(has_post).to.equal(true)
    })

    it('produces 29 identifiers per year (4 PRE + 21 REG + 4 POST)', () => {
      const all = get_all_nfl_week_identifiers()
      const year_2020 = all.filter((id) => id.startsWith('2020_'))
      expect(year_2020).to.have.length(29)
    })
  })

  describe('common_column_params.nfl_week_id default_value', function () {
    it('has a dynamic default_value for current year REG weeks', () => {
      expect(common_column_params.nfl_week_id).to.have.property('default_value')
      expect(common_column_params.nfl_week_id.default_value).to.deep.equal({
        dynamic_type: 'current_year_reg_weeks'
      })
    })
  })

  describe('common_column_params.nfl_week_id dynamic year-range values', function () {
    it('has last_n_nfl_years dynamic value', () => {
      const dynamic_types = common_column_params.nfl_week_id.dynamic_values.map(
        (d) => d.dynamic_type
      )
      expect(dynamic_types).to.include('last_n_nfl_years')
    })

    it('last_n_nfl_years has default_value and has_value_field', () => {
      const dv = common_column_params.nfl_week_id.dynamic_values.find(
        (d) => d.dynamic_type === 'last_n_nfl_years'
      )
      expect(dv).to.have.property('default_value', 3)
      expect(dv).to.have.property('has_value_field', true)
    })
  })

  describe('common_column_params.single_nfl_week_id', function () {
    it('exports a single-valued param keyed to nfl_week_id column', () => {
      expect(common_column_params).to.have.property('single_nfl_week_id')
      const p = common_column_params.single_nfl_week_id
      expect(p.single).to.equal(true)
      expect(p.column_name).to.equal('nfl_week_id')
    })

    it('only exposes current_nfl_week as a dynamic value', () => {
      const types = common_column_params.single_nfl_week_id.dynamic_values.map(
        (d) => d.dynamic_type
      )
      expect(types).to.deep.equal(['current_nfl_week'])
    })

    it('defaults to current_nfl_week', () => {
      expect(
        common_column_params.single_nfl_week_id.default_value
      ).to.deep.equal({ dynamic_type: 'current_nfl_week' })
    })
  })

  describe('resolve_single_nfl_week_id', function () {
    it('returns single_nfl_week_id[0] when present', () => {
      const result = resolve_single_nfl_week_id({
        params: { single_nfl_week_id: ['2024_REG_WEEK_5'] }
      })
      expect(result).to.equal('2024_REG_WEEK_5')
    })

    it('falls back to nfl_week_id[0] if single not set', () => {
      const result = resolve_single_nfl_week_id({
        params: { nfl_week_id: ['2023_POST_WEEK_2', '2023_POST_WEEK_3'] }
      })
      expect(result).to.equal('2023_POST_WEEK_2')
    })

    it('constructs from legacy year/week/seas_type', () => {
      const result = resolve_single_nfl_week_id({
        params: { year: [2022], week: [9], seas_type: ['REG'] }
      })
      expect(result).to.equal(
        format_nfl_week_identifier({ year: 2022, seas_type: 'REG', week: 9 })
      )
    })

    it('defaults legacy seas_type to REG', () => {
      const result = resolve_single_nfl_week_id({
        params: { year: [2021], week: [3] }
      })
      expect(result).to.equal(
        format_nfl_week_identifier({ year: 2021, seas_type: 'REG', week: 3 })
      )
    })

    it('returns null when no params', () => {
      expect(resolve_single_nfl_week_id({ params: {} })).to.equal(null)
    })
  })
})
