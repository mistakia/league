/* global describe it before */

import MockDate from 'mockdate'
import * as chai from 'chai'

import { get_data_view_results_query } from '#libs-server'

// Regression: a filter on a team-identity column under player row_grain
// emitted `<player_bridge_cte>.team_code`, a column none of the three bridge
// CTEs has -- they expose the player's team set as a `teams text[]` array.
// Postgres rejected the whole view with 42703.
//
// The cause was not in the column definition, which resolves both the column
// expression and the array comparison correctly. where-string.mjs simply did
// not forward query_context into main_where or is_where_column_array, and
// `is_player_row_grain(undefined)` is falsy -- a VALID branch -- so both
// hooks silently answered as though the request were team-grain.
//
// The gate at db/gates/check-data-view-sql-validity.mjs cannot see this
// class: it sweeps columns across grains and axes as SELECT columns and
// never builds a WHERE clause.

const { expect } = chai

// One case per bridge CTE. get_player_bridge picks the bridge from row_axes,
// so all three have to be exercised to cover the emitter.
const cases = [
  { row_axes: [], bridge: 'player_teams' },
  { row_axes: ['year'], bridge: 'player_years_teams' },
  { row_axes: ['week'], bridge: 'player_years_weeks_teams' }
]

const team_identity_columns = [
  'team_code',
  'team_name',
  'team_conference',
  'team_division'
]

describe('Data View team-identity filters under player row_grain', () => {
  before(() => {
    MockDate.reset()
  })

  for (const { row_axes, bridge } of cases) {
    it(`filters team_code through ${bridge} as an array overlap with row_axes [${row_axes}]`, async () => {
      const { query } = await get_data_view_results_query({
        columns: ['player_name'],
        where: [{ column_id: 'team_code', operator: 'IN', value: ['NE'] }],
        row_axes,
        limit: 10
      })
      const sql = String(query)

      expect(sql).to.include(
        `${bridge}.teams::text[] && ARRAY['NE']::text[]`,
        'expected the array-overlap form against the bridge CTE'
      )
      // The defect's exact signature. `teams` is the only team column any
      // bridge CTE has, so a scalar reference is unresolvable by construction.
      expect(sql).to.not.match(
        /\bplayer(_years)?(_weeks)?_teams\.team_code\b/,
        'emitted a scalar team_code against a bridge CTE that has no such column'
      )
    })
  }

  for (const column_id of team_identity_columns) {
    it(`resolves a ${column_id} filter to a bridge-backed expression, not a bare team column`, async () => {
      const { query } = await get_data_view_results_query({
        columns: ['player_name'],
        where: [{ column_id, operator: 'IN', value: ['NE'] }],
        row_axes: ['week'],
        limit: 10
      })
      const sql = String(query)

      // `team` is the VALUES CTE, only joined under team row_grain. Reaching
      // it directly from the outer WHERE at player grain is the same defect
      // wearing a different column name.
      expect(sql).to.not.include(
        `team.${column_id} IN (`,
        'filter fell through to the team-grain branch under player row_grain'
      )
      expect(sql).to.include(
        'player_years_weeks_teams.teams',
        'expected the filter to resolve through the week bridge CTE'
      )
    })
  }
})
