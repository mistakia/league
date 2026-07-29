/* global describe it */

// Structural enforcement for the physical-vs-vocabulary column split.
//
// The data-view row-axis vocabulary is 'year' / 'seas_type'; the conformed
// physical columns are 'season_year' / 'season_type'. apply_scope_to_query
// resolves between them by table name through physical-season-columns, so the map
// IS the mechanism -- and a map that silently falls out of step with the schema
// puts the pre-rename names back into generated SQL. That is not hypothetical:
// build_role_union_period_cte emitted nfl_plays.year against the renamed table, a
// 42703 on every data view carrying a rate type, and eight regenerated
// query-match goldens blessed it, because a golden regenerated from buggy code
// agrees with the buggy code.
//
// These assertions read db/schema.postgres.sql directly, in BOTH directions, so
// the failure mode that matters is covered: a future cluster that conforms
// another physical table to season_year but forgets to register it here fails the
// suite rather than shipping vocabulary names against a conformed table.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as chai from 'chai'

import {
  physical_year_column,
  physical_seas_type_column,
  physical_table_names,
  tables_without_seas_type
} from '#libs-server/data-views/physical-season-columns.mjs'

const { expect } = chai
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const schema_path = path.resolve(__dirname, '../db/schema.postgres.sql')
const schema_sql = fs.readFileSync(schema_path, 'utf8')

// Column list for a CREATE TABLE body, keyed by unqualified table name. Only the
// top-level definition is read; partitions repeat the parent's shape.
const table_columns = (table_name) => {
  const start = schema_sql.indexOf(`CREATE TABLE public.${table_name} (`)
  if (start === -1) return null
  const end = schema_sql.indexOf('\n);', start)
  const body = schema_sql.slice(start, end)
  const columns = new Set()
  for (const line of body.split('\n').slice(1)) {
    const match = /^\s{4}("?)([a-z_][a-z0-9_]*)\1\s/.exec(line)
    if (match) columns.add(match[2])
  }
  return columns
}

// Physical tables an apply_scope_to_query call site targets by name today. A new
// physical-table emitter belongs here and in the map; the map-completeness
// assertion below is what catches one that is added to neither.
const EMITTER_TARGET_TABLES = [
  'nfl_games',
  'nfl_plays',
  'nfl_plays_current_week',
  'nfl_plays_receiver',
  'nfl_snaps'
]

describe('physical season columns', () => {
  describe('the map agrees with db/schema.postgres.sql', () => {
    for (const table_name of physical_table_names()) {
      it(`${table_name} really carries ${physical_year_column(table_name)}`, () => {
        const columns = table_columns(table_name)
        expect(
          columns,
          `${table_name} is missing from the schema`
        ).to.not.equal(null)
        expect(columns.has(physical_year_column(table_name))).to.equal(true)
      })
    }

    for (const table_name of physical_table_names()) {
      if (tables_without_seas_type().has(table_name)) continue
      it(`${table_name} really carries ${physical_seas_type_column(table_name)}`, () => {
        expect(
          table_columns(table_name).has(physical_seas_type_column(table_name))
        ).to.equal(true)
      })
    }
  })

  describe('tables declared to have no season type really have none', () => {
    for (const table_name of tables_without_seas_type()) {
      it(`${table_name} has neither season_type nor seas_type`, () => {
        const columns = table_columns(table_name)
        expect(
          columns,
          `${table_name} is missing from the schema`
        ).to.not.equal(null)
        expect(columns.has('season_type')).to.equal(false)
        expect(columns.has('seas_type')).to.equal(false)
      })
    }

    it('throws rather than falling back when asked for their seas_type column', () => {
      for (const table_name of tables_without_seas_type()) {
        expect(() => physical_seas_type_column(table_name)).to.throw(
          /has no season-type column/
        )
      }
    })
  })

  // The direction that actually prevents the next 791c2393: a table conformed to
  // season_year but never registered resolves to the vocabulary 'year' and emits
  // a 42703 that no golden can catch.
  describe('map completeness', () => {
    for (const table_name of EMITTER_TARGET_TABLES) {
      it(`${table_name} is registered`, () => {
        const columns = table_columns(table_name)
        expect(
          columns,
          `${table_name} is missing from the schema`
        ).to.not.equal(null)
        if (columns.has('season_year')) {
          expect(
            physical_year_column(table_name),
            `${table_name} carries season_year but resolves to the vocabulary name`
          ).to.equal('season_year')
        }
      })
    }

    it('every registered table resolves away from the vocabulary default', () => {
      for (const table_name of physical_table_names()) {
        expect(physical_year_column(table_name)).to.not.equal('year')
      }
    })

    it('an unregistered name still falls back to the vocabulary column', () => {
      // CTE aliases are hash-named and alias year/seas_type back, so the fallback
      // is load-bearing and must not become an error.
      expect(
        physical_year_column('t22c9a76f62c8a62fec52ad076663a982')
      ).to.equal('year')
      expect(
        physical_seas_type_column('t22c9a76f62c8a62fec52ad076663a982')
      ).to.equal('seas_type')
    })
  })
})
