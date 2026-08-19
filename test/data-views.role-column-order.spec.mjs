/* global describe it */

import * as chai from 'chai'

import data_views_column_definitions from '#libs-server/data-views-column-definitions/index.mjs'

const expect = chai.expect

// A column's role columns are hashed as a SET and emitted as an ORDERED
// COALESCE (or, for the defensive family, an ordered union-all), so the alias
// builders sort them. They sorted IN PLACE, which mutates the very array the
// column definition exports and the emitters read -- so the first table_alias
// call in a process silently rewrote a column's declared role order for the
// remaining life of that process, and which order won depended on call order.
// It reset on every server restart, which is the worst shape a defect can
// have.
//
// The declaration is the thing being pinned here: calling a derived accessor
// must not move it.

const columns_with_role_columns = Object.entries(data_views_column_definitions)
  .filter(
    ([, definition]) =>
      definition &&
      Array.isArray(definition.pid_columns) &&
      definition.pid_columns.length > 1 &&
      typeof definition.table_alias === 'function'
  )
  .map(([column_id, definition]) => ({ column_id, definition }))

describe('data views role column order', function () {
  it('found multi-role columns to check', function () {
    // A floor, so a registry refactor that stops exposing pid_columns cannot
    // report compliance over an empty set.
    expect(columns_with_role_columns.length).to.be.at.least(5)
  })

  it('leaves every declared role order byte-identical after table_alias', function () {
    const moved = []
    for (const { column_id, definition } of columns_with_role_columns) {
      const declared = [...definition.pid_columns]
      definition.table_alias({ params: {} })
      // A second call, since the first sort makes an already-sorted array look
      // stable and would hide the mutation on every column but the divergent
      // ones.
      definition.table_alias({ params: { year: [2024] } })
      if (definition.pid_columns.join(',') !== declared.join(',')) {
        moved.push(
          `${column_id}: ${declared.join(',')} -> ${definition.pid_columns.join(',')}`
        )
      }
    }
    expect(moved, moved.join('; ')).to.deep.equal([])
  })
})
