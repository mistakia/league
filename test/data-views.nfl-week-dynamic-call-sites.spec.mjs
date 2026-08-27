/* global describe, it, afterEach */

import * as chai from 'chai'
import MockDate from 'mockdate'

import { current_season } from '#constants'
import { process_params_with_backwards_compatibility } from '#libs-server/get-data-view-results.mjs'
import resolve_single_nfl_week_id from '#libs-server/data-views/resolve-single-nfl-week-id.mjs'
import { nfl_week_id as nfl_week_id_param } from '#libs-shared/common-column-params.mjs'
import { set_date_for_week } from './fixtures/postseason.mjs'

const expect = chai.expect

const set_offseason_date = () =>
  set_date_for_week({ seas_type: 'PRE', week: 0 })

// The four resolvers were near-copies of one switch and had already drifted.
// These assert at the CALL SITES rather than at the shared module, so they are
// runnable against the pre-consolidation tree and go red there.

describe('data-views nfl_week dynamic call sites', function () {
  afterEach(() => {
    MockDate.reset()
  })

  it('the server expander anchors current_year_reg_weeks on the current season', function () {
    set_offseason_date()
    const params = process_params_with_backwards_compatibility({
      nfl_week_id: [{ dynamic_type: 'current_year_reg_weeks' }]
    })
    expect(params.nfl_week_id.length).to.be.at.least(17)
    expect(
      params.nfl_week_id.every((id) =>
        id.startsWith(`${current_season.year}_REG_`)
      )
    ).to.equal(true)
  })

  it('the server expander anchors last_n_nfl_years on the last completed season', function () {
    set_offseason_date()
    const params = process_params_with_backwards_compatibility({
      nfl_week_id: [{ dynamic_type: 'last_n_nfl_years', value: 2 }]
    })
    const years = new Set(
      params.nfl_week_id.map((id) => parseInt(id.slice(0, 4), 10))
    )
    expect(years.has(current_season.year)).to.equal(false)
    expect(years.has(current_season.last_completed_season_year)).to.equal(true)
  })

  it('the server expander throws on an unknown dynamic type', function () {
    expect(() =>
      process_params_with_backwards_compatibility({
        nfl_week_id: [{ dynamic_type: 'bogus_never_handled' }]
      })
    ).to.throw(/unknown dynamic_type/)
  })

  it('the single-week resolver understands more than current_nfl_week', function () {
    set_offseason_date()
    const resolved = resolve_single_nfl_week_id({
      params: {
        single_nfl_week_id: [{ dynamic_type: 'last_completed_nfl_week' }]
      }
    })
    expect(resolved).to.equal(`${current_season.year - 1}_POST_WEEK_4`)
  })

  it('the current_week dynamic clamps the way its own param default does', function () {
    set_offseason_date()
    const params = process_params_with_backwards_compatibility({
      single_week: [{ dynamic_type: 'current_week' }]
    })
    // Week 0 is the season-long slot, not a week. The param default is
    // Math.max(current_season.week, 1) and the dynamic returned the raw 0, so
    // the two selected different rows for the whole offseason.
    expect(params.single_week).to.deep.equal([1])
  })

  it('the filter chip label agrees with the resolved span', function () {
    set_offseason_date()
    const label = nfl_week_id_param.format_value({
      value: [{ dynamic_type: 'last_n_nfl_years', value: 3 }],
      def: nfl_week_id_param
    })
    const anchor = current_season.last_completed_season_year
    expect(label).to.equal(`${anchor - 2}-${anchor} PRE/REG/POST`)
  })
})
