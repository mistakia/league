/* global describe it */

import * as chai from 'chai'

import { get_data_view_results_query } from '#libs-server'

const expect = chai.expect

// The per_team_play wrap (period-denominator/per-team-play-wrap.mjs) rebuilds a
// column's numerator at (pid, year) grain so a player who changed teams gets each
// year's volume attributed to the team they actually played for.
//
// It reached a column-def's measure scaffolding directly and knew only two
// shapes: a combined measure (accumulator_selects) and a plain top-level
// `measure_expr` function. A ROLE-UNION column has neither -- `plays_role_union`
// carries its per-play expressions on `role_attributions`, one per role -- so the
// wrap called `column_def.measure_expr(...)` on undefined and threw
// `TypeError: column_def.measure_expr is not a function` before any SQL was built.
//
// Found in production: a saved view combining fantasy points under a team_play
// rate returned a 500 on every render and export. The wrap is only reachable in
// multi-year-no-split mode, which is why the whole class stayed invisible to
// single-year fixtures.
//
// `build_period_cte` already dispatched role_union correctly; only the wrap's
// own call site did not, so the fix forwards role_attributions instead of
// inventing a second role-union builder.

const role_union_team_play_rate_view = {
  // The wrap's preconditions: 2+ distinct effective years and no `year` row
  // axis. Production reached them through the default year range; the years are
  // stated explicitly here so the spec does not depend on where the default
  // range happens to sit, which would make it silently stop covering the wrap.
  columns: [
    {
      column_id: 'player_fantasy_points_from_plays',
      params: {
        year: [2022, 2023, 2024],
        output: { period: 'team_play', aggregation: 'rate', threshold: null }
      }
    }
  ],
  sort: [],
  where: [],
  row_axes: [],
  row_grain: ['player']
}

describe('data-views per_team_play wrap: role-union measures', () => {
  it('builds a role-union column under a team_play rate without throwing', async () => {
    const { query } = await get_data_view_results_query(
      role_union_team_play_rate_view
    )
    const sql = query.toString()

    // The wrap actually fired -- otherwise this asserts nothing about the
    // code path the defect lived in.
    expect(sql).to.match(/per_team_play_wrap_/)

    // The role-union numerator reached the SQL: build_role_union_period_cte
    // emits one inner sub-select per role, unioned. `target_pid` is the
    // receiving role's attribution column.
    expect(sql).to.match(/target_pid/)
  })

  it('attributes the wrapped numerator per (pid, year) via player_year_teams', async () => {
    const { query } = await get_data_view_results_query(
      role_union_team_play_rate_view
    )
    const sql = query.toString()

    // The wrap's whole purpose: join the per-year numerator onto the player's
    // per-year team rather than one year_reference team.
    expect(sql).to.match(/player_year_teams/)
  })
})
