/* global describe it */
import * as chai from 'chai'

import {
  resolve_generated_table_state,
  RESOLVER_ERROR_CODES
} from '#libs-server/data-views/generation/resolve-generated-table-state.mjs'
import { is_valid_table_state } from '#libs-shared/data-view-storage/validate.mjs'
import { migrate_table_state } from '#libs-shared/data-views-saved-view-migration.mjs'

const expect = chai.expect

// The generation path REJECTS what the legacy saved-view path tolerates, and
// both halves have to hold in the same run or the claim is empty.
//
// WHY THE ASYMMETRY IS CORRECT RATHER THAN A GAP. A saved view is a row a real
// user already owns; refusing to load it because one column id no longer
// resolves would blank a view they built by hand, and the render path already
// degrades per column. A GENERATED view has no such history -- it is a claim
// the agent is making right now, and admitting a fabricated column id would
// persist a view that renders empty with nothing to point at. So the strict
// check belongs at emit time and nowhere else, which is only demonstrable by
// showing the same input taking two different answers.
//
// TWO CLASSES, NOT THE THREE THE PLAN NAMES. Unknown param KEYS are
// deliberately NOT rejected: check_params skips a key that resolves to no
// definition, because the catalog is built from what the server can import and
// "declared in no registry" is not the same claim as "not real" -- several are
// params a column definition reads by hand. Asserting a rejection here would
// pin a check the resolver does not have and does not currently want; it
// becomes real once reach-full-column-param-vocabulary closes the catalog gap.

const generated_view = (overrides) => ({
  row_grain: ['player'],
  prefix_columns: ['player_name'],
  columns: [{ column_id: 'player_games_played' }],
  ...overrides
})

// The legacy path as the app actually applies it: migrate first (which is what
// the saved-view read path does since dafd34743), then the shape validator.
// `migrate_table_state` returns { changed, table_state } rather than the state
// itself, and handing the WRAPPER to the validator fails every input --
// including a clean one, which is what the positive control below is for.
const legacy_tolerates = (table_state) =>
  is_valid_table_state(migrate_table_state(table_state).table_state)

describe('generated table_state resolver / rejection suite', function () {
  describe('a fabricated column id', function () {
    const table_state = generated_view({
      columns: [{ column_id: 'player_vibes_rating' }]
    })

    it('is rejected on the generation path, by name', function () {
      const result = resolve_generated_table_state({ table_state })
      expect(result.ok).to.equal(false)
      expect(result.errors.map((error) => error.code)).to.include(
        RESOLVER_ERROR_CODES.unknown_column_id
      )
    })

    it('is still tolerated on the legacy saved-view path', function () {
      expect(legacy_tolerates(table_state)).to.equal(true)
    })
  })

  describe('an out-of-range param value', function () {
    // `year` carries an enumerated permitted set, so a year outside it is the
    // cleanest instance of the class that does not depend on any one column.
    const table_state = generated_view({
      columns: [
        {
          column_id: 'player_games_played',
          params: { year: [1892] }
        }
      ]
    })

    it('is rejected on the generation path, by name', function () {
      const result = resolve_generated_table_state({ table_state })
      expect(result.ok).to.equal(false)
      expect(result.errors.map((error) => error.code)).to.include(
        RESOLVER_ERROR_CODES.invalid_param_value
      )
    })

    it('is still tolerated on the legacy saved-view path', function () {
      expect(legacy_tolerates(table_state)).to.equal(true)
    })
  })

  // THE POSITIVE CONTROL, and without it every assertion above could be passing
  // on a resolver that rejects everything it is handed.
  describe('a view built entirely from real ids and permitted values', function () {
    it('is admitted on the generation path', function () {
      const result = resolve_generated_table_state({
        table_state: generated_view({})
      })
      expect(
        result.ok,
        `a clean view was rejected: ${JSON.stringify(result.errors)}`
      ).to.equal(true)
    })

    it('is also tolerated on the legacy path, so the two agree when they should', function () {
      expect(legacy_tolerates(generated_view({}))).to.equal(true)
    })
  })
})
