/* global describe it before */

import MockDate from 'mockdate'
import * as chai from 'chai'

import { get_data_view_results_query } from '#libs-server'

// Regression: when a player-cell view selects multiple columns that route
// through the player_year -> team_year identity bridge (e.g. several
// per_team_pass_play rate-type columns), the bridge's `add_cte` must emit
// the shared `player_year_teams` CTE at most once. Before the fix, the
// per-team-play-wrap registration in
// libs-server/data-views/rate-type/per-team-play-wrap.mjs called
// `bridge.add_cte` once per column without guarding against re-emission, so
// PostgreSQL rejected the WITH clause with 42712 (duplicate_alias).

const { expect } = chai

const count_occurrences = (haystack, needle) => {
  let count = 0
  let i = 0
  while (true) {
    const idx = haystack.indexOf(needle, i)
    if (idx === -1) return count
    count++
    i = idx + needle.length
  }
}

describe('Data View CTE dedupe', () => {
  before(() => {
    MockDate.reset()
  })

  it('emits the player_year_teams CTE once across multiple per_team_pass_play columns', async () => {
    const request = {
      columns: [
        {
          column_id: 'player_receptions_from_plays',
          params: {
            year: [2023, 2024],
            route: ['SLANT'],
            rate_type: ['per_team_pass_play']
          }
        },
        {
          column_id: 'player_receptions_from_plays',
          params: {
            year: [2023, 2024],
            route: ['SCREEN'],
            rate_type: ['per_team_pass_play']
          }
        },
        {
          column_id: 'player_receptions_from_plays',
          params: {
            year: [2023, 2024],
            route: ['POST'],
            rate_type: ['per_team_pass_play']
          }
        }
      ],
      sort: [],
      where: []
    }

    const { query } = await get_data_view_results_query(request)
    const sql = query.toString()

    expect(
      count_occurrences(sql, '"player_year_teams" as materialized')
    ).to.equal(1)
  })
})
