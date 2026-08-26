/* global describe it */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import * as chai from 'chai'

import { common_column_params } from '#libs-shared'

const expect = chai.expect
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const FIELDS_INDEX = path.join(ROOT, 'app/core/data-views-fields/index.js')

// WHAT A COLUMN PARAM IS
//
// A data-view column can carry parameters -- "which week", "which year",
// "DraftKings or FanDuel". Each one is declared as a plain object in
// libs-shared/common-column-params.mjs, and the declaration is what the UI
// reads to decide how to draw the picker.
//
// THE PROBLEM THIS SPEC EXISTS FOR
//
// There are TWO things that can draw that picker, and they do not read the
// same declaration keys.
//
//   - react-table's column-param-select-filter is the generic one. It reads
//     `single`, `enable_multi_on_split`, `preset_values` and `value_groups`.
//   - A param can instead name a custom `component`, bound in
//     app/core/data-views-fields/index.js. Both param render call sites
//     short-circuit on that component, so the generic filter never runs and
//     none of those four keys is ever read.
//
// Neither renderer complains about a key it does not read. So a param that
// names a custom component but still declares `single: true` looks exactly
// like a param where `single: true` works -- the declaration sits there
// reading like a feature while nothing consumes it.
//
// That is not hypothetical. `enable_multi_on_split` sat dead on `nfl_week_id`
// from 2024 to 2026, under a passing test. The test asserted that the
// declaration equalled ['year', 'week'], which stayed true the entire time
// precisely because a declaration asserting its own value cannot fail. It
// could not have caught anything.
//
// WHAT THESE CHECKS DO
//
// Two of them assert the two ways a declaration can be inert, so an unread key
// fails at declaration time instead of being discovered years later. The third
// guards the derivation the second one depends on. All three were verified to
// go red by injecting the fault each is meant to catch.

// Keys only react-table's generic select filter reads -- that is, keys read
// AFTER the component dispatch, which a custom-rendered param never reaches.
//
// The distinction is where in the render path the key is consumed, not whether
// it sounds row-axis related. `enable_on_row_axes` reads like a sibling of
// `enable_multi_on_split` and deliberately is NOT listed here: both param call
// sites consult it near the top of the function, BEFORE they short-circuit on
// a custom `component`, so it applies to custom-rendered params too and is
// perfectly valid on one.
const GENERIC_FILTER_ONLY_KEYS = [
  'single',
  'enable_multi_on_split',
  'preset_values',
  'value_groups'
]

// Which params are custom-rendered is DERIVED from the binding site rather
// than restated here. A hand-maintained copy of this list is the same defect
// the spec is guarding against: bind a fifth param to a custom component and a
// stale list would keep passing while that param went unchecked.
//
// app/ modules import through webpack aliases (@core, @components) that mocha
// has no harness for, so the binding site cannot be imported and is read as
// source instead -- the same approach as app.connected-component-prop-contract
// and app.action-type-registration.
const read_custom_rendered_params = () => {
  const source = fs.readFileSync(FIELDS_INDEX, 'utf8')
  const names = [
    ...source.matchAll(/column_params\.([a-z_0-9]+)\.component\s*=/g)
  ].map((match) => match[1])
  const total_component_assignments = (source.match(/\.component\s*=/g) || [])
    .length

  return { names: [...new Set(names)], total_component_assignments }
}

describe('data-views column param UI contract', () => {
  // The derivation reads source with a regex, so it has its own failure mode:
  // if the binding site is refactored into a shape the pattern misses, the
  // derived list silently shrinks and the second check passes over nothing.
  // A gate covering part of a surface while reading as full coverage is worse
  // than no gate, so the parse has to prove it saw everything it should have.
  it('parses every component binding in the fields index', () => {
    const { names, total_component_assignments } = read_custom_rendered_params()

    expect(names.length).to.be.greaterThan(0)
    expect(names.length).to.equal(total_component_assignments)
  })

  // `enable_multi_on_split` does exactly one thing: it un-sets `single` when a
  // matching row axis is active (react-table's is_single_select). On a param
  // that is not `single` to begin with there is nothing for it to un-set, so
  // it can never change an outcome no matter which renderer draws the param.
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

  // A custom-rendered param never reaches the generic filter, so every key in
  // GENERIC_FILTER_ONLY_KEYS is inert on it -- including `single` on its own,
  // which the check above deliberately allows for generic-rendered params.
  it('no custom-rendered param declares a key only the generic filter reads', () => {
    const { names } = read_custom_rendered_params()
    const offenders = []

    for (const param_name of names) {
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
