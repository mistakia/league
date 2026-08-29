/* global describe it */

import * as chai from 'chai'

import { get_data_view_results_query } from '#libs-server'

const expect = chai.expect

const expect_subject_mismatch = async (request, column_id) => {
  try {
    await get_data_view_results_query(request)
  } catch (err) {
    expect(err.message).to.include('ColumnRowGrainMismatch')
    expect(err.message).to.include(`'${column_id}'`)
    return
  }
  throw new Error(
    `expected ColumnRowGrainMismatch for column '${column_id}' but no error was thrown`
  )
}

const expect_week_required = async (request, column_id) => {
  try {
    await get_data_view_results_query(request)
  } catch (err) {
    expect(err.message).to.include('ColumnWeekRequired')
    expect(err.message).to.include(`'${column_id}'`)
    return
  }
  throw new Error(
    `expected ColumnWeekRequired for column '${column_id}' but no error was thrown`
  )
}

describe('data-views subject compatibility', () => {
  it('rejects player-grain prefix column under team subject', async () => {
    await expect_subject_mismatch(
      {
        row_grain: ['team'],
        prefix_columns: ['player_name'],
        columns: [
          {
            column_id: 'team_pass_attempts_from_plays',
            params: { year: [2023] }
          }
        ]
      },
      'player_name'
    )
  })

  it('rejects player-grain where-clause column under team subject', async () => {
    await expect_subject_mismatch(
      {
        row_grain: ['team'],
        columns: [
          {
            column_id: 'team_pass_attempts_from_plays',
            params: { year: [2023] }
          }
        ],
        where: [
          {
            column_id: 'player_position',
            operator: 'IN',
            value: ['TEAM']
          }
        ]
      },
      'player_position'
    )
  })

  it('rejects player-grain column in columns array under team subject', async () => {
    await expect_subject_mismatch(
      {
        row_grain: ['team'],
        columns: [
          { column_id: 'player_name' },
          {
            column_id: 'team_pass_attempts_from_plays',
            params: { year: [2023] }
          }
        ]
      },
      'player_name'
    )
  })

  // The WEEK half of the same contract. row_grain decides player-versus-team;
  // this decides whether a column reading week-keyed rows has a week to read
  // them at. A request that resolves none is refused rather than joined to a
  // week nobody asked for.
  //
  // This is the shape that used to emit `week = '0'` and return a season value
  // under a week header; after the period tables split it matched no row at
  // all and the column simply read blank. Both are silent, which is why the
  // refusal is the fix rather than a better default.
  describe('week requirement', () => {
    it('rejects a week-keyed projection column when nothing resolves a week', async () => {
      await expect_week_required(
        {
          row_grain: ['player'],
          row_axes: [],
          columns: ['player_week_projected_points_added']
        },
        'player_week_projected_points_added'
      )
    })

    it('rejects it under a year axis alone', async () => {
      await expect_week_required(
        {
          row_grain: ['player'],
          row_axes: ['year'],
          columns: ['player_week_projected_points_added']
        },
        'player_week_projected_points_added'
      )
    })

    // The case the grain-based design got WRONG. An explicit week param under
    // a flat player row resolves a week perfectly well, and this shape ships
    // (test/data-view-queries/create-a-query-for-week-projected-stats.json).
    // Refusing it would have been a regression dressed as a fix.
    it('admits it with an explicit week param and no row axes at all', async () => {
      const { query } = await get_data_view_results_query({
        row_grain: ['player'],
        row_axes: [],
        columns: [
          {
            column_id: 'player_week_projected_points_added',
            params: { year: [2023], week: [2] }
          }
        ]
      })
      expect(query.toString()).to.include("'2'")
    })

    it('admits it with an nfl_week_id and no row axes', async () => {
      const { query } = await get_data_view_results_query({
        row_grain: ['player'],
        row_axes: [],
        columns: [
          {
            column_id: 'player_week_projected_points_added',
            params: { nfl_week_id: ['2023_REG_2'] }
          }
        ]
      })
      expect(query.toString()).to.include(
        'league_format_player_projection_values'
      )
    })

    it('rejects it in a where clause, not only as a display column', async () => {
      await expect_week_required(
        {
          row_grain: ['player'],
          row_axes: [],
          columns: ['player_name'],
          where: [
            {
              column_id: 'player_week_projected_points_added',
              operator: '>',
              value: 0
            }
          ]
        },
        'player_week_projected_points_added'
      )
    })

    // The other side of the refusal, so the rejections above cannot pass by
    // the column being broken outright: WITH a week axis it builds.
    it('admits it once the week axis is present', async () => {
      const { query } = await get_data_view_results_query({
        row_grain: ['player'],
        row_axes: ['year', 'week'],
        columns: ['player_week_projected_points_added']
      })
      expect(query.toString()).to.include(
        'league_format_player_projection_values'
      )
    })

    // And the SEASON period is not swept up by the refusal. Its rows carry no
    // week column, so it declares no requirement and stays resolvable under
    // every request shape -- the whole point of splitting the periods.
    it('still admits the season period with no week anywhere in the request', async () => {
      const { query } = await get_data_view_results_query({
        row_grain: ['player'],
        row_axes: [],
        columns: ['player_season_projected_points_added']
      })
      expect(query.toString()).to.include(
        'league_format_player_season_projection_values'
      )
    })
  })
})
