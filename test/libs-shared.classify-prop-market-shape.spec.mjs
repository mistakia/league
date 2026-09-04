/* global describe it */
import * as chai from 'chai'

import { classify_prop_market_shape } from '#libs-shared/classify-prop-market-shape.mjs'
import {
  ladder_market_types,
  yes_no_market_types
} from '#libs-shared/bookmaker-constants.mjs'

const expect = chai.expect

// Every assertion below names the value the classifier must NOT return as well
// as the one it must. That is deliberate: a function returning a single
// constant satisfies a suite of bare equality assertions for whichever shape
// that constant happens to be, and the defects being fixed here are all
// misclassifications rather than crashes.
describe('libs-shared classify_prop_market_shape', function () {
  describe('the defects this replaces', function () {
    it('classifies an occurrence market by its type, not by whether it has a line', function () {
      // The defect: `has_line` was derived from any non-null
      // selection_metric_line, and every yes_no_market_types member carries
      // one -- ANYTIME_TOUCHDOWN at 0.5 on nearly every row. That routed them
      // onto the two-axis over/under chart.
      const shape = classify_prop_market_shape({
        market_type: 'ANYTIME_TOUCHDOWN',
        selection_metric_line: 0.5
      })
      expect(shape).to.equal('occurrence')
      expect(shape).to.not.equal('single_line')
    })

    it('classifies a ladder whose type does not contain ALT', function () {
      // The defect: `market_name.includes('ALT')` as the ladder test. This
      // case is live rather than hypothetical -- the taxonomy work widened
      // ladder_market_types to include four non-ALT types, so the substring
      // test and the canonical set disagree on this one today.
      expect(ladder_market_types.has('GAME_PASSING_RUSHING_YARDS')).to.equal(
        true
      )
      expect('GAME_PASSING_RUSHING_YARDS'.includes('ALT')).to.equal(false)

      const shape = classify_prop_market_shape({
        market_type: 'GAME_PASSING_RUSHING_YARDS',
        selection_metric_line: 250.5
      })
      expect(shape).to.equal('ladder')
      expect(shape).to.not.equal('single_line')
    })

    it('does not classify an ALT-named type outside the ladder set as a ladder', function () {
      // The mirror of the case above. GAME_ALT_SPREAD reaches the player tab
      // carrying a selection_pid and contains ALT, but ladder_market_types is
      // scoped to player props and excludes it.
      expect(ladder_market_types.has('GAME_ALT_SPREAD')).to.equal(false)

      const shape = classify_prop_market_shape({
        market_type: 'GAME_ALT_SPREAD',
        selection_metric_line: -3.5
      })
      expect(shape).to.equal('single_line')
      expect(shape).to.not.equal('ladder')
    })
  })

  describe('the shapes with no line', function () {
    it('separates a typed market with no line from an untyped one', function () {
      // These two were one undifferentiated fall-through before. A moneyline
      // market has a type and no line and renders on odds alone; an untyped
      // market cannot be rendered or graded at all, and saying so is the
      // point.
      const no_line = classify_prop_market_shape({
        market_type: 'GAME_MONEYLINE',
        selection_metric_line: null
      })
      expect(no_line).to.equal('no_line')
      expect(no_line).to.not.equal('untyped')

      const untyped = classify_prop_market_shape({
        market_type: null,
        selection_metric_line: null
      })
      expect(untyped).to.equal('untyped')
      expect(untyped).to.not.equal('no_line')
    })

    it('treats an untyped market as untyped even when it carries a line', function () {
      // 38.4 percent of 2025 player markets are untyped, and many carry a
      // line. Reading the line first would classify them single_line and
      // promise a rendering the data cannot support.
      const shape = classify_prop_market_shape({
        market_type: null,
        selection_metric_line: 62.5
      })
      expect(shape).to.equal('untyped')
      expect(shape).to.not.equal('single_line')
    })

    it('treats an undefined line the same as a null one', function () {
      expect(
        classify_prop_market_shape({ market_type: 'GAME_MONEYLINE' })
      ).to.equal('no_line')
    })
  })

  describe('the canonical sets are read, not restated', function () {
    it('classifies every yes_no_market_types member as occurrence', function () {
      // A negative control against the set being read at all: if the
      // classifier restated its own list, widening bookmaker-constants would
      // silently stop reaching it. Iterating the live set means a member added
      // there and missed here fails.
      for (const market_type of yes_no_market_types) {
        expect(
          classify_prop_market_shape({
            market_type,
            selection_metric_line: 0.5
          })
        ).to.equal('occurrence', `${market_type} should classify as occurrence`)
      }
    })

    it('classifies every ladder_market_types member as ladder', function () {
      for (const market_type of ladder_market_types) {
        expect(
          classify_prop_market_shape({
            market_type,
            selection_metric_line: 50.5
          })
        ).to.equal('ladder', `${market_type} should classify as ladder`)
      }
    })

    it('has non-empty sets to iterate', function () {
      // Guards the two loops above: both pass vacuously against an empty set,
      // which is what an import resolving to undefined would produce.
      expect(yes_no_market_types.size).to.be.greaterThan(0)
      expect(ladder_market_types.size).to.be.greaterThan(0)
    })
  })
})
