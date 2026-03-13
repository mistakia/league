/* global describe it before */

import * as chai from 'chai'
import debug from 'debug'

import { get_plays_view_results_query } from '#libs-server'
import { current_season } from '#constants'
import { compare_queries } from './utils/index.mjs'

const { expect } = chai

describe('Plays View', () => {
  before(() => {
    debug.enable('plays-view')
  })

  describe('browse mode', () => {
    it('should generate a basic browse query with core columns', async () => {
      const { query } = await get_plays_view_results_query({
        columns: ['play_type', 'play_down', 'play_yards_to_go'],
        prefix_columns: ['play_desc'],
        sort: [{ column_id: 'play_sequence', desc: true }],
        params: { year: [2023] }
      })

      const expected_query = `select "nfl_plays"."desc" as "play_desc", "nfl_plays"."play_type", "nfl_plays"."dwn" as "play_down", "nfl_plays"."yards_to_go" as "play_yards_to_go" from "nfl_plays" where "nfl_plays"."year" in (2023) order by "sequence" desc limit 500`

      compare_queries(query.toString(), expected_query)
    })

    it('should default year to current season when not specified', async () => {
      const { query } = await get_plays_view_results_query({
        columns: ['play_type'],
        params: {}
      })

      const expected_query = `select "nfl_plays"."play_type" from "nfl_plays" where "nfl_plays"."year" in (${current_season.year}) limit 500`

      compare_queries(query.toString(), expected_query)
    })

    it('should generate a browse query with passing columns and passer join', async () => {
      const { query } = await get_plays_view_results_query({
        columns: [
          'play_passer',
          'play_pass_yds',
          'play_air_yards',
          'play_comp'
        ],
        params: { year: [2023] }
      })

      const expected_query = `select passer.fname || ' ' || passer.lname as play_passer, "nfl_plays"."psr_pid", "nfl_plays"."pass_yds" as "play_pass_yds", "nfl_plays"."air_yards" as "play_air_yards", "nfl_plays"."comp" as "play_comp" from "nfl_plays" left join "player" as "passer" on "nfl_plays"."psr_pid" = "passer"."pid" where "nfl_plays"."year" in (2023) limit 500`

      compare_queries(query.toString(), expected_query)
    })

    it('should apply WHERE clause with = operator', async () => {
      const { query } = await get_plays_view_results_query({
        columns: ['play_type', 'play_pass_yds'],
        where: [
          {
            column_id: 'play_type',
            operator: '=',
            value: 'PASS'
          }
        ],
        params: { year: [2023] }
      })

      const expected_query = `select "nfl_plays"."play_type", "nfl_plays"."pass_yds" as "play_pass_yds" from "nfl_plays" where "nfl_plays"."year" in (2023) and nfl_plays.play_type = 'PASS' limit 500`

      compare_queries(query.toString(), expected_query)
    })

    it('should apply WHERE clause with IN operator', async () => {
      const { query } = await get_plays_view_results_query({
        columns: ['play_type', 'play_down'],
        where: [
          {
            column_id: 'play_down',
            operator: 'IN',
            value: [1, 2]
          }
        ],
        params: { year: [2023] }
      })

      const expected_query = `select "nfl_plays"."play_type", "nfl_plays"."dwn" as "play_down" from "nfl_plays" where "nfl_plays"."year" in (2023) and nfl_plays.dwn in (1, 2) limit 500`

      compare_queries(query.toString(), expected_query)
    })

    it('should apply pagination with offset and limit', async () => {
      const { query } = await get_plays_view_results_query({
        columns: ['play_type'],
        params: { year: [2023] },
        offset: 100,
        limit: 50
      })

      const expected_query = `select "nfl_plays"."play_type" from "nfl_plays" where "nfl_plays"."year" in (2023) limit 50 offset 100`

      compare_queries(query.toString(), expected_query)
    })

    it('should reject limit exceeding 2000', async () => {
      try {
        await get_plays_view_results_query({
          columns: ['play_type'],
          params: { year: [2023] },
          limit: 5000
        })
        throw new Error('Expected an error to be thrown')
      } catch (error) {
        expect(error.message).to.include('limit')
      }
    })

    it('should select nfl_plays.* when no columns specified', async () => {
      const { query } = await get_plays_view_results_query({
        columns: [],
        params: { year: [2023] }
      })

      const expected_query = `select "nfl_plays".* from "nfl_plays" where "nfl_plays"."year" in (2023) limit 500`

      compare_queries(query.toString(), expected_query)
    })

    it('should apply WHERE clause with player pid filter for selected player', async () => {
      const { query } = await get_plays_view_results_query({
        columns: ['play_type', 'play_pass_yds', 'play_air_yards', 'play_comp'],
        prefix_columns: ['play_desc'],
        where: [
          {
            column_id: 'play_passer_pid',
            operator: '=',
            value: 'test-pid-123'
          }
        ],
        sort: [{ column_id: 'play_sequence', desc: true }],
        params: { year: [2023] }
      })

      const expected_query = `select "nfl_plays"."desc" as "play_desc", "nfl_plays"."play_type", "nfl_plays"."pass_yds" as "play_pass_yds", "nfl_plays"."air_yards" as "play_air_yards", "nfl_plays"."comp" as "play_comp" from "nfl_plays" where "nfl_plays"."year" in (2023) and nfl_plays.psr_pid = 'test-pid-123' order by "sequence" desc limit 500`

      compare_queries(query.toString(), expected_query)
    })
  })

  describe('aggregate mode', () => {
    it('should generate aggregate query grouped by passer', async () => {
      const { query } = await get_plays_view_results_query({
        columns: ['play_passer', 'play_pass_yds', 'play_comp'],
        group_by: 'player_passer',
        params: { year: [2023] }
      })

      const expected_query = `select MAX(passer.fname || ' ' || passer.lname) as play_passer, SUM(nfl_plays.pass_yds) as play_pass_yds, SUM(CASE WHEN nfl_plays.comp = true THEN 1 ELSE 0 END) as play_comp, COUNT(*) as play_count from "nfl_plays" left join "player" as "passer" on "nfl_plays"."psr_pid" = "passer"."pid" where "nfl_plays"."year" in (2023) group by "nfl_plays"."psr_pid" limit 500`

      compare_queries(query.toString(), expected_query)
    })

    it('should generate aggregate query grouped by team', async () => {
      const { query } = await get_plays_view_results_query({
        columns: ['play_off_team', 'play_pass_yds'],
        group_by: 'team',
        params: { year: [2023] }
      })

      const expected_query = `select "nfl_plays"."pos_team" as "play_off_team", SUM(nfl_plays.pass_yds) as play_pass_yds, COUNT(*) as play_count from "nfl_plays" where "nfl_plays"."year" in (2023) group by "nfl_plays"."pos_team" limit 500`

      compare_queries(query.toString(), expected_query)
    })

    it('should generate aggregate query grouped by game with auto-join', async () => {
      const { query } = await get_plays_view_results_query({
        columns: ['play_pass_yds'],
        group_by: 'game',
        params: { year: [2023] }
      })

      const expected_query = `select "nfl_plays"."esbid", "nfl_games"."week", "nfl_games"."h", "nfl_games"."v", SUM(nfl_plays.pass_yds) as play_pass_yds, COUNT(*) as play_count from "nfl_plays" left join "nfl_games" on "nfl_plays"."esbid" = "nfl_games"."esbid" where "nfl_plays"."year" in (2023) group by "nfl_plays"."esbid", "nfl_games"."week", "nfl_games"."h", "nfl_games"."v" limit 500`

      compare_queries(query.toString(), expected_query)
    })

    it('should use HAVING for aggregate WHERE on use_having columns', async () => {
      const { query } = await get_plays_view_results_query({
        columns: ['play_passer', 'play_pass_yds'],
        group_by: 'player_passer',
        where: [
          {
            column_id: 'play_pass_yds',
            operator: '>',
            value: 300
          }
        ],
        params: { year: [2023] }
      })

      const expected_query = `select MAX(passer.fname || ' ' || passer.lname) as play_passer, SUM(nfl_plays.pass_yds) as play_pass_yds, COUNT(*) as play_count from "nfl_plays" left join "player" as "passer" on "nfl_plays"."psr_pid" = "passer"."pid" where "nfl_plays"."year" in (2023) group by "nfl_plays"."psr_pid" having nfl_plays.pass_yds > 300 limit 500`

      compare_queries(query.toString(), expected_query)
    })

    it('should generate overall aggregate (no group by columns)', async () => {
      const { query } = await get_plays_view_results_query({
        columns: ['play_pass_yds', 'play_comp'],
        group_by: 'overall',
        params: { year: [2023] }
      })

      const expected_query = `select SUM(nfl_plays.pass_yds) as play_pass_yds, SUM(CASE WHEN nfl_plays.comp = true THEN 1 ELSE 0 END) as play_comp, COUNT(*) as play_count from "nfl_plays" where "nfl_plays"."year" in (2023) limit 500`

      compare_queries(query.toString(), expected_query)
    })
  })

  describe('cache TTL', () => {
    it('should return 1 hour cache TTL for current season', async () => {
      const { plays_view_metadata } = await get_plays_view_results_query({
        columns: ['play_type'],
        params: { year: [current_season.year] }
      })

      expect(plays_view_metadata.cache_ttl).to.equal(60 * 60)
    })

    it('should return 7 day cache TTL for historical season', async () => {
      const { plays_view_metadata } = await get_plays_view_results_query({
        columns: ['play_type'],
        params: { year: [2020] }
      })

      expect(plays_view_metadata.cache_ttl).to.equal(7 * 24 * 60 * 60)
    })

    it('should return 1 hour cache TTL when any year is current season', async () => {
      const { plays_view_metadata } = await get_plays_view_results_query({
        columns: ['play_type'],
        params: { year: [2020, current_season.year] }
      })

      expect(plays_view_metadata.cache_ttl).to.equal(60 * 60)
    })
  })

  describe('validation', () => {
    it('should throw on unknown column_id', async () => {
      try {
        await get_plays_view_results_query({
          columns: ['nonexistent_column'],
          params: { year: [2023] }
        })
        throw new Error('Expected an error to be thrown')
      } catch (error) {
        expect(error.message).to.equal('Unknown column: nonexistent_column')
      }
    })

    it('should throw on invalid group_by value', async () => {
      try {
        await get_plays_view_results_query({
          columns: ['play_type'],
          group_by: 'invalid_group',
          params: { year: [2023] }
        })
        throw new Error('Expected an error to be thrown')
      } catch (error) {
        expect(error.message).to.equal('Invalid group_by value: invalid_group')
      }
    })

    it('should throw on unknown column_id in where clause', async () => {
      try {
        await get_plays_view_results_query({
          columns: ['play_type'],
          where: [
            {
              column_id: 'fake_column',
              operator: '=',
              value: 'test'
            }
          ],
          params: { year: [2023] }
        })
        throw new Error('Expected an error to be thrown')
      } catch (error) {
        expect(error.message).to.equal('Unknown column: fake_column')
      }
    })

    it('should throw on unknown column_id in sort', async () => {
      try {
        await get_plays_view_results_query({
          columns: ['play_type'],
          sort: [{ column_id: 'fake_column', desc: true }],
          params: { year: [2023] }
        })
        throw new Error('Expected an error to be thrown')
      } catch (error) {
        expect(error.message).to.equal('Unknown column: fake_column')
      }
    })
  })

  describe('multiple WHERE clauses', () => {
    it('should apply multiple WHERE conditions', async () => {
      const { query } = await get_plays_view_results_query({
        columns: ['play_type', 'play_pass_yds', 'play_down'],
        where: [
          {
            column_id: 'play_type',
            operator: '=',
            value: 'PASS'
          },
          {
            column_id: 'play_down',
            operator: 'IN',
            value: [1, 2, 3]
          }
        ],
        params: { year: [2023] }
      })

      const expected_query = `select "nfl_plays"."play_type", "nfl_plays"."pass_yds" as "play_pass_yds", "nfl_plays"."dwn" as "play_down" from "nfl_plays" where "nfl_plays"."year" in (2023) and nfl_plays.play_type = 'PASS' and nfl_plays.dwn in (1, 2, 3) limit 500`

      compare_queries(query.toString(), expected_query)
    })
  })

  describe('sorting', () => {
    it('should apply ascending sort', async () => {
      const { query } = await get_plays_view_results_query({
        columns: ['play_type', 'play_pass_yds'],
        sort: [{ column_id: 'play_pass_yds', desc: false }],
        params: { year: [2023] }
      })

      const expected_query = `select "nfl_plays"."play_type", "nfl_plays"."pass_yds" as "play_pass_yds" from "nfl_plays" where "nfl_plays"."year" in (2023) order by "pass_yds" asc limit 500`

      compare_queries(query.toString(), expected_query)
    })

    it('should apply multiple sort columns', async () => {
      const { query } = await get_plays_view_results_query({
        columns: ['play_type', 'play_pass_yds', 'play_down'],
        sort: [
          { column_id: 'play_down', desc: false },
          { column_id: 'play_pass_yds', desc: true }
        ],
        params: { year: [2023] }
      })

      const expected_query = `select "nfl_plays"."play_type", "nfl_plays"."pass_yds" as "play_pass_yds", "nfl_plays"."dwn" as "play_down" from "nfl_plays" where "nfl_plays"."year" in (2023) order by "dwn" asc, "pass_yds" desc limit 500`

      compare_queries(query.toString(), expected_query)
    })
  })

  describe('string column resolution', () => {
    it('should accept column_id as string shorthand', async () => {
      const { query } = await get_plays_view_results_query({
        columns: ['play_type', 'play_down'],
        params: { year: [2023] }
      })

      const expected_query = `select "nfl_plays"."play_type", "nfl_plays"."dwn" as "play_down" from "nfl_plays" where "nfl_plays"."year" in (2023) limit 500`

      compare_queries(query.toString(), expected_query)
    })

    it('should accept column_id as object with params', async () => {
      const { query } = await get_plays_view_results_query({
        columns: [{ column_id: 'play_type', params: {} }],
        params: { year: [2023] }
      })

      const expected_query = `select "nfl_plays"."play_type" from "nfl_plays" where "nfl_plays"."year" in (2023) limit 500`

      compare_queries(query.toString(), expected_query)
    })
  })
})
