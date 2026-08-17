/* global describe it */

import fs from 'fs'

import * as chai from 'chai'

import data_view_fields_index from '#libs-shared/data-view-fields-index.mjs'

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
// The assertion is resolution against the shared index rather than a spelling,
// so it stays correct if an id is legitimately renamed on both sides at once.
describe('projected data-view column id resolution', () => {
  const source = fs.readFileSync(
    new URL(
      '../app/core/data-views-fields/projected-table-fields.js',
      import.meta.url
    ),
    'utf8'
  )
  const base_names = [...source.matchAll(/base_name: '([a-z0-9_]+)'/g)].map(
    (match) => match[1]
  )

  // The three periods `create_projection_fields` emits for every base_name.
  const periods = ['season', 'week', 'rest_of_season']

  it('finds the base_name declarations it is asserting over', () => {
    // Without this, a refactor that renames the `base_name` key leaves the
    // whole spec iterating an empty list and passing vacuously forever.
    expect(base_names.length).to.be.at.least(14)
  })

  it('resolves every projected column id against the shared field index', () => {
    const unresolved = []
    for (const base_name of base_names) {
      for (const period of periods) {
        const column_id = `player_${period}_projected_${base_name}`
        if (
          !Object.prototype.hasOwnProperty.call(
            data_view_fields_index,
            column_id
          )
        ) {
          unresolved.push(column_id)
        }
      }
    }
    expect(
      unresolved,
      'projected column ids the SPA builds that no field index entry answers'
    ).to.deep.equal([])
  })
})
