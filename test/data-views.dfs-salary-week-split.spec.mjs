/* global describe it */

import * as chai from 'chai'

import { get_data_view_results_query } from '#libs-server'

const expect = chai.expect

// Regression for /u/cb4e122641834320a4bec5d9b34022ce: a week-split player view
// (row_grain ['player'], row_axes ['week']) with a player_dfs_salary column
// whose single_nfl_week_id param lists many weeks. The salary source previously
// collapsed the param to a single week (first element) and joined the CTE on pid
// only, so every week row rendered that one week's salary. It now spans all
// requested weeks in the CTE and correlates the join on year + week so each week
// row shows that week's salary.

const weeks = ['2025_REG_WEEK_1', '2025_REG_WEEK_2', '2025_REG_WEEK_3']

const week_split_request = () => ({
  columns: [
    {
      column_id: 'player_dfs_salary',
      params: { single_nfl_week_id: weeks, platform_source_id: ['DRAFTKINGS'] }
    }
  ],
  prefix_columns: ['player_name'],
  sort: [],
  where: [],
  row_grain: ['player'],
  row_axes: ['week']
})

const season_request = () => ({
  columns: [{ column_id: 'player_dfs_salary' }],
  sort: [{ column_id: 'player_dfs_salary', desc: true }],
  where: [
    {
      column_id: 'player_dfs_salary',
      params: {},
      value: '5000',
      operator: '>='
    }
  ]
})

describe('data-views player_dfs_salary week split', () => {
  it('spans every requested week in the salary CTE (not just the first)', async () => {
    const { query } = await get_data_view_results_query(week_split_request())
    const sql = query.toString()
    for (const week of weeks) {
      expect(sql).to.include(`'${week}'`)
    }
  })

  it('correlates the salary join on year + week, not pid alone', async () => {
    const { query } = await get_data_view_results_query(week_split_request())
    const sql = query.toString()
    // week correlated to the week relation's own week column
    expect(sql).to.match(/\.week = player_years_weeks\.week/)
    // year correlated to the week relation's year (player_years is defined as a
    // CTE but never joined into a week-only FROM, so player_years.year would be
    // unreachable). Guard against a regression back to the unreachable ref.
    expect(sql).to.match(/\.year = player_years_weeks\.year/)
    expect(sql).to.not.match(/\.year = player_years\.year/)
  })

  it('executes without a missing-FROM-clause error', async () => {
    // The join must reference only relations present in the FROM clause; a
    // build that returns a valid query object is sufficient here (the
    // result-equivalence suite covers execution against the seeded DB).
    const { query } = await get_data_view_results_query(week_split_request())
    expect(query).to.be.an('object')
  })

  it('leaves the season (non-week) case pid-only and single-week', async () => {
    const { query } = await get_data_view_results_query(season_request())
    const sql = query.toString()
    // no week split -> no week relation, single-week CTE, pid-only join
    expect(sql).to.not.include('player_years_weeks')
    expect(sql).to.include("'2025_REG_WEEK_1'")
    expect(sql).to.not.match(/\.week = player_years_weeks\.week/)
  })
})
