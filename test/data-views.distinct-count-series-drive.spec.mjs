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
      /COUNT\(DISTINCT CONCAT\(nfl_plays.esbid, '_', series_sequence\)\)/
    )
    expect(sql).to.not.match(/SUM\(DISTINCT/)
    // a per-game divisor: the rate_type_total_count denominator CTE
    expect(sql).to.match(/rate_type_total_count/)
  })

  // This asserted the same SHAPE on the `player_team_` variant, and the shape
  // it blessed could not execute: the aggregator groups the fact scan by the
  // column's own subject id, and a `plays` source names no player, so the CTE
  // read `nfl_plays.pid AS pid` and Postgres answered `column nfl_plays.pid
  // does not exist`. Measured at 95a949c6e, ALL 17 advertised `player_team_`
  // columns failed that way and NONE succeeded -- a golden blind to a defect
  // its own emitter shared. The variant advertises no aggregation now, so the
  // dispatcher skips it and the column renders its season value; the assertion
  // is that no aggregator CTE is emitted at all.
  it('player_team_series_count_from_plays does not reach the aggregator', async () => {
    const sql = await build_sql({
      columns: [
        {
          column_id: 'player_team_series_count_from_plays',
          params: { year: [2023], output: per_game }
        }
      ]
    })
    expect(sql).to.not.match(/rate_type_total_count/)
    expect(sql).to.not.match(/nfl_plays\.pid/)
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
      /COUNT\(DISTINCT CONCAT\(nfl_plays.esbid, '_', drive_sequence\)\)/
    )
    expect(sql).to.not.match(/SUM\(DISTINCT/)
    expect(sql).to.match(/rate_type_total_count/)
  })
})
