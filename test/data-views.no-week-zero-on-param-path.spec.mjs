/* global describe, it, afterEach */

import * as chai from 'chai'
import MockDate from 'mockdate'

import { current_season } from '#constants'
import {
  resolve_week_dynamic_value,
  format_week_dynamic_label,
  WEEK_DYNAMIC_TYPES,
  MIN_WEEK
} from '#libs-shared/week-dynamic-values.mjs'
import { week, single_week } from '#libs-shared/common-column-params.mjs'
import { process_params_with_backwards_compatibility } from '#libs-server/get-data-view-results.mjs'
import { set_date_for_week } from './fixtures/postseason.mjs'

const expect = chai.expect

// The offseason clock is the one that matters: it is the only period where the
// raw counter is 0, and it is six months of the year.
const CLOCKS = {
  offseason: () => set_date_for_week({ seas_type: 'PRE', week: 0 }),
  'regular season': () => set_date_for_week({ seas_type: 'REG', week: 6 }),
  postseason: () => set_date_for_week({ seas_type: 'POST', week: 2 })
}

describe('DATA VIEWS no week zero on the param path', function () {
  afterEach(() => {
    MockDate.reset()
  })

  // POPULATION level, not sampled. The failure mode this exists for is a
  // producer nobody enumerated, so the sweep has to be exhaustive over the
  // declared vocabulary and say how much it examined.
  it('no declared week dynamic resolves below 1, under any clock', function () {
    expect(WEEK_DYNAMIC_TYPES.length, 'vocabulary').to.be.at.least(3)

    let checked = 0
    for (const [clock_name, set_clock] of Object.entries(CLOCKS)) {
      set_clock()
      for (const dynamic_type of WEEK_DYNAMIC_TYPES) {
        for (const value of [undefined, 1, 3, 5, 20]) {
          const weeks = resolve_week_dynamic_value({ dynamic_type, value })
          expect(weeks, `${clock_name} / ${dynamic_type}`).to.be.an('array')
          for (const w of weeks) {
            expect(
              w,
              `${clock_name} / ${dynamic_type} / value=${value} resolved week ${w}`
            ).to.be.at.least(MIN_WEEK)
          }
          checked += 1
        }
      }
      MockDate.reset()
    }

    // The denominator. A loop that stops iterating reports a confident zero
    // violations, which is indistinguishable from compliance.
    expect(checked, 'resolutions examined').to.equal(
      Object.keys(CLOCKS).length * WEEK_DYNAMIC_TYPES.length * 5
    )
  })

  // The offseason leg specifically, pinned as values rather than as a bound --
  // a bound of ">= 1" is satisfied by a resolver that returns 1 for everything.
  it('resolves the offseason to real weeks, discriminating between types', function () {
    CLOCKS.offseason()
    expect(current_season.week).to.equal(0)

    expect(
      resolve_week_dynamic_value({ dynamic_type: 'current_week' })
    ).to.deep.equal([1])
    expect(
      resolve_week_dynamic_value({ dynamic_type: 'last_n_weeks', value: 3 })
    ).to.deep.equal([1, 1, 1])
    expect(
      resolve_week_dynamic_value({ dynamic_type: 'next_n_weeks', value: 3 })
    ).to.deep.equal([2, 3, 4])
  })

  // Both PARAMS through the real server entry point. These are the two
  // producers that could put a 0 into params.week.
  it('neither week param produces a zero through the server resolver', function () {
    for (const [clock_name, set_clock] of Object.entries(CLOCKS)) {
      set_clock()

      for (const dv of week.dynamic_values) {
        const resolved = process_params_with_backwards_compatibility({
          week: [{ dynamic_type: dv.dynamic_type, value: dv.default_value }]
        }).week
        expect(resolved, `${clock_name} / week / ${dv.dynamic_type}`).to.be.an(
          'array'
        )
        expect(resolved.length).to.be.at.least(1)
        for (const w of resolved) {
          expect(w, `${clock_name} / week / ${dv.dynamic_type}`).to.be.at.least(
            MIN_WEEK
          )
        }
      }

      for (const dv of single_week.dynamic_values) {
        const resolved = process_params_with_backwards_compatibility({
          single_week: [{ dynamic_type: dv.dynamic_type }]
        }).single_week
        expect(
          resolved[0],
          `${clock_name} / single_week / ${dv.dynamic_type}`
        ).to.be.at.least(MIN_WEEK)
      }

      MockDate.reset()
    }
  })

  // The twins, stated as the property that they agree. They diverged for the
  // whole offseason: the multi param answered the raw 0 and single_week
  // answered 1, from two copies of one switch.
  it('the week and single_week current_week dynamics agree', function () {
    for (const [clock_name, set_clock] of Object.entries(CLOCKS)) {
      set_clock()
      const multi = process_params_with_backwards_compatibility({
        week: [{ dynamic_type: 'current_week' }]
      }).week
      const single = process_params_with_backwards_compatibility({
        single_week: [{ dynamic_type: 'current_week' }]
      }).single_week
      expect(multi, clock_name).to.deep.equal(single)
      MockDate.reset()
    }
  })

  // An explicit numeric 0 is floored rather than carried. No saved view has one
  // -- checked across all 189 -- but an API caller can still send it, and the
  // rule is that a week param holds a real week or nothing.
  it('floors an explicit numeric zero', function () {
    CLOCKS['regular season']()
    const resolved = process_params_with_backwards_compatibility({
      week: [0, 5]
    }).week
    expect(resolved).to.not.include(0)
    expect(resolved).to.include(5)
  })

  // The label is derived from the resolution, so the two cannot disagree. The
  // server floored last_n_weeks at 0 while the label floored at 1, and early in
  // a season the chip named a span the query did not select.
  it('the label agrees with the resolution on last_n_weeks', function () {
    for (const [clock_name, set_clock] of Object.entries(CLOCKS)) {
      set_clock()
      for (const value of [1, 3, 5]) {
        const weeks = resolve_week_dynamic_value({
          dynamic_type: 'last_n_weeks',
          value
        })
        const label = format_week_dynamic_label({
          dynamic_type: 'last_n_weeks',
          value
        })
        const start = Math.min(...weeks)
        const end = Math.max(...weeks)
        const expected = start === end ? `${end}` : `${start}-${end}`
        expect(label, `${clock_name} / last_n_weeks(${value})`).to.equal(
          expected
        )
        // And the label must never name week 0.
        expect(label, `${clock_name} / last_n_weeks(${value})`).to.not.match(
          /(^|-)0($|-)/
        )
      }
      MockDate.reset()
    }
  })

  it('throws on an undeclared week dynamic rather than answering empty', function () {
    CLOCKS.offseason()
    expect(() =>
      resolve_week_dynamic_value({ dynamic_type: 'bogus_never_declared' })
    ).to.throw(/unknown dynamic_type/)
  })
})
