/* global describe, it, afterEach */

import * as chai from 'chai'
import MockDate from 'mockdate'

import * as common_column_params from '#libs-shared/common-column-params.mjs'
import { parse_nfl_week_identifier } from '#libs-shared/nfl-week-identifier.mjs'
import { process_params_with_backwards_compatibility } from '#libs-server/get-data-view-results.mjs'
import resolve_single_nfl_week_id, {
  resolve_nfl_week_ids,
  resolve_explicit_nfl_week_ids
} from '#libs-server/data-views/resolve-single-nfl-week-id.mjs'
import { set_date_for_week } from './fixtures/postseason.mjs'

const expect = chai.expect

// THE CONTRACT: every dynamic_type a param DECLARES resolves non-empty through
// every resolver that can receive it.
//
// Declaration-driven on purpose. The defect it exists for is a type that is
// offered in the UI and understood by one resolver but not another: the
// unresolved half contributes zero weeks while the key's PRESENCE still makes
// the column read as explicitly time-scoped, which skips the
// take-view-scope-verbatim early return and leaves the row axis unbounded. That
// is a 13M-row fan-out with a result set that looks correct, so neither review
// nor a golden can see it. Reading the declarations rather than a hand-kept
// list means a dynamic_type added later is covered without touching this file.
//
// Every case runs under three clocks. The offseason is the one that matters --
// it is the only period where the current and last-completed anchors differ,
// and it is six months of the year.

const collect_declarations = () => {
  const out = []
  for (const [param_key, def] of Object.entries(common_column_params)) {
    if (!def || typeof def !== 'object') continue
    if (!Array.isArray(def.dynamic_values)) continue
    for (const dv of def.dynamic_values) {
      out.push({ param_key, def, dynamic_value: dv })
    }
  }
  return out
}

const declarations = collect_declarations()

const nfl_week_param_keys = ['nfl_week_id', 'single_nfl_week_id']

const clocks = {
  offseason: () => set_date_for_week({ seas_type: 'PRE', week: 0 }),
  'regular season': () => set_date_for_week({ seas_type: 'REG', week: 6 }),
  postseason: () => set_date_for_week({ seas_type: 'POST', week: 2 })
}

const build_params = ({ param_key, dynamic_value }) => ({
  [param_key]: [
    {
      dynamic_type: dynamic_value.dynamic_type,
      ...(dynamic_value.default_value != null
        ? { value: dynamic_value.default_value }
        : {})
    }
  ]
})

describe('data-views dynamic param contract', function () {
  afterEach(() => {
    MockDate.reset()
  })

  // The gate asserts its own denominator: a collector that stops matching
  // reports a confident zero, which is indistinguishable from compliance.
  it('finds the declarations it is meant to check', function () {
    expect(declarations.length).to.be.at.least(10)
    const covered_keys = new Set(declarations.map((d) => d.param_key))
    for (const key of nfl_week_param_keys) {
      expect(covered_keys.has(key), key).to.equal(true)
    }
  })

  for (const [clock_name, set_clock] of Object.entries(clocks)) {
    describe(`under the ${clock_name} clock`, function () {
      for (const declaration of declarations) {
        const { param_key, def, dynamic_value } = declaration
        const { dynamic_type } = dynamic_value

        it(`${param_key} / ${dynamic_type} resolves and labels`, function () {
          set_clock()
          const params = process_params_with_backwards_compatibility(
            build_params(declaration)
          )

          const resolved = params[param_key]
          expect(resolved, `${param_key} / ${dynamic_type}`).to.be.an('array')
          expect(
            resolved.length,
            `${param_key} / ${dynamic_type}`
          ).to.be.at.least(1)
          // A resolved entry must be a concrete value, never the dynamic object
          // it came from. An unexpanded object is exactly the shape that reads
          // as scoped and contributes nothing.
          for (const value of resolved) {
            expect(typeof value, `${param_key} / ${dynamic_type}`).to.not.equal(
              'object'
            )
          }

          if (typeof def.format_value === 'function') {
            const label = def.format_value({
              value: build_params(declaration)[param_key],
              def
            })
            expect(label, `${param_key} / ${dynamic_type}`).to.be.a('string')
            expect(
              label.length,
              `${param_key} / ${dynamic_type}`
            ).to.be.at.least(1)
          }
        })

        if (nfl_week_param_keys.includes(param_key)) {
          it(`${param_key} / ${dynamic_type} reaches every nfl_week reader`, function () {
            set_clock()
            const params = process_params_with_backwards_compatibility(
              build_params(declaration)
            )

            const explicit = resolve_explicit_nfl_week_ids({ params })
            expect(
              explicit.length,
              `explicit / ${dynamic_type}`
            ).to.be.at.least(1)

            const list = resolve_nfl_week_ids({ params })
            expect(list.length, `list / ${dynamic_type}`).to.be.at.least(1)

            const scalar = resolve_single_nfl_week_id({ params })
            expect(
              parse_nfl_week_identifier({ identifier: scalar }),
              `scalar / ${dynamic_type}`
            ).to.not.equal(null)
          })
        }
      }
    })
  }

  // The negative control. Without it every assertion above is satisfiable by a
  // resolver that answers a non-empty list for anything at all.
  it('an undeclared dynamic type is refused rather than silently empty', function () {
    set_date_for_week({ seas_type: 'PRE', week: 0 })
    for (const param_key of nfl_week_param_keys) {
      expect(
        () =>
          process_params_with_backwards_compatibility({
            [param_key]: [{ dynamic_type: 'bogus_never_declared' }]
          }),
        param_key
      ).to.throw(/unknown dynamic_type/)
    }
  })
})
