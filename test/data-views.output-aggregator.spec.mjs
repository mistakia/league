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

      // The threshold must sit in a FILTER on the COUNT, testing the GAME's
      // aggregated total. Pushed into the period CTE's WHERE it would test one
      // play's yardage instead. That FILTER moved from the outer SELECT into
      // the per-period summary when the summary landed -- the grain it tests is
      // unchanged, which is what this asserts.
      expect(sql).to.match(
        /COUNT\(DISTINCT per_period_game_[0-9a-f]+\.period_key\) FILTER \(WHERE per_period_game_[0-9a-f]+\.m_[0-9a-f]+ >= 100\)/
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

    it('materializes the period CTE and pushes the year onto the fact scan, not nfl_games', async () => {
      const sql = await build_sql({
        column_id: 'player_receiving_yards_from_plays',
        params: { year: [2023], output: count_100_games }
      })

      const [cte_name] = cte_names_matching(sql, 'per_period_game')
      expect(cte_name, 'no materialized per_period_game CTE').to.be.a('string')

      const cte_body = sql.slice(
        sql.indexOf(`"${cte_name}" as materialized`),
        sql.indexOf(') select ')
      )
      // The year has to be on nfl_plays for the partition pruning, and it has
      // to be ONLY there: duplicating it on the nfl_games join flips the CTE
      // onto a nested loop that reads 5.98M buffers against 179K, which is a
      // slower query than the unpruned one it replaced.
      expect(cte_body).to.include('"nfl_plays"."season_year" in (2023)')
      // Anchored on the PREDICATE rather than the name: the CTE still projects
      // and groups by nfl_games.season_year, so a bare name check passes over
      // the duplicate this asserts against.
      expect(cte_body).to.not.include('"nfl_games"."season_year" in (')
    })

    it('applies the same rule to the ROLE-UNION builder, which used to keep the duplicate', async () => {
      // The two builders disagreed until this landed: build_batched_period_cte
      // dropped the nfl_games scope while build_role_union_period_cte still
      // emitted it, which read as a deliberate carve-out and was only ever an
      // unmeasured one. Measured back to back on production 2026-08-21, the
      // de-duplicated role-union statement runs 242-256ms against 291-379ms and
      // its CTE returns an identical row set in both EXCEPT ALL directions.
      //
      // Pinned here rather than left to the eight goldens that moved with it:
      // a golden records WHAT the SQL is and cannot say that the two builders
      // must agree, which is the thing a future reader would otherwise
      // "repair" in the wrong direction.
      const sql = await build_sql({
        column_id: 'player_solo_tackles_from_plays',
        params: { year: [2023], output: count_100_games }
      })

      const [cte_name] = cte_names_matching(sql, 'per_period_game')
      expect(cte_name, 'no materialized per_period_game CTE').to.be.a('string')

      const cte_body = sql.slice(
        sql.indexOf(`"${cte_name}" as materialized`),
        sql.indexOf(') select ')
      )
      // The positive half is what keeps the negative half from passing
      // vacuously: an assertion that a predicate is ABSENT is satisfied just as
      // well by a CTE body this slice failed to capture.
      expect(cte_body).to.include('"nfl_plays"."season_year" in (2023)')
      expect(cte_body).to.not.include('"nfl_games"."season_year" in (')
      expect(cte_body).to.not.include('"nfl_games"."season_type" in (')
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
        /FILTER \(WHERE per_period_game_[0-9a-f]+\.m_[0-9a-f]+ < 25\)/
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

  describe('year row axis sanitization', () => {
    it('silently drops a per-season count under a year row axis', async () => {
      const sql = await build_sql({
        column_id: 'player_receiving_yards_from_plays',
        params: {
          year: [2022, 2023],
          output: {
            period: 'season',
            aggregation: 'count',
            threshold: { op: '>=', value: 1 }
          }
        },
        row_axes: ['year']
      })

      // A row IS a season here, so counting seasons clearing a threshold is a
      // 0/1 indicator rather than a count. Dropped, not thrown -- see the
      // matching disposition for a per-game rate on a per-week row above.
      expect(sql).to.not.match(/per_period_season_[0-9a-f]+/)
    })

    it('keeps a per-game count under a year row axis', async () => {
      const sql = await build_sql({
        column_id: 'player_receiving_yards_from_plays',
        params: { year: [2023], output: count_100_games },
        row_axes: ['year']
      })

      // The game period is finer than the row, so the count is meaningful and
      // the guard must not reach it.
      expect(sql).to.match(/per_period_game_[0-9a-f]+/)
    })
  })

  describe('season period key', () => {
    it('keys a season period by the year alone, not by (year, season type)', async () => {
      const sql = await build_sql({
        column_id: 'player_receiving_yards_from_plays',
        params: {
          year: [2022, 2023],
          output: {
            period: 'season',
            aggregation: 'count',
            threshold: { op: '>=', value: 1 }
          }
        }
      })

      expect(sql).to.include('nfl_games.season_year AS period_key')
      // season_type filters which games are in scope; it does not partition
      // the span, so it must not appear in the key.
      expect(sql).to.not.include(
        "CONCAT(nfl_games.season_year, '_', nfl_games.season_type)"
      )
    })
  })
})
