/* global describe it */

import * as chai from 'chai'

import data_view_fields_index from '#libs-shared/data-view-fields-index.mjs'
import get_projected_table_fields from '#app/core/data-views-fields/projected-table-fields.js'

const { expect } = chai

// `projected-table-fields.js` builds BOTH the persisted column id and the
// player_value_path by interpolating a `base_name` variable
// (`player_${period}_projected_${base_name}`), so the shorthand there is a
// column ID rather than a column name -- and a rename sweep sees a variable
// assignment, not an identifier it is holding out.
//
// The 2026-08-17 counting-stat conform moved exactly two of them, `pass_yds`
// and `rush_yds`, while the server definitions, the system view and the fields
// index all correctly kept the short spelling. The SEASON_PROJECTIONS system
// view then threw `Field not found for column_id` before reading a row, which
// is a blank page for every user, and nothing caught it: the goldens read the
// SERVER registry and stayed green, and the field-parity spec covers
// `player-table-fields.js` only.
//
// This CALLS the module rather than reconstructing its ids from source text,
// and that is what makes it an oracle rather than a restatement of the
// derivation. The text-scanning form assumed every base_name fans out to all
// three periods; when the projection period split made two families
// period-scoped -- market_salary has no weekly variant because a price is a
// share of the cap for the YEAR, and the *_net families have none because a
// weekly points-added is one signed number -- that assumption invented three
// week ids nobody builds and reported them as defects. A derivation that has to
// be taught the exceptions is a second implementation of the registry.
//
// The assertion is resolution against the shared index rather than a spelling,
// so it stays correct if an id is legitimately renamed on both sides at once.
describe('projected data-view column id resolution', () => {
  const fields = get_projected_table_fields({ week: 1 })
  const column_ids = Object.keys(fields)

  it('finds the column ids it is asserting over', () => {
    // Without this, a refactor that changes the module's shape leaves the whole
    // spec iterating an empty object and passing vacuously forever.
    expect(column_ids.length).to.be.at.least(40)
  })

  it('resolves every projected column id against the shared field index', () => {
    const unresolved = column_ids.filter(
      (column_id) =>
        !Object.prototype.hasOwnProperty.call(data_view_fields_index, column_id)
    )
    expect(
      unresolved,
      'projected column ids the SPA builds that no field index entry answers'
    ).to.deep.equal([])
  })

  // The other direction, and the one the period split makes reachable: a column
  // the SERVER registers under a period the SPA offers no picker for is
  // unreachable from the UI. That is not hypothetical -- the two period market
  // salary columns existed server-side with no client field for months, which is
  // the same latent shape as the `week='ros'` rows nothing could read.
  it('offers a picker for every projected period column the field index names', () => {
    const projected_period_ids = Object.keys(data_view_fields_index).filter(
      (id) =>
        /^player_(season|rest_of_season)_projected_/.test(id) &&
        // The cap-savings and available-cap families are registered in
        // fantasy-league-table-fields.js, not here.
        !id.includes('including_cap_savings') &&
        !id.includes('salary_at_available_cap')
    )

    expect(projected_period_ids.length).to.be.at.least(20)

    const unreachable = projected_period_ids.filter(
      (id) => !Object.prototype.hasOwnProperty.call(fields, id)
    )
    expect(
      unreachable,
      'projected period columns the server registers that no SPA picker offers'
    ).to.deep.equal([])
  })
})
