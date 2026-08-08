/* global describe it */

import * as chai from 'chai'

import get_data_view_hash from '#libs-server/data-views/get-data-view-hash.mjs'

const expect = chai.expect

// The row grain decides the SUBJECT of every row, so two table states differing
// only in it are different result sets sharing nothing. Until 2026-08-08 it was
// absent from the hash inputs AND from the `/search` and export routes' body
// destructuring, so a team-grain view was computed at player grain and served
// under the key a player-grain caller reads.
describe('data-views row grain cache key', () => {
  const table_state = {
    columns: [
      {
        column_id: 'team_play_count_from_plays',
        params: { team_unit: ['off'], play_type: ['PASS', 'RUSH'] }
      }
    ],
    prefix_columns: ['team_code', 'team_name'],
    sort: [{ column_id: 'team_play_count_from_plays', desc: true }],
    user_id: null
  }

  it('separates team grain from player grain', () => {
    expect(
      get_data_view_hash({ ...table_state, row_grain: ['team'] })
    ).to.not.equal(
      get_data_view_hash({ ...table_state, row_grain: ['player'] })
    )
  })

  it('treats an absent grain as player grain', () => {
    // `get_data_view_results` defaults an absent grain to player, so an absent
    // grain, an empty array and an explicit player grain are one request. This
    // is also what keeps every existing player-grain key valid.
    const absent = get_data_view_hash({ ...table_state })
    const empty = get_data_view_hash({ ...table_state, row_grain: [] })
    const explicit = get_data_view_hash({
      ...table_state,
      row_grain: ['player']
    })

    expect(absent).to.equal(empty)
    expect(absent).to.equal(explicit)
  })

  it('separates each non-player grain from the others', () => {
    expect(
      get_data_view_hash({ ...table_state, row_grain: ['team'] })
    ).to.not.equal(
      get_data_view_hash({ ...table_state, row_grain: ['nfl_game'] })
    )
  })

  it('still refuses a caller that omits the viewer', () => {
    expect(() =>
      get_data_view_hash({
        columns: table_state.columns,
        row_grain: ['team']
      })
    ).to.throw(/requires user_id/)
  })
})
