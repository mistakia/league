/* global describe it */

import * as chai from 'chai'

import { get_data_view_results_query } from '#libs-server'
import server_column_definitions from '#libs-server/data-views-column-definitions/index.mjs'
// Imported directly rather than through app/core/data-views-fields/index.js,
// which pulls in React components and webpack aliases and is not
// Node-importable. This one file has no such imports, so the contract can be
// checked against the real declarations instead of by parsing source text --
// the compromise data-view-player-field-parity.spec.mjs had to make.
import client_fields from '../app/core/data-views-fields/betting-market-table-fields.js'

const expect = chai.expect

// THE CONTRACT: a row axis a column OFFERS is a row axis the server can SERVE.
//
// The axis picker's options are the union of `row_axes` over the selected
// columns, so a declaration here is a promise made in the UI. Break it and the
// user picks a split that refuses the whole request -- and a refusal renders as
// one generic banner with the message dropped, so there is nothing on screen
// saying which column or which axis was at fault.
//
// The inverse gap is what this file was written for and it is silent in the
// other direction: a column can SERVE an axis it never OFFERS, which is not an
// error but is invisible. Every game-grain betting column served the week axis
// and declared nothing, so a props-only view had no Splits control at all and
// weekly props were reachable only by hand-writing the URL.
//
// Scoped to the betting families rather than swept across every field, because
// a whole-index sweep would gate this repo's push on the pre-existing state of
// twenty other column families. Widen it when someone is in a position to fix
// what it finds.
const BETTING_FIELD_PATTERN = /betting_markets|game_prop_historical/

// A week axis is only ever requested alongside year -- the identity registry
// resolves `['week']` to the year+week identity anyway, so asking for week
// alone would test a request shape no client can produce.
const request_axes_for = (row_axis) =>
  row_axis === 'week' ? ['year', 'week'] : [row_axis]

const row_grain_for = (column_id) => {
  const declared = server_column_definitions[column_id]?.row_grains
  if (Array.isArray(declared) && declared.length) return [declared[0]]
  return ['player']
}

describe('data views row axes declaration contract', function () {
  const betting_fields = Object.entries(client_fields).filter(
    ([column_id, field]) =>
      BETTING_FIELD_PATTERN.test(column_id) &&
      Array.isArray(field?.row_axes) &&
      field.row_axes.length
  )

  // Guards against the whole suite passing vacuously if the pattern stops
  // matching or the fields stop declaring axes -- the failure mode where a
  // contract test reports a confident zero.
  it('finds betting fields declaring row axes', () => {
    expect(betting_fields.length).to.be.greaterThan(5)
  })

  for (const [column_id, field] of betting_fields) {
    for (const row_axis of field.row_axes) {
      it(`serves ${row_axis} for ${column_id}`, async () => {
        const { query } = await get_data_view_results_query({
          columns: [{ column_id, params: {} }],
          prefix_columns: [],
          row_axes: request_axes_for(row_axis),
          row_grain: row_grain_for(column_id)
        })
        // Anchored on the axis being PROJECTED, not merely on the request not
        // throwing. A query that emits without the split column is the shape
        // the rung projection bug had: valid SQL, correct rows, blank axis.
        expect(String(query)).to.match(new RegExp(`"${row_axis}"`))
      })
    }
  }

  // The season prop is the one betting column that declares year alone, and
  // that asymmetry is the point rather than an oversight: its line is one value
  // for the season, so week is not a split it can offer.
  it('does not offer week on the season prop', () => {
    expect(
      client_fields.player_season_prop_line_from_betting_markets.row_axes
    ).to.eql(['year'])
  })
})
