/* global describe it */

import * as chai from 'chai'

import data_views_column_definitions from '#libs-server/data-views-column-definitions/index.mjs'

const expect = chai.expect

// A column's role columns are emitted as an ORDERED COALESCE (or, for the
// defensive family, an ordered union-all), and the order decides WHICH PLAYER a
// fact is credited to. Two defects came out of treating that order as
// negotiable, and both of them credited the wrong player:
//
//   1. The alias builders sorted IN PLACE, mutating the very array the column
//      definition exports and the emitters read, so the first table_alias call
//      in a process rewrote a column's declared role order for the remaining
//      life of that process -- and which order won depended on call order. It
//      reset on every server restart.
//   2. The alias and the batch group key hashed the list as a SET, so two
//      columns declaring the same roles in DIFFERENT orders shared one alias
//      and therefore one CTE, whose single COALESCE was decided by whichever
//      column came second in the request.
//
// The declaration is authoritative for both. Sorting the declarations was the
// tempting repair for (2) and is wrong: measured against production over 2023+,
// `passer_pid` and `target_pid` are both non-null and different on 60,547
// plays, so sorting re-credits every pass opportunity from the receiver to the
// quarterback.

const columns_with_role_columns = Object.entries(data_views_column_definitions)
  .filter(
    ([, definition]) =>
      definition &&
      Array.isArray(definition.role_columns) &&
      definition.role_columns.length > 1 &&
      typeof definition.table_alias === 'function'
  )
  .map(([column_id, definition]) => ({ column_id, definition }))

describe('data views role column order', function () {
  it('found multi-role columns to check', function () {
    // A floor, so a registry refactor that stops exposing role_columns cannot
    // report compliance over an empty set.
    expect(columns_with_role_columns.length).to.be.at.least(5)
  })

  it('leaves every declared role order byte-identical after table_alias', function () {
    const moved = []
    for (const { column_id, definition } of columns_with_role_columns) {
      const declared = [...definition.role_columns]
      definition.table_alias({ params: {} })
      // A second call, since the first sort makes an already-sorted array look
      // stable and would hide the mutation on every column but the divergent
      // ones.
      definition.table_alias({ params: { year: [2024] } })
      if (definition.role_columns.join(',') !== declared.join(',')) {
        moved.push(
          `${column_id}: ${declared.join(',')} -> ${definition.role_columns.join(',')}`
        )
      }
    }
    expect(moved, moved.join('; ')).to.deep.equal([])
  })

  it('gives two columns with the same roles in different orders different aliases', function () {
    // The live pair. `player_opportunities_from_plays` credits the receiver on
    // a pass and `player_total_expected_points_added_from_plays` credits the
    // passer, over the same three roles -- so a set-keyed alias put both on one
    // CTE with one COALESCE and mis-attributed whichever lost.
    const opportunities =
      data_views_column_definitions.player_opportunities_from_plays
    const expected_points_added =
      data_views_column_definitions.player_total_expected_points_added_from_plays

    expect(
      [...opportunities.role_columns].sort().join(','),
      'the pair must still share a role SET, or this asserts nothing'
    ).to.equal([...expected_points_added.role_columns].sort().join(','))
    expect(
      opportunities.role_columns.join(','),
      'the pair must still differ in ORDER, or this asserts nothing'
    ).to.not.equal(expected_points_added.role_columns.join(','))

    expect(opportunities.table_alias({ params: {} })).to.not.equal(
      expected_points_added.table_alias({ params: {} })
    )
  })

  it('gives two columns with the same roles in the same order one alias', function () {
    // The other half: order-sensitivity must not cost the batching that shared
    // aliases exist for. These three declare an identical list.
    const aliases = [
      'player_touches_from_plays',
      'player_weighted_opportunity_from_plays',
      'player_high_value_touches_from_plays'
    ]
      .map((column_id) => data_views_column_definitions[column_id])
      .filter(Boolean)
      .map((definition) => definition.table_alias({ params: {} }))

    expect(aliases.length).to.be.at.least(2)
    expect(new Set(aliases).size).to.equal(1)
  })
})
