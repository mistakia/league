/* global describe it */

import * as chai from 'chai'

import player_team_column_definition from '#libs-server/data-views-column-definitions/player-team-column-definition.mjs'

chai.should()
const expect = chai.expect

const def = player_team_column_definition.player_nfl_teams

describe('player_nfl_teams routing', function () {
  it('falls back to player.current_nfl_team when no filter params or splits', () => {
    expect(def.is_where_column_array({ params: {}, row_axes: [] })).to.equal(
      false
    )
    expect(
      def.main_select({ params: {}, row_axes: [], column_index: 0 })
    ).to.deep.equal(['player.current_nfl_team as player_nfl_teams_0'])
    expect(
      def.main_where({ params: {}, row_axes: [], column_index: 0 })
    ).to.equal('player.current_nfl_team')
  })

  it('routes to CTE when nfl_week_id is set (multi-year or week-specific)', () => {
    const params = { nfl_week_id: ['2022_REG_WEEK_5', '2023_REG_WEEK_5'] }
    expect(def.is_where_column_array({ params, row_axes: [] })).to.equal(true)
    const select = def.main_select({ params, row_axes: [], column_index: 0 })
    expect(select[0]).to.match(/\.teams as player_nfl_teams_0$/)
  })

  it('routes to CTE when year is set (legacy param)', () => {
    const params = { year: [2022, 2023] }
    expect(def.is_where_column_array({ params, row_axes: [] })).to.equal(true)
  })

  it('routes to CTE when row_axes are set', () => {
    expect(
      def.is_where_column_array({ params: {}, row_axes: ['year'] })
    ).to.equal(true)
  })

  it('routes to CTE when career_year is set', () => {
    expect(
      def.is_where_column_array({
        params: { career_year: [1, 3] },
        row_axes: []
      })
    ).to.equal(true)
  })
})
