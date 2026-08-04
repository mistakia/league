/* global describe it before */

import * as chai from 'chai'
import MockDate from 'mockdate'

import { get_data_view_results_query } from '#libs-server'

const expect = chai.expect

// Integration coverage for the output-aggregator dispatch: what SQL each
// (period, aggregation) tuple emits, how CTEs are keyed and reused, and which
// combinations the request-time normalizer drops or refuses.
//
// The snapshot fixtures under test/data-view-queries/ pin whole queries and
// catch drift, but they cannot say WHY a query looks the way it does, and they
// carry one output-param fixture between them. These assertions name the
// contract instead: threshold filtering happens after per-period aggregation,
// distinct params must not share a CTE, and the week row axis is the one place
// an output param is silently dropped rather than honored.

const build_sql = async ({ column_id, params, row_axes = [], sort = [] }) => {
  const { query } = await get_data_view_results_query({
    columns: [{ column_id, params }],
    sort,
    where: [],
    row_axes
  })
  return query.toString()
}

const build_multi_column_sql = async ({ columns, row_axes = [] }) => {
  const { query } = await get_data_view_results_query({
    columns,
    sort: [],
    where: [],
    row_axes
  })
  return query.toString()
}

const rate_per_game = { period: 'game', aggregation: 'rate', threshold: null }
const count_100_games = {
  period: 'game',
  aggregation: 'count',
  threshold: { op: '>=', value: 100 }
}

const cte_names_matching = (sql, prefix) => {
  const pattern = new RegExp(`"(${prefix}_[0-9a-f]+)" as materialized`, 'g')
  return [...new Set([...sql.matchAll(pattern)].map((match) => match[1]))]
}

describe('data-views output aggregator', () => {
  before(() => {
    MockDate.reset()
  })

  describe('count aggregation', () => {
    it('filters on the aggregated period total, not on individual plays', async () => {
      const sql = await build_sql({
        column_id: 'player_receiving_yards_from_plays',
        params: { year: [2023], output: count_100_games }
      })

      // The threshold must sit in a FILTER on the outer COUNT. Pushed into the
      // CTE's WHERE it would test one play's yardage rather than the game's.
      expect(sql).to.match(
        /COUNT\(DISTINCT count_game_[0-9a-f]+\.period_key\) FILTER \(WHERE count_game_[0-9a-f]+\.m_[0-9a-f]+ >= 100\)/
      )
    })

    it('keys a game period by year, week and game id', async () => {
      const sql = await build_sql({
        column_id: 'player_receiving_yards_from_plays',
        params: { year: [2023], output: count_100_games }
      })

      expect(sql).to.include(
        "CONCAT(nfl_games.season_year, '_', nfl_games.week, '_', nfl_games.esbid) AS period_key"
      )
    })

    it('materializes the period CTE and pushes the year filter into it', async () => {
      const sql = await build_sql({
        column_id: 'player_receiving_yards_from_plays',
        params: { year: [2023], output: count_100_games }
      })

      const [cte_name] = cte_names_matching(sql, 'count_game')
      expect(cte_name, 'no materialized count_game CTE').to.be.a('string')

      const cte_body = sql.slice(
        sql.indexOf(`"${cte_name}" as materialized`),
        sql.indexOf(') select ')
      )
      expect(cte_body).to.include('"nfl_games"."season_year" in (2023)')
    })

    it('carries the threshold operator through to the FILTER', async () => {
      const sql = await build_sql({
        column_id: 'player_receiving_yards_from_plays',
        params: {
          year: [2023],
          output: {
            period: 'game',
            aggregation: 'count',
            threshold: { op: '<', value: 25 }
          }
        }
      })

      expect(sql).to.match(
        /FILTER \(WHERE count_game_[0-9a-f]+\.m_[0-9a-f]+ < 25\)/
      )
    })
  })

  describe('CTE identity', () => {
    it('gives two instances differing only in year their own CTE', async () => {
      const sql = await build_multi_column_sql({
        columns: [
          {
            column_id: 'player_receiving_yards_from_plays',
            params: { year: [2022], output: rate_per_game }
          },
          {
            column_id: 'player_receiving_yards_from_plays',
            params: { year: [2023], output: rate_per_game }
          }
        ]
      })

      // Collapsing these was a live wrong-data bug: both columns rendered the
      // same value because the CTE name hash ignored the differing param.
      expect(cte_names_matching(sql, 'rate_aggregate')).to.have.lengthOf(2)
    })

    it('gives two instances differing only in year_offset their own CTE', async () => {
      const sql = await build_multi_column_sql({
        columns: [
          {
            column_id: 'player_receiving_yards_from_plays',
            params: { year: [2023], year_offset: 0, output: rate_per_game }
          },
          {
            column_id: 'player_receiving_yards_from_plays',
            params: { year: [2023], year_offset: 1, output: rate_per_game }
          }
        ]
      })

      expect(cte_names_matching(sql, 'rate_aggregate')).to.have.lengthOf(2)
    })

    it('shares one CTE between two identical instances', async () => {
      const sql = await build_multi_column_sql({
        columns: [
          {
            column_id: 'player_receiving_yards_from_plays',
            params: { year: [2023], output: rate_per_game }
          },
          {
            column_id: 'player_receiving_yards_from_plays',
            params: { year: [2023], output: rate_per_game }
          }
        ]
      })

      expect(cte_names_matching(sql, 'rate_aggregate')).to.have.lengthOf(1)
    })
  })

  describe('week row axis sanitization', () => {
    it('silently drops a per-game rate under a week row axis', async () => {
      const sql = await build_sql({
        column_id: 'player_receiving_yards_from_plays',
        params: { year: [2023], output: rate_per_game },
        row_axes: ['year', 'week']
      })

      // A per-game rate on a per-week row is the week's own value divided by
      // one, so the param is dropped rather than honored or rejected.
      expect(sql).to.not.match(/rate_aggregate_[0-9a-f]+/)
    })

    it('refuses a per-season count under a week row axis', async () => {
      let thrown = null
      try {
        await build_sql({
          column_id: 'player_receiving_yards_from_plays',
          params: {
            year: [2023],
            output: {
              period: 'season',
              aggregation: 'count',
              threshold: { op: '>=', value: 1 }
            }
          },
          row_axes: ['year', 'week']
        })
      } catch (error) {
        thrown = error
      }

      expect(thrown, 'expected a thrown error').to.be.an('error')
      expect(thrown.message).to.include('season')
    })
  })
})
