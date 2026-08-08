/* global describe it */

import * as chai from 'chai'

import { migrate_table_state } from '#libs-shared/data-views-saved-view-migration.mjs'
import parse_table_state_from_url from '#app/core/data-views/parse-table-state-from-url.mjs'

const expect = chai.expect

// Coverage for the 2026-08-08 run-direction rename, which moved five columns
// from team_rush_<direction>_dvoa to _yards because they hold rushing yards and
// always did (db/adhoc/2026-08-08-rename-team-rush-direction-yards.sql).
//
// WHY THIS SPEC EXISTS AT ALL. The five names are VALUES of the `dvoa_type`
// column param on `team_unit_dvoa` -- not param keys and not column ids -- and
// that puts them outside the reach of both persisted-param gates by
// construction: check-saved-view-param-coverage walks Object.keys(node.params)
// and check-data-view-url-param-coverage walks parsed.searchParams.keys(). Both
// are green across this rename whether or not any migration rule exists, so
// neither can be the gate. Their negative controls do not help either -- they
// prove those gates work on KEYS.
//
// Both persisted surfaces are covered here because they are rewritten by
// different code: a saved view goes through migrate_table_state, while a share
// URL goes through parse_table_state_from_url and never enters the versioned
// migration chain at all (a query string carries no version field). A share link
// is also immutable once sent, which is what makes the URL half unrecoverable if
// it is missed.
//
// Deliberately asserts through the two PUBLIC entry points rather than importing
// the rename map, so the spec is red at the pre-fix revision for the right
// reason -- a value that was not rewritten -- rather than on a missing export.

const params = (object) => new URLSearchParams(object)
const json = (value) => JSON.stringify(value)

const RENAMED_PAIRS = [
  ['team_rush_left_end_dvoa', 'team_rush_left_end_yards'],
  ['team_rush_left_tackle_dvoa', 'team_rush_left_tackle_yards'],
  ['team_rush_mid_guard_dvoa', 'team_rush_mid_guard_yards'],
  ['team_rush_right_tackle_dvoa', 'team_rush_right_tackle_yards'],
  ['team_rush_right_end_dvoa', 'team_rush_right_end_yards']
]

describe('data-views dvoa_type value migration', function () {
  describe('saved views', function () {
    for (const [legacy, current] of RENAMED_PAIRS) {
      it(`rewrites ${legacy} to ${current}`, function () {
        const { table_state, changed } = migrate_table_state({
          columns: [
            { column_id: 'team_unit_dvoa', params: { dvoa_type: legacy } }
          ],
          row_grain: ['team']
        })
        expect(changed).to.equal(true)
        expect(table_state.columns[0].params.dvoa_type).to.equal(current)
      })
    }

    it('preserves the array shape a persisted value may carry', function () {
      const { table_state } = migrate_table_state({
        columns: [
          {
            column_id: 'team_unit_dvoa',
            params: { dvoa_type: ['team_rush_mid_guard_dvoa'] }
          }
        ],
        row_grain: ['team']
      })
      expect(table_state.columns[0].params.dvoa_type).to.eql([
        'team_rush_mid_guard_yards'
      ])
    })

    it('leaves a dvoa_type this rename does not touch alone', function () {
      const { table_state } = migrate_table_state({
        columns: [
          { column_id: 'team_unit_dvoa', params: { dvoa_type: 'pass_dvoa' } }
        ],
        row_grain: ['team']
      })
      expect(table_state.columns[0].params.dvoa_type).to.equal('pass_dvoa')
    })

    it('rewrites the value in prefix_columns and where as well as columns', function () {
      const entry = (column_id) => ({
        column_id,
        params: { dvoa_type: 'team_rush_left_end_dvoa' }
      })
      const { table_state } = migrate_table_state({
        columns: [entry('team_unit_dvoa')],
        prefix_columns: [entry('team_unit_dvoa')],
        where: [entry('team_unit_dvoa')],
        row_grain: ['team']
      })
      for (const key of ['columns', 'prefix_columns', 'where']) {
        expect(
          table_state[key][0].params.dvoa_type,
          `${key} was not migrated`
        ).to.equal('team_rush_left_end_yards')
      }
    })
  })

  describe('share urls', function () {
    for (const [legacy, current] of RENAMED_PAIRS) {
      it(`rewrites ${legacy} to ${current}`, function () {
        const result = parse_table_state_from_url(
          params({
            columns: json([
              { column_id: 'team_unit_dvoa', params: { dvoa_type: legacy } }
            ])
          })
        )
        expect(result.columns[0].params.dvoa_type).to.equal(current)
      })
    }

    it('leaves a dvoa_type this rename does not touch alone', function () {
      const result = parse_table_state_from_url(
        params({
          columns: json([
            {
              column_id: 'team_unit_dvoa',
              params: { dvoa_type: 'third_and_long_dvoa' }
            }
          ])
        })
      )
      expect(result.columns[0].params.dvoa_type).to.equal('third_and_long_dvoa')
    })

    it('rewrites the value in prefix_columns and where as well as columns', function () {
      const entry = json([
        {
          column_id: 'team_unit_dvoa',
          params: { dvoa_type: 'team_rush_right_end_dvoa' }
        }
      ])
      const result = parse_table_state_from_url(
        params({ columns: entry, prefix_columns: entry, where: entry })
      )
      for (const key of ['columns', 'prefix_columns', 'where']) {
        expect(
          result[key][0].params.dvoa_type,
          `${key} was not migrated`
        ).to.equal('team_rush_right_end_yards')
      }
    })
  })
})
