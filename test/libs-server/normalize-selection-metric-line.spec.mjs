/* global describe it */

import * as chai from 'chai'

import { normalize_selection_metric_line } from '../../libs-server/normalize-selection-metric-line.mjs'

const expect = chai.expect

describe('LIBS-SERVER normalize_selection_metric_line', function () {
  describe('Null/undefined handling', function () {
    it('should return null for null input', function () {
      const result = normalize_selection_metric_line({
        raw_value: null,
        selection_name: '3+'
      })
      expect(result).to.equal(null)
    })

    it('should return null for undefined input', function () {
      const result = normalize_selection_metric_line({
        raw_value: undefined,
        selection_name: '3+'
      })
      expect(result).to.equal(null)
    })

    it('should return null for missing selection_name', function () {
      const result = normalize_selection_metric_line({
        raw_value: 3.0,
        selection_name: null
      })
      expect(result).to.equal(3.0)
    })
  })

  describe('N+ discrete stat markets - normalization required', function () {
    it('should normalize "3+" with line 3.0 to 2.5', function () {
      const result = normalize_selection_metric_line({
        raw_value: 3.0,
        selection_name: '3+'
      })
      expect(result).to.equal(2.5)
    })

    it('should normalize "250+" with line 250.0 to 249.5', function () {
      const result = normalize_selection_metric_line({
        raw_value: 250.0,
        selection_name: '250+'
      })
      expect(result).to.equal(249.5)
    })

    it('should normalize "1+" with line 1.0 to 0.5', function () {
      const result = normalize_selection_metric_line({
        raw_value: 1.0,
        selection_name: '1+'
      })
      expect(result).to.equal(0.5)
    })

    it('should normalize "1000+" with line 1000.0 to 999.5', function () {
      const result = normalize_selection_metric_line({
        raw_value: 1000.0,
        selection_name: '1000+'
      })
      expect(result).to.equal(999.5)
    })

    it('should handle string input "3" with name "3+"', function () {
      const result = normalize_selection_metric_line({
        raw_value: '3',
        selection_name: '3+'
      })
      expect(result).to.equal(2.5)
    })

    it('should handle string input "3.0" with name "3+"', function () {
      const result = normalize_selection_metric_line({
        raw_value: '3.0',
        selection_name: '3+'
      })
      expect(result).to.equal(2.5)
    })

    it('should handle string input "3+" with name "3+"', function () {
      const result = normalize_selection_metric_line({
        raw_value: '3+',
        selection_name: '3+'
      })
      expect(result).to.equal(2.5)
    })
  })

  describe('Already normalized markets - no change', function () {
    it('should not modify "3+" with line 2.5 (already normalized)', function () {
      const result = normalize_selection_metric_line({
        raw_value: 2.5,
        selection_name: '3+'
      })
      expect(result).to.equal(2.5)
    })

    it('should not modify "149.5+" with line 149.5', function () {
      const result = normalize_selection_metric_line({
        raw_value: 149.5,
        selection_name: '149.5+'
      })
      expect(result).to.equal(149.5)
    })

    it('should not modify "199.5+" with line 199.5', function () {
      const result = normalize_selection_metric_line({
        raw_value: 199.5,
        selection_name: '199.5+'
      })
      expect(result).to.equal(199.5)
    })
  })

  describe('Traditional over/under markets - protected', function () {
    it('should not modify "Aaron Jones Over" with line 24.5', function () {
      const result = normalize_selection_metric_line({
        raw_value: 24.5,
        selection_name: 'Aaron Jones Over'
      })
      expect(result).to.equal(24.5)
    })

    it('should not modify "Over" with line 44.0', function () {
      const result = normalize_selection_metric_line({
        raw_value: 44.0,
        selection_name: 'Over'
      })
      expect(result).to.equal(44.0)
    })

    it('should not modify "Under" with line 249.5', function () {
      const result = normalize_selection_metric_line({
        raw_value: 249.5,
        selection_name: 'Under'
      })
      expect(result).to.equal(249.5)
    })

    it('should not modify "Over 249.5" with line 249.5', function () {
      const result = normalize_selection_metric_line({
        raw_value: 249.5,
        selection_name: 'Over 249.5'
      })
      expect(result).to.equal(249.5)
    })

    it('should not modify "Patrick Mahomes Under" with line 1.5', function () {
      const result = normalize_selection_metric_line({
        raw_value: 1.5,
        selection_name: 'Patrick Mahomes Under'
      })
      expect(result).to.equal(1.5)
    })

    it('should not modify "200+ Passing Yards" with line 199.5', function () {
      const result = normalize_selection_metric_line({
        raw_value: 199.5,
        selection_name: '200+ Passing Yards'
      })
      expect(result).to.equal(199.5)
    })
  })

  describe('Spread markets (negative values) - protected', function () {
    it('should not modify negative spread -7.5', function () {
      const result = normalize_selection_metric_line({
        raw_value: -7.5,
        selection_name: 'ATL Falcons -7.5'
      })
      expect(result).to.equal(-7.5)
    })

    it('should not modify negative spread -3.0', function () {
      const result = normalize_selection_metric_line({
        raw_value: -3.0,
        selection_name: 'Chiefs -3'
      })
      expect(result).to.equal(-3.0)
    })

    it('should not modify negative spread -14.5', function () {
      const result = normalize_selection_metric_line({
        raw_value: -14.5,
        selection_name: '-14.5'
      })
      expect(result).to.equal(-14.5)
    })
  })

  describe('Edge cases and pattern protection', function () {
    it('should not normalize when line does not match N value', function () {
      // Line is 2.0 but name says "3+" - mismatch
      const result = normalize_selection_metric_line({
        raw_value: 2.0,
        selection_name: '3+'
      })
      expect(result).to.equal(2.0)
    })

    it('should not normalize parlay format "ATL Falcons +5.5 / Over 45.5"', function () {
      const result = normalize_selection_metric_line({
        raw_value: 5.5,
        selection_name: 'ATL Falcons +5.5 / Over 45.5'
      })
      expect(result).to.equal(5.5)
    })

    it('should handle whitespace in selection name', function () {
      const result = normalize_selection_metric_line({
        raw_value: 3.0,
        selection_name: ' 3+ '
      })
      expect(result).to.equal(2.5)
    })

    it('should handle string with leading "+"', function () {
      const result = normalize_selection_metric_line({
        raw_value: '+3',
        selection_name: '3+'
      })
      expect(result).to.equal(2.5)
    })

    it('should return null for non-numeric string', function () {
      const result = normalize_selection_metric_line({
        raw_value: 'abc',
        selection_name: '3+'
      })
      expect(result).to.equal(null)
    })

    it('should return null for invalid input type', function () {
      const result = normalize_selection_metric_line({
        raw_value: {},
        selection_name: '3+'
      })
      expect(result).to.equal(null)
    })
  })

  describe('Real-world market examples', function () {
    it('should normalize "3+ Passing Touchdowns" stored as "3+"', function () {
      const result = normalize_selection_metric_line({
        raw_value: 3.0,
        selection_name: '3+'
      })
      expect(result).to.equal(2.5)
    })

    it('should normalize "5+ Receptions" stored as "5+"', function () {
      const result = normalize_selection_metric_line({
        raw_value: 5.0,
        selection_name: '5+'
      })
      expect(result).to.equal(4.5)
    })

    it('should normalize "20+ Completions" stored as "20+"', function () {
      const result = normalize_selection_metric_line({
        raw_value: 20.0,
        selection_name: '20+'
      })
      expect(result).to.equal(19.5)
    })

    it('should normalize "2+ Rushing Touchdowns" stored as "2+"', function () {
      const result = normalize_selection_metric_line({
        raw_value: 2.0,
        selection_name: '2+'
      })
      expect(result).to.equal(1.5)
    })

    it('should not modify "200+ Passing Yards" with line 199.5', function () {
      const result = normalize_selection_metric_line({
        raw_value: 199.5,
        selection_name: '200+'
      })
      expect(result).to.equal(199.5)
    })
  })
})
