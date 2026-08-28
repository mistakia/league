/* global describe, it, afterEach */

import * as chai from 'chai'
import MockDate from 'mockdate'

import { current_season } from '#constants'
import {
  resolve_nfl_week_dynamic_value,
  format_nfl_week_identifiers_label,
  NFL_WEEK_DYNAMIC_TYPES
} from '#libs-shared/nfl-week-dynamic-values.mjs'
import { set_date_for_week } from './fixtures/postseason.mjs'

const expect = chai.expect

const set_offseason_date = () =>
  set_date_for_week({ seas_type: 'PRE', week: 0 })

describe('LIBS-SHARED nfl-week dynamic values', function () {
  afterEach(() => {
    MockDate.reset()
  })

  describe('anchors', function () {
    it('current_year_reg_weeks names the CURRENT season, not the last completed one', function () {
      set_offseason_date()
      const resolved = resolve_nfl_week_dynamic_value({
        dynamic_type: 'current_year_reg_weeks'
      })
      expect(resolved.length).to.be.at.least(17)
      expect(
        resolved.every((id) => id.startsWith(`${current_season.year}_REG_`))
      ).to.equal(true)
    })

    it('last_n_nfl_years is retrospective, anchored on the last completed season', function () {
      set_offseason_date()
      const resolved = resolve_nfl_week_dynamic_value({
        dynamic_type: 'last_n_nfl_years',
        value: 3
      })
      const years = new Set(resolved.map((id) => parseInt(id.slice(0, 4), 10)))
      const anchor = current_season.last_completed_season_year
      expect([...years].sort()).to.deep.equal([anchor - 2, anchor - 1, anchor])
      // The disagreement this resolves: the server anchored on the current
      // season while the client notice anchored here, so the two named
      // different spans for the whole offseason.
      expect(years.has(current_season.year)).to.equal(false)
    })

    it('current_nfl_week and last_completed_nfl_week are a season apart in the offseason', function () {
      set_offseason_date()
      const [current] = resolve_nfl_week_dynamic_value({
        dynamic_type: 'current_nfl_week'
      })
      const [last_completed] = resolve_nfl_week_dynamic_value({
        dynamic_type: 'last_completed_nfl_week'
      })
      expect(current).to.equal(`${current_season.year}_REG_WEEK_1`)
      expect(last_completed).to.equal(`${current_season.year - 1}_POST_WEEK_4`)
    })

    it('last_n_nfl_weeks walks back across the season boundary', function () {
      set_offseason_date()
      const resolved = resolve_nfl_week_dynamic_value({
        dynamic_type: 'last_n_nfl_weeks',
        value: 5
      })
      expect(resolved).to.have.lengthOf(5)
      expect(new Set(resolved).size).to.equal(5)
    })
  })

  describe('unknown types', function () {
    // The throw is what converts the landmine from a silent performance cliff
    // into a loud failure. An unresolvable dynamic used to answer an empty list
    // while still reading as an explicit time scope, which leaves the row axis
    // unbounded -- a 13M-row fan-out with a correct-looking result set.
    it('throws rather than answering an empty list', function () {
      expect(() =>
        resolve_nfl_week_dynamic_value({ dynamic_type: 'bogus_never_handled' })
      ).to.throw(/unknown dynamic_type/)
    })

    it('throws on a missing dynamic_type', function () {
      expect(() => resolve_nfl_week_dynamic_value({})).to.throw(
        /unknown dynamic_type/
      )
    })

    it('resolves every type in the declared vocabulary', function () {
      set_offseason_date()
      // Denominator asserted: a vocabulary that silently shrank to zero would
      // make this loop pass over nothing.
      expect(NFL_WEEK_DYNAMIC_TYPES.length).to.be.at.least(5)
      for (const dynamic_type of NFL_WEEK_DYNAMIC_TYPES) {
        const resolved = resolve_nfl_week_dynamic_value({ dynamic_type })
        expect(resolved, dynamic_type).to.be.an('array')
        expect(resolved.length, dynamic_type).to.be.at.least(1)
      }
    })

    // The vocabulary is DERIVED from the resolver map rather than restated
    // beside it. When the two were separate, they could only disagree in one
    // direction -- adding a case and forgetting the array left the new type
    // unexercised by the loop above, silently, while the reverse threw. This
    // asserts the property that makes that impossible.
    it('declares exactly the vocabulary it can resolve', function () {
      set_offseason_date()
      for (const dynamic_type of NFL_WEEK_DYNAMIC_TYPES) {
        expect(
          () => resolve_nfl_week_dynamic_value({ dynamic_type }),
          dynamic_type
        ).to.not.throw()
      }
      // Inherited Object members must not read as declared vocabulary.
      for (const inherited of ['toString', 'constructor', 'hasOwnProperty']) {
        expect(NFL_WEEK_DYNAMIC_TYPES, inherited).to.not.include(inherited)
        expect(
          () => resolve_nfl_week_dynamic_value({ dynamic_type: inherited }),
          inherited
        ).to.throw(/unknown dynamic_type/)
      }
    })
  })

  describe('the shared label', function () {
    it('enumerates a short list exactly', function () {
      set_date_for_week({ seas_type: 'REG', week: 6 })
      const nfl_weeks = resolve_nfl_week_dynamic_value({
        dynamic_type: 'last_n_nfl_weeks',
        value: 3
      })
      expect(format_nfl_week_identifiers_label({ nfl_weeks })).to.equal(
        `${current_season.year} REG: 4-6`
      )
    })

    it('summarizes a long one', function () {
      set_offseason_date()
      const nfl_weeks = resolve_nfl_week_dynamic_value({
        dynamic_type: 'last_n_nfl_years',
        value: 3
      })
      const anchor = current_season.last_completed_season_year
      expect(format_nfl_week_identifiers_label({ nfl_weeks })).to.equal(
        `${anchor - 2}-${anchor} PRE/REG/POST`
      )
    })

    it('answers empty for an empty list', function () {
      expect(format_nfl_week_identifiers_label({ nfl_weeks: [] })).to.equal('')
    })
  })
})
