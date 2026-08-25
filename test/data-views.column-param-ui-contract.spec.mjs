/* global describe it */

import * as chai from 'chai'

import { common_column_params } from '#libs-shared'

const expect = chai.expect

// A column param definition is rendered by one of two things, and they read
// DIFFERENT subsets of the definition object.
//
// react-table's column-param-select-filter is the generic renderer and reads
// `single`, `enable_multi_on_split`, `preset_values` and `value_groups`.
// A param that names a custom `component` (bound in
// app/core/data-views-fields/index.js) never reaches that filter at all --
// both param call sites short-circuit on the component, so every key in that
// list is inert on a custom-rendered param.
//
// Neither renderer complains about a key it does not read, so an inert
// declaration looks exactly like a working feature. `enable_multi_on_split`
// sat dead on `nfl_week_id` from 2024 to 2026 with a passing test over it:
// the test asserted the declaration's own value, which stays true no matter
// how thoroughly nothing reads it.
//
// These two checks are the declaration-time gate that would have caught it.
// Both were verified to go red at HEAD before the declarations were removed.

// Params whose `component` is overridden in app/core/data-views-fields/index.js.
const CUSTOM_RENDERED_PARAMS = [
  'nfl_week_id',
  'single_nfl_week_id',
  'as_of_month_day',
  'output'
]

// Keys only react-table's generic select filter reads.
const GENERIC_FILTER_ONLY_KEYS = [
  'single',
  'enable_multi_on_split',
  'preset_values',
  'value_groups'
]

describe('data-views column param UI contract', () => {
  // `enable_multi_on_split` does exactly one thing: it un-sets `single` when a
  // matching row axis is active (react-table's is_single_select). Declared on a
  // param that is not `single` in the first place, it can never change an
  // outcome.
  it('no param declares enable_multi_on_split without single', () => {
    const offenders = Object.entries(common_column_params)
      .filter(
        ([, definition]) =>
          definition &&
          typeof definition === 'object' &&
          definition.enable_multi_on_split &&
          !definition.single
      )
      .map(([name]) => name)

    expect(offenders).to.deep.equal([])
  })

  it('no custom-rendered param declares a key only the generic filter reads', () => {
    const offenders = []

    for (const param_name of CUSTOM_RENDERED_PARAMS) {
      const definition = common_column_params[param_name]
      if (!definition || typeof definition !== 'object') continue

      for (const key of GENERIC_FILTER_ONLY_KEYS) {
        if (definition[key] !== undefined) {
          offenders.push(`${param_name}.${key}`)
        }
      }
    }

    expect(offenders).to.deep.equal([])
  })
})
