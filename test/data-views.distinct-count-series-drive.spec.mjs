/* global describe it */

import * as chai from 'chai'

import { get_data_view_results_query } from '#libs-server'

const expect = chai.expect

// Per-game (rate) output param. Exercises the output aggregator so the
// distinct-count numerator CTE and divisor are emitted.
const per_game = { period: 'game', aggregation: 'rate', threshold: null }

const build_sql = async (request) => {
  const { query } = await get_data_view_results_query(request)
  return query.toString()
}

describe('data-views distinct-count series/drive per-game', () => {
  it('team_series_count_from_plays per-game emits COUNT(DISTINCT) numerator and a divisor (not SUM(DISTINCT))', async () => {
    const sql = await build_sql({
      row_grain: ['team'],
      columns: [
        {
          column_id: 'team_series_count_from_plays',
          params: { year: [2023], output: per_game }
        }
      ]
    })
    expect(sql).to.match(
      /COUNT\(DISTINCT CONCAT\(nfl_plays.esbid, '_', series_seq\)\)/
    )
    expect(sql).to.not.match(/SUM\(DISTINCT/)
    // a per-game divisor: the rate_type_total_count denominator CTE
    expect(sql).to.match(/rate_type_total_count/)
  })

  it('player_team_series_count_from_plays per-game emits COUNT(DISTINCT) numerator and a divisor', async () => {
    const sql = await build_sql({
      columns: [
        {
          column_id: 'player_team_series_count_from_plays',
          params: { year: [2023], output: per_game }
        }
      ]
    })
    expect(sql).to.match(
      /COUNT\(DISTINCT CONCAT\(nfl_plays.esbid, '_', series_seq\)\)/
    )
    expect(sql).to.not.match(/SUM\(DISTINCT/)
    expect(sql).to.match(/rate_type_total_count/)
  })

  it('team_drive_count_from_plays per-game emits COUNT(DISTINCT) numerator (not SUM(DISTINCT))', async () => {
    const sql = await build_sql({
      row_grain: ['team'],
      columns: [
        {
          column_id: 'team_drive_count_from_plays',
          params: { year: [2023], output: per_game }
        }
      ]
    })
    expect(sql).to.match(
      /COUNT\(DISTINCT CONCAT\(nfl_plays.esbid, '_', drive_seq\)\)/
    )
    expect(sql).to.not.match(/SUM\(DISTINCT/)
    expect(sql).to.match(/rate_type_total_count/)
  })
})
