/* global describe it */
import * as chai from 'chai'

import {
  resolve_generated_table_state,
  RESOLVER_ERROR_CODES,
  ROW_AXES
} from '#libs-server/data-views/generation/resolve-generated-table-state.mjs'

const { expect } = chai

// A row axis is exempt from the registry check, because an axis is not a
// registry column -- a view split by year sorts on `year`, which no column
// definition provides. That exemption made the axis list a whitelist, and the
// resolver read it straight off the model's own answer, so the model could
// exempt any fabricated id from the one check that exists by calling it an
// axis. Measured, not hypothetical: a run emitted
// `row_axes: ['player_fantasy_points_per_game_from_seasonlogs']` -- a measure
// column as a row dimension -- and the resolver accepted the whole view.

const player_view = ({ row_axes }) => ({
  row_grain: ['player'],
  prefix_columns: ['player_name'],
  columns: [{ column_id: 'player_games_played' }],
  row_axes
})

describe('generated table_state resolver / row axes', () => {
  it('rejects an id that is not a row axis', () => {
    const result = resolve_generated_table_state({
      table_state: player_view({
        row_axes: ['player_fantasy_points_per_game_from_seasonlogs']
      })
    })

    expect(result.ok).to.equal(false)
    expect(result.errors.map((error) => error.code)).to.include(
      RESOLVER_ERROR_CODES.unknown_row_axis
    )
  })

  it('accepts every real row axis', () => {
    for (const axis of ROW_AXES) {
      const result = resolve_generated_table_state({
        table_state: player_view({ row_axes: [axis] })
      })
      expect(result.ok, `axis '${axis}' was rejected`).to.equal(true)
    }
  })

  it('does not let a bogus axis launder a fabricated column id', () => {
    // The whole point of the whitelist defect. Naming the fabricated id as an
    // axis used to skip the registry check on it everywhere else in the view.
    const result = resolve_generated_table_state({
      table_state: {
        row_grain: ['player'],
        prefix_columns: ['player_name'],
        columns: [{ column_id: 'player_vibes_rating' }],
        row_axes: ['player_vibes_rating']
      }
    })

    expect(result.ok).to.equal(false)
    expect(result.errors.map((error) => error.code)).to.include(
      RESOLVER_ERROR_CODES.unknown_column_id
    )
  })
})
