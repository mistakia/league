/* global describe it */

import * as chai from 'chai'

import { get_data_view_results_query } from '#libs-server'

const expect = chai.expect

const expect_subject_mismatch = async (request, column_id) => {
  try {
    await get_data_view_results_query(request)
  } catch (err) {
    expect(err.message).to.include('ColumnSubjectMismatch')
    expect(err.message).to.include(`'${column_id}'`)
    return
  }
  throw new Error(
    `expected ColumnSubjectMismatch for column '${column_id}' but no error was thrown`
  )
}

describe('data-views subject compatibility', () => {
  it('rejects player-grain prefix column under team subject', async () => {
    await expect_subject_mismatch(
      {
        subjects: ['team'],
        prefix_columns: ['player_name'],
        columns: [
          { column_id: 'team_pass_attempts_from_plays', params: { year: [2023] } }
        ]
      },
      'player_name'
    )
  })

  it('rejects team-grain prefix column under player subject', async () => {
    await expect_subject_mismatch(
      {
        subjects: ['player'],
        prefix_columns: ['team_code'],
        columns: []
      },
      'team_code'
    )
  })

  it('rejects player-grain where-clause column under team subject', async () => {
    await expect_subject_mismatch(
      {
        subjects: ['team'],
        columns: [
          { column_id: 'team_pass_attempts_from_plays', params: { year: [2023] } }
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
        subjects: ['team'],
        columns: [
          { column_id: 'player_name' },
          { column_id: 'team_pass_attempts_from_plays', params: { year: [2023] } }
        ]
      },
      'player_name'
    )
  })
})
