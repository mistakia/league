/* global describe it */

import * as chai from 'chai'

import { get_data_view_results_query } from '#libs-server'

const expect = chai.expect

// Guards the group_by-period rate denominator invariant (per_team_drive /
// per_team_series / per_team_quarter / per_team_half, and the parallel player
// scaffolding in per-player-play / per-player-route).
//
// The group_by dimension is encapsulated in the denominator's
// COUNT(DISTINCT CONCAT(esbid, <dim>)) expression in add_*_cte, which keeps the
// CTE at entity grain (team / gsis_it_id / gsis_id). The JOIN therefore must NOT
// correlate on the dimension -- there is no per-dimension column on the CTE to
// join against. An abandoned join branch used to reference a phantom
// `player_games.<dim>` alias (and CTE columns the denominator never projects);
// activating it would emit broken SQL or fan the denominator out. The branch was
// removed; this test fails if it (or the phantom alias) ever returns.

const team_rate_request = ({ period }) => ({
  columns: [
    {
      column_id: 'team_pass_attempts_from_plays',
      params: { year: [2023], output: { period, aggregation: 'rate', threshold: null } }
    }
  ],
  row_grain: ['team']
})

describe('data-views group_by rate denominator grain', () => {
  it('encapsulates the drive dimension in COUNT(DISTINCT ...), keeping the denominator at team grain', async () => {
    const { query } = await get_data_view_results_query(
      team_rate_request({ period: 'team_drive' })
    )
    const sql = query.toString()

    expect(sql).to.match(/rate_type_total_count/)
    // the dimension lives inside the denominator count, not a GROUP BY / join
    expect(sql).to.match(/count\(distinct concat\([^)]*drive_seq/i)
    // the removed join branch referenced a phantom player_games alias
    expect(sql).to.not.match(/player_games/)
  })

  it('does the same for the series dimension', async () => {
    const { query } = await get_data_view_results_query(
      team_rate_request({ period: 'team_series' })
    )
    const sql = query.toString()

    expect(sql).to.match(/count\(distinct concat\([^)]*series_seq/i)
    expect(sql).to.not.match(/player_games/)
  })
})
