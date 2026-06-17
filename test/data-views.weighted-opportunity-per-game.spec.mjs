/* global describe it */

import * as chai from 'chai'

import { get_data_view_results_query } from '#libs-server'

const expect = chai.expect

// Regression for the originating fixture /u/ff8020017620e22917275c2ec6b81397:
// player_weighted_opportunity_from_plays with per-game previously dropped the
// rate type silently (strip_outer_sum returned null for the ROUND(SUM(...),2)
// render) and rendered the season total. The measure-first migration declares
// it { additive, expr: CASE, decimals: 2 } so per-game now divides the
// re-materialized measure by games and rounds to 2 decimals.

describe('data-views weighted-opportunity per-game regression', () => {
  it('divides the numerator by rate_type_total_count and wraps in ROUND(..., 2)', async () => {
    const { query } = await get_data_view_results_query({
      columns: [
        {
          column_id: 'player_weighted_opportunity_from_plays',
          params: {
            year: [2023],
            output: { period: 'game', aggregation: 'rate', threshold: null }
          }
        }
      ]
    })
    const sql = query.toString()
    // ROUND(CAST(MAX(<num>) AS DECIMAL) / NULLIF(CAST(MAX(<denom>.rate_type_total_count) AS DECIMAL), 0), 2) AS weighted_opportunity_from_plays_0
    expect(sql).to.match(
      /ROUND\(\s*CAST\(MAX\([^)]+\) AS DECIMAL\)\s*\/ NULLIF\(\s*CAST\(MAX\([^)]+\.rate_type_total_count\) AS DECIMAL\),\s*0\),\s*2\)\s* AS weighted_opportunity_from_plays_0/
    )
    // the additive numerator CTE re-materializes the weighted-opportunity CASE
    expect(sql).to.match(/SUM\(CASE WHEN nfl_plays\.ydl_100 <= 20/)
  })
})
