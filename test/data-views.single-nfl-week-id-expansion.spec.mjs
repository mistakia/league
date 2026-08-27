/* global describe, it, afterEach */

import * as chai from 'chai'
import MockDate from 'mockdate'

import { process_params_with_backwards_compatibility } from '#libs-server/get-data-view-results.mjs'
import {
  resolve_nfl_week_ids,
  resolve_explicit_nfl_week_ids
} from '#libs-server/data-views/resolve-single-nfl-week-id.mjs'
import { compute_effective_scope } from '#libs-server/data-views/apply-scope-to-query.mjs'
import { set_date_for_week } from './fixtures/postseason.mjs'

const expect = chai.expect

// `resolve_nfl_week_params` is the one complete expander for the four dynamic
// nfl_week types, and it opened with `if (!params.nfl_week_id) return`. So
// `single_nfl_week_id` never reached it, and the partial resolver it fell
// through to handled `current_nfl_week` alone -- every other declared dynamic
// type resolved to nothing while still READING as an explicit time scope to
// `has_explicit_time_scope`. Presence and resolution disagreed silently in both
// directions, and the shape of the failure is a 13M-row fan-out with a
// correct-looking result set rather than an error.

const expand = (single_nfl_week_id) =>
  process_params_with_backwards_compatibility({ single_nfl_week_id })

describe('data-views single_nfl_week_id dynamic expansion', function () {
  afterEach(() => {
    MockDate.reset()
  })

  it('expands last_n_nfl_weeks to the full requested list', function () {
    set_date_for_week({ seas_type: 'REG', week: 6 })
    const params = expand([{ dynamic_type: 'last_n_nfl_weeks', value: 3 }])
    expect(params.single_nfl_week_id).to.have.lengthOf(3)
    expect(resolve_nfl_week_ids({ params })).to.have.lengthOf(3)
    expect(resolve_explicit_nfl_week_ids({ params })).to.have.lengthOf(3)
  })

  it('expands current_year_reg_weeks to every REG week of the season', function () {
    set_date_for_week({ seas_type: 'REG', week: 6 })
    const params = expand([{ dynamic_type: 'current_year_reg_weeks' }])
    const resolved = resolve_explicit_nfl_week_ids({ params })
    expect(resolved.length).to.be.at.least(17)
    expect(resolved.every((id) => id.includes('_REG_WEEK_'))).to.equal(true)
  })

  it('expands current_nfl_week, the one type that already worked', function () {
    set_date_for_week({ seas_type: 'REG', week: 6 })
    const params = expand([{ dynamic_type: 'current_nfl_week' }])
    expect(resolve_explicit_nfl_week_ids({ params })).to.have.lengthOf(1)
  })

  it('feeds the view-scope reader the same expansion', function () {
    set_date_for_week({ seas_type: 'REG', week: 6 })
    const params = expand([{ dynamic_type: 'last_n_nfl_weeks', value: 4 }])
    // compute_effective_scope intersects a column's declared weeks with the
    // view scope. An unexpanded dynamic contributes zero weeks while still
    // tripping has_explicit_time_scope, which is the silent half of the defect.
    const view_scope = resolve_explicit_nfl_week_ids({ params })
    const scope = compute_effective_scope({
      query_context: { nfl_week_ids: view_scope },
      column_params: params
    })
    expect(scope).to.have.lengthOf(4)
  })

  it('leaves an explicit identifier list untouched', function () {
    const ids = ['2024_REG_WEEK_1', '2024_REG_WEEK_2']
    const params = expand(ids)
    expect(resolve_explicit_nfl_week_ids({ params })).to.deep.equal(ids)
  })

  it('does not decompose onto params.year / week / seas_type', function () {
    // Operator ruling: expand in place. Decomposing changes what every
    // source-attach rule sees for the DFS and betting-market families, and
    // declared_nfl_weeks already supplies those readers what they need.
    set_date_for_week({ seas_type: 'REG', week: 6 })
    const params = expand([{ dynamic_type: 'last_n_nfl_weeks', value: 3 }])
    expect(params.year).to.equal(undefined)
    expect(params.week).to.equal(undefined)
    expect(params.seas_type).to.equal(undefined)
  })
})
