/* global describe it */

import * as chai from 'chai'

import { get_data_view_results_query } from '#libs-server'

const expect = chai.expect

// single_nfl_week_id is the time-scope param the week-scoped column families
// carry (dfs salary, betting markets). It was invisible to both scope readers:
// resolve_view_scope read only nfl_week_id, and get_year_range / get_week_range
// read only params.year / params.week -- which nfl_week_id populates via
// resolve_nfl_week_params and single_nfl_week_id does not.
//
// A view whose ONLY time scope was single_nfl_week_id therefore looked
// completely unscoped: the year row axis fell through to the full 2000-current
// default and every scope-aware source scanned every year. Measured on
// production 2026-08-19 against the saved DFS-salary week view, that was
// 13,079,985 intermediate rows, ~1.7GB of temp spill and 76s.
//
// No golden exercises single_nfl_week_id (the corpus uses `year` and
// `nfl_week_id`), so this spec is the whole gate for that param reaching the
// row axis. Each assertion is paired with a control that must differ, so a
// matcher that stops matching cannot report compliance.

const week_split_request = ({ single_nfl_week_id }) => ({
  columns: [
    {
      column_id: 'player_dfs_salary',
      params: { single_nfl_week_id, platform_source_id: ['DRAFTKINGS'] }
    }
  ],
  prefix_columns: ['player_name', 'player_nfl_teams'],
  sort: [],
  where: [],
  row_grain: ['player'],
  row_axes: ['year', 'week']
})

const sql_for = async (request) => {
  const { query } = await get_data_view_results_query(request)
  return query.toString()
}

const base_years_of = (sql) => {
  const match = sql.match(/unnest\(ARRAY\[([0-9,]+)\]\)/)
  return match ? match[1].split(',').map(Number) : []
}

describe('data-views single_nfl_week_id row-axis scope', () => {
  it('narrows the year row axis to the years the param names', async () => {
    const sql = await sql_for(
      week_split_request({ single_nfl_week_id: ['2024_REG_WEEK_3'] })
    )
    expect(base_years_of(sql)).to.deep.equal([2024])
  })

  it('spans every year the param names when it names more than one', async () => {
    const sql = await sql_for(
      week_split_request({
        single_nfl_week_id: ['2023_REG_WEEK_3', '2024_REG_WEEK_5']
      })
    )
    expect(base_years_of(sql)).to.deep.equal([2023, 2024])
  })

  // The control for both assertions above: with no time scope anywhere the
  // 2000-current default is still correct and must still be emitted. Without
  // this, a change that hard-narrowed every view would pass the two tests above.
  it('leaves a view that declares no time scope on the full default range', async () => {
    const sql = await sql_for({
      columns: [{ column_id: 'player_dfs_salary', params: {} }],
      prefix_columns: ['player_name'],
      sort: [],
      where: [],
      row_grain: ['player'],
      row_axes: ['year', 'week']
    })
    const years = base_years_of(sql)
    expect(years.length).to.be.greaterThan(20)
    expect(years[0]).to.equal(2000)
  })

  it('narrows the week row axis to the weeks the param names', async () => {
    const sql = await sql_for(
      week_split_request({
        single_nfl_week_id: ['2024_REG_WEEK_3', '2024_REG_WEEK_4']
      })
    )
    expect(sql).to.include('nfl_year_week_timestamp.week IN (3, 4)')
  })

  // Reaching the VIEW scope (not just the row axis) is what lets
  // apply_scope_to_query prune a scope-aware source. player_nfl_teams routes
  // through the per-game CTE, whose single-year branch selects the year
  // partition by name -- so the partition name is the observable proof the view
  // scope is non-empty.
  it('reaches the view scope, pruning the per-game CTE to one gamelogs partition', async () => {
    const sql = await sql_for(
      week_split_request({ single_nfl_week_id: ['2024_REG_WEEK_3'] })
    )
    expect(sql).to.include('player_gamelogs_year_2024')
    expect(sql).to.not.match(/from "player_gamelogs"/)
  })

  it('leaves an unscoped view scanning the unpartitioned parent', async () => {
    const sql = await sql_for({
      columns: [{ column_id: 'player_dfs_salary', params: {} }],
      prefix_columns: ['player_name', 'player_nfl_teams'],
      sort: [],
      where: [],
      row_grain: ['player'],
      row_axes: ['year', 'week']
    })
    expect(sql).to.not.include('player_gamelogs_year_2024')
  })
})

// The second half of the 76s fix, independent of which param spelled the scope.
// player_years_weeks is built as player_years INNER JOIN
// nfl_year_week_timestamp ON year, so each of its rows already carries the
// (pid, year) pair of exactly one player_years row. Joining player_years into
// the outer FROM as well matched the same rows and changed no result, but both
// CTEs are opaque to the planner: the two-column correlation multiplied two
// independent selectivity estimates (1,188 estimated against 506,322 actual)
// and produced a nested loop running 295M join-filter comparisons. Measured on
// production 2026-08-21, dropping it took the statement from 35.9s to 1.1s.
describe('data-views week-axis player_years join', () => {
  const request_with_axes = (row_axes) => ({
    columns: [
      {
        column_id: 'player_dfs_salary',
        params: { single_nfl_week_id: ['2024_REG_WEEK_3'] }
      }
    ],
    prefix_columns: ['player_name'],
    sort: [],
    where: [],
    row_grain: ['player'],
    row_axes
  })

  it('joins player_years_weeks on pid alone under a week axis', async () => {
    const sql = await sql_for(request_with_axes(['year', 'week']))
    expect(sql).to.include(
      'inner join "player_years_weeks" on "player_years_weeks"."pid" = "player"."pid"'
    )
    expect(sql).to.not.match(/"player_years_weeks"\."year" = "player_years"\./)
  })

  it('does not join player_years into the outer FROM under a week axis', async () => {
    const sql = await sql_for(request_with_axes(['year', 'week']))
    expect(sql).to.not.match(
      /inner join "player_years" on "player_years"\."pid"/
    )
    // The CTE must still be DEFINED -- player_years_weeks selects from it.
    expect(sql).to.include('"player_years" as (')
  })

  // Control: a year axis with no week axis still joins player_years, which is
  // the only thing carrying the year in that shape. Without this the assertion
  // above would pass against a build that dropped the join unconditionally.
  it('still joins player_years for a year axis with no week axis', async () => {
    const sql = await sql_for(request_with_axes(['year']))
    expect(sql).to.match(/inner join "player_years" on "player_years"\."pid"/)
  })
})
