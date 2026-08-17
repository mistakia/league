/* global describe it */

import fs from 'fs'
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

// The 2026-08-08 run-direction rename. `team_rush_mid_guard_dvoa` now resolves
// two hops -- the 2026-08-17 token conform moved its target as well -- so its
// expectation here is TODAY's name, not the intermediate one. That is the whole
// point of the chain: a saved view carrying the 2026-08-08 value must arrive at a
// name the registry still has, and the single-pass migrator only manages that
// because the chain is collapsed in the map.
const RUN_DIRECTION_PAIRS = [
  ['team_rush_left_end_dvoa', 'team_rush_left_end_yards'],
  ['team_rush_left_tackle_dvoa', 'team_rush_left_tackle_yards'],
  ['team_rush_mid_guard_dvoa', 'team_rush_middle_guard_yards'],
  ['team_rush_right_tackle_dvoa', 'team_rush_right_tackle_yards'],
  ['team_rush_right_end_dvoa', 'team_rush_right_end_yards']
]

// The 2026-08-17 abbreviation-token conform, all 31 columns of the DVOA
// team-unit pair. `mid_zone_dvoa` is deliberately ABSENT and is asserted
// untouched below -- it is the published blocking-scheme name and was KEPT.
const TOKEN_CONFORM_PAIRS = [
  ['fourth_quarter_ot_dvoa', 'fourth_quarter_overtime_dvoa'],
  ['fourth_quarter_ot_dvoa_rank', 'fourth_quarter_overtime_dvoa_rank'],
  [
    'pass_points_allowed_per_game_rb',
    'pass_points_allowed_per_game_running_back'
  ],
  ['pass_points_allowed_per_game_te', 'pass_points_allowed_per_game_tight_end'],
  [
    'pass_points_allowed_per_game_wr1',
    'pass_points_allowed_per_game_wide_receiver_1'
  ],
  [
    'pass_points_allowed_per_game_wr2',
    'pass_points_allowed_per_game_wide_receiver_2'
  ],
  [
    'pass_points_allowed_per_game_wr3',
    'pass_points_allowed_per_game_wide_receiver_3'
  ],
  ['pass_rb_dvoa', 'pass_running_back_dvoa'],
  ['pass_rb_dvoa_rank', 'pass_running_back_dvoa_rank'],
  ['pass_te_dvoa', 'pass_tight_end_dvoa'],
  ['pass_te_dvoa_rank', 'pass_tight_end_dvoa_rank'],
  ['pass_wr1_dvoa', 'pass_wide_receiver_1_dvoa'],
  ['pass_wr1_dvoa_rank', 'pass_wide_receiver_1_dvoa_rank'],
  ['pass_wr2_dvoa', 'pass_wide_receiver_2_dvoa'],
  ['pass_wr2_dvoa_rank', 'pass_wide_receiver_2_dvoa_rank'],
  ['pass_wr3_dvoa', 'pass_wide_receiver_3_dvoa'],
  ['pass_wr3_dvoa_rank', 'pass_wide_receiver_3_dvoa_rank'],
  [
    'pass_yards_allowed_per_game_rb',
    'pass_yards_allowed_per_game_running_back'
  ],
  ['pass_yards_allowed_per_game_te', 'pass_yards_allowed_per_game_tight_end'],
  [
    'pass_yards_allowed_per_game_wr1',
    'pass_yards_allowed_per_game_wide_receiver_1'
  ],
  [
    'pass_yards_allowed_per_game_wr2',
    'pass_yards_allowed_per_game_wide_receiver_2'
  ],
  [
    'pass_yards_allowed_per_game_wr3',
    'pass_yards_allowed_per_game_wide_receiver_3'
  ],
  ['second_and_mid_dvoa', 'second_and_medium_dvoa'],
  ['second_and_mid_dvoa_rank', 'second_and_medium_dvoa_rank'],
  ['team_rb_yards', 'team_running_back_yards'],
  ['team_rb_yards_rank', 'team_running_back_yards_rank'],
  ['team_rush_mid_guard_percentage', 'team_rush_middle_guard_percentage'],
  ['team_rush_mid_guard_yards', 'team_rush_middle_guard_yards'],
  ['team_rush_mid_guard_yards_rank', 'team_rush_middle_guard_yards_rank'],
  ['third_and_mid_dvoa', 'third_and_medium_dvoa'],
  ['third_and_mid_dvoa_rank', 'third_and_medium_dvoa_rank']
]

const RENAMED_PAIRS = [...RUN_DIRECTION_PAIRS, ...TOKEN_CONFORM_PAIRS]

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
        'team_rush_middle_guard_yards'
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

  // TARGET LIVENESS for this map, which the suite's `rename-map target liveness`
  // block cannot cover: that one filters exports on `_PARAM_RENAMES` and this is
  // a `_VALUE_RENAMES` map, so DVOA_TYPE_VALUE_RENAMES is a ninth map against its
  // eight. A stale target here is the class that blanks a saved view's column
  // rather than dropping a filter, because dvoa_type BECOMES the physical column
  // name (team-dvoa-column-definitions.mjs builds `${dvoa_type}${rank_suffix}`),
  // so a target the table does not carry is a 42703 on render.
  //
  // Resolution goes THROUGH the migrator rather than reading raw targets,
  // because team_rush_mid_guard_dvoa chains deliberately and a raw-target
  // assertion would forbid the chain.
  describe('rename-map target liveness', function () {
    const schema = fs.readFileSync(
      new URL('../db/schema.postgres.sql', import.meta.url),
      'utf8'
    )

    const dvoa_columns = (() => {
      const match = schema.match(
        /CREATE TABLE public\.dvoa_team_unit_seasonlogs_index \(([\s\S]*?)\n\);/
      )
      if (!match)
        throw new Error('dvoa_team_unit_seasonlogs_index not in schema')
      return new Set(
        match[1]
          .split('\n')
          .map((line) => line.trim().match(/^([a-z0-9_]+)\s/))
          .filter(Boolean)
          .map((m) => m[1])
      )
    })()

    const resolve = (value) => {
      const { table_state } = migrate_table_state({
        columns: [
          { column_id: 'team_unit_dvoa', params: { dvoa_type: value } }
        ],
        row_grain: ['team']
      })
      return table_state.columns[0].params.dvoa_type
    }

    it('parsed the DVOA table out of the schema', function () {
      // A regex that stopped matching would leave every assertion below vacuous.
      expect(dvoa_columns.size).to.be.greaterThan(100)
      expect(dvoa_columns.has('total_dvoa')).to.equal(true)
    })

    it('resolves every legacy value to a column the DVOA tables carry', function () {
      const stranded = []
      for (const [legacy] of RENAMED_PAIRS) {
        const current = resolve(legacy)
        if (!dvoa_columns.has(current)) stranded.push(`${legacy} -> ${current}`)
      }
      expect(
        stranded,
        'legacy dvoa_type values resolving to a column the table does not have'
      ).to.deep.equal([])
    })

    it('leaves the KEPT mid_zone values alone', function () {
      // The `mid` sense split is the one place a uniform token rename would have
      // corrupted a name that was deliberately retained.
      for (const kept of ['mid_zone_dvoa', 'mid_zone_dvoa_rank']) {
        expect(resolve(kept)).to.equal(kept)
        expect(dvoa_columns.has(kept)).to.equal(true)
      }
    })
  })
})
