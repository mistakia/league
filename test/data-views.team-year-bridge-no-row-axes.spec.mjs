/* global describe it */

import * as chai from 'chai'

import { get_data_view_results_query } from '#libs-server'

const expect = chai.expect

// Regression for /u/0004c034 ("Next Week Matchup Preview v2"): a no-row-axes
// team view (row_grain ['team'], no year/week row-axis) that includes a
// team_year-grain source column (e.g. team_unit_dvoa with an explicit `year`
// param) attaches via the (team, team_year) source-attach rule, which applies
// the team->team_year bridge. get_year_range only populates
// query_context.year_range on the row-axes branch, so the bridge previously
// threw "team-to-team-year bridge requires non-empty year_range" at build time.
// The bridge now mirrors player_year->team_year's resolution order and falls
// back to the triggering column's params.year, anchoring the base_years /
// team_years CTEs on that year rather than throwing.

const team_year_no_axes_request = (year) => ({
  columns: [
    {
      column_id: 'team_unit_dvoa',
      params: { year, dvoa_type: ['total_dvoa'], team_unit: ['off'] }
    }
  ],
  prefix_columns: ['team_code'],
  sort: [],
  where: [],
  row_grain: ['team']
})

describe('data-views team->team_year bridge with no row-axis', () => {
  it('builds (does not throw) for a team_year column on a no-row-axes team view', async () => {
    const { query } = await get_data_view_results_query(
      team_year_no_axes_request([2024])
    )
    const sql = query.toString()

    // base_years is anchored on the column's own year (the params.year fallback)
    expect(sql).to.match(/base_years" as \(SELECT unnest\(ARRAY\[2024\]\) as year/)
    // team_years spine is team x base_years, joined back to the team identity
    expect(sql).to.include(
      'team_years" as (SELECT team.team_code, base_years.year FROM team CROSS JOIN base_years'
    )
  })

  it('anchors base_years on the params.year value', async () => {
    const { query } = await get_data_view_results_query(
      team_year_no_axes_request([2022])
    )
    const sql = query.toString()
    expect(sql).to.match(/base_years" as \(SELECT unnest\(ARRAY\[2022\]\) as year/)
  })
})
