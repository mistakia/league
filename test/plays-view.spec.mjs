/* global describe it before */

import * as chai from 'chai'

import { get_plays_view_results_query } from '#libs-server'
import plays_view_column_definitions from '#libs-server/plays-view/column-definitions/index.mjs'
import plays_view_fields_index from '#libs-shared/plays-view-fields-index.mjs'
import { current_season } from '#constants'
import { compare_queries } from './utils/index.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const { expect } = chai

describe('Plays View', () => {
  before(() => {
    enable_debug_namespaces('plays-view')
  })

  describe('browse mode', () => {
    it('should generate a basic browse query with core columns', async () => {
      const { query } = await get_plays_view_results_query({
        columns: ['play_type', 'play_down', 'play_yards_to_go'],
        prefix_columns: ['play_desc'],
        sort: [{ column_id: 'play_sequence', desc: true }],
        params: { year: [2023] }
      })

      const expected_query = `select "nfl_plays"."play_description" as "play_desc", "nfl_plays"."play_type", "nfl_plays"."down_number" as "play_down", "nfl_plays"."yards_to_go" as "play_yards_to_go" from "nfl_plays" where "nfl_plays"."season_year" in (2023) and "nfl_plays"."season_type" in ('REG') order by nfl_plays.sequence desc NULLS LAST limit 500`

      compare_queries(query.toString(), expected_query)
    })

    it('should default year to current season when not specified', async () => {
      const { query } = await get_plays_view_results_query({
        columns: ['play_type'],
        params: {}
      })

      const expected_query = `select "nfl_plays"."play_type" from "nfl_plays" where "nfl_plays"."season_year" in (${current_season.last_completed_season_year}) and "nfl_plays"."season_type" in ('REG') limit 500`

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

      const expected_query = `select passer.first_name || ' ' || passer.last_name as play_passer, "nfl_plays"."passer_pid", "nfl_plays"."pass_yards" as "play_pass_yds", "nfl_plays"."air_yards" as "play_air_yards", "nfl_plays"."is_completion" as "play_comp" from "nfl_plays" left join "player" as "passer" on "nfl_plays"."passer_pid" = "passer"."pid" where "nfl_plays"."season_year" in (2023) and "nfl_plays"."season_type" in ('REG') limit 500`

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

      const expected_query = `select "nfl_plays"."play_type", "nfl_plays"."pass_yards" as "play_pass_yds" from "nfl_plays" where "nfl_plays"."season_year" in (2023) and "nfl_plays"."season_type" in ('REG') and nfl_plays.play_type = 'PASS' limit 500`

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

      const expected_query = `select "nfl_plays"."play_type", "nfl_plays"."down_number" as "play_down" from "nfl_plays" where "nfl_plays"."season_year" in (2023) and "nfl_plays"."season_type" in ('REG') and nfl_plays.down_number in (1, 2) limit 500`

      compare_queries(query.toString(), expected_query)
    })

    it('should apply pagination with offset and limit', async () => {
      const { query } = await get_plays_view_results_query({
        columns: ['play_type'],
        params: { year: [2023] },
        offset: 100,
        limit: 50
      })

      const expected_query = `select "nfl_plays"."play_type" from "nfl_plays" where "nfl_plays"."season_year" in (2023) and "nfl_plays"."season_type" in ('REG') limit 50 offset 100`

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

      const expected_query = `select "nfl_plays".* from "nfl_plays" where "nfl_plays"."season_year" in (2023) and "nfl_plays"."season_type" in ('REG') limit 500`

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

      const expected_query = `select "nfl_plays"."play_description" as "play_desc", "nfl_plays"."play_type", "nfl_plays"."pass_yards" as "play_pass_yds", "nfl_plays"."air_yards" as "play_air_yards", "nfl_plays"."is_completion" as "play_comp" from "nfl_plays" where "nfl_plays"."season_year" in (2023) and "nfl_plays"."season_type" in ('REG') and nfl_plays.passer_pid = 'test-pid-123' order by nfl_plays.sequence desc NULLS LAST limit 500`

      compare_queries(query.toString(), expected_query)
    })

    // The coverage and dropback columns are what make a "this passer's plays
    // against this coverage shell" view expressible at all -- the data has been
    // in nfl_plays since 2018 and had no plays-view column until 2026-09-04.
    // Asserted on the three-clause conjunction rather than one column at a time,
    // because the view they exist for needs all three in one WHERE.
    it('should filter on passer, dropback and coverage shell together', async () => {
      const { query } = await get_plays_view_results_query({
        columns: [
          'play_desc',
          'play_coverage_type',
          'play_man_zone',
          'play_is_qb_dropback'
        ],
        where: [
          {
            column_id: 'play_passer_pid',
            operator: '=',
            value: 'test-pid-123'
          },
          {
            column_id: 'play_is_qb_dropback',
            operator: '=',
            value: 'true'
          },
          {
            column_id: 'play_coverage_type',
            operator: 'IN',
            value: ['COVER_2', 'COVER_2_MAN']
          }
        ],
        params: { year: [2024] }
      })

      const expected_query = `select "nfl_plays"."play_description" as "play_desc", COALESCE(nfl_plays.coverage_type::text, CASE WHEN nfl_plays.coverage_type_ngs = '2_MAN' THEN 'COVER_2_MAN' ELSE nfl_plays.coverage_type_ngs END) as play_coverage_type, CASE nfl_plays.man_zone WHEN 'MAN' THEN 'MAN_COVERAGE' WHEN 'ZONE' THEN 'ZONE_COVERAGE' ELSE nfl_plays.man_zone END as play_man_zone, "nfl_plays"."is_qb_dropback" as "play_is_qb_dropback" from "nfl_plays" where "nfl_plays"."season_year" in (2024) and "nfl_plays"."season_type" in ('REG') and nfl_plays.passer_pid = 'test-pid-123' and nfl_plays.is_qb_dropback = 'true' and COALESCE(nfl_plays.coverage_type::text, CASE WHEN nfl_plays.coverage_type_ngs = '2_MAN' THEN 'COVER_2_MAN' ELSE nfl_plays.coverage_type_ngs END) in ('COVER_2', 'COVER_2_MAN') limit 500`

      compare_queries(query.toString(), expected_query)
    })

    // The filter has to read the SAME fallback the select renders. A filter
    // written against the raw charted column would answer a 2021 request with
    // an empty table while the column displayed a populated one.
    it('should filter coverage through the fallback in a season our charting does not cover', async () => {
      const { query } = await get_plays_view_results_query({
        columns: ['play_coverage_type', 'play_coverage_source'],
        where: [
          {
            column_id: 'play_coverage_type',
            operator: '=',
            value: 'COVER_2'
          }
        ],
        params: { year: [2021] }
      })

      const expected_query = `select COALESCE(nfl_plays.coverage_type::text, CASE WHEN nfl_plays.coverage_type_ngs = '2_MAN' THEN 'COVER_2_MAN' ELSE nfl_plays.coverage_type_ngs END) as play_coverage_type, CASE WHEN nfl_plays.coverage_type IS NOT NULL THEN 'charted' WHEN nfl_plays.coverage_type_ngs IS NOT NULL THEN 'next_gen_stats' END as play_coverage_source from "nfl_plays" where "nfl_plays"."season_year" in (2021) and "nfl_plays"."season_type" in ('REG') and COALESCE(nfl_plays.coverage_type::text, CASE WHEN nfl_plays.coverage_type_ngs = '2_MAN' THEN 'COVER_2_MAN' ELSE nfl_plays.coverage_type_ngs END) = 'COVER_2' limit 500`

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

      const expected_query = `select MAX(passer.first_name || ' ' || passer.last_name) as play_passer, SUM(nfl_plays.pass_yards) as play_pass_yds, SUM(CASE WHEN nfl_plays.is_completion = true THEN 1 ELSE 0 END) as play_comp, COUNT(*) as play_count from "nfl_plays" left join "player" as "passer" on "nfl_plays"."passer_pid" = "passer"."pid" where "nfl_plays"."season_year" in (2023) and "nfl_plays"."season_type" in ('REG') group by "nfl_plays"."passer_pid" limit 500`

      compare_queries(query.toString(), expected_query)
    })

    it('should generate aggregate query grouped by team', async () => {
      const { query } = await get_plays_view_results_query({
        columns: ['play_off_team', 'play_pass_yds'],
        group_by: 'team',
        params: { year: [2023] }
      })

      const expected_query = `select "nfl_plays"."possession_nfl_team" as "play_off_team", SUM(nfl_plays.pass_yards) as play_pass_yds, COUNT(*) as play_count from "nfl_plays" where "nfl_plays"."season_year" in (2023) and "nfl_plays"."season_type" in ('REG') group by "nfl_plays"."possession_nfl_team" limit 500`

      compare_queries(query.toString(), expected_query)
    })

    it('should generate aggregate query grouped by game with auto-join', async () => {
      const { query } = await get_plays_view_results_query({
        columns: ['play_pass_yds'],
        group_by: 'game',
        params: { year: [2023] }
      })

      const expected_query = `select "nfl_plays"."esbid", "nfl_games"."week", "nfl_games"."home_nfl_team", "nfl_games"."away_nfl_team", SUM(nfl_plays.pass_yards) as play_pass_yds, COUNT(*) as play_count from "nfl_plays" left join "nfl_games" on "nfl_plays"."esbid" = "nfl_games"."esbid" where "nfl_plays"."season_year" in (2023) and "nfl_plays"."season_type" in ('REG') group by "nfl_plays"."esbid", "nfl_games"."week", "nfl_games"."home_nfl_team", "nfl_games"."away_nfl_team" limit 500`

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

      const expected_query = `select MAX(passer.first_name || ' ' || passer.last_name) as play_passer, SUM(nfl_plays.pass_yards) as play_pass_yds, COUNT(*) as play_count from "nfl_plays" left join "player" as "passer" on "nfl_plays"."passer_pid" = "passer"."pid" where "nfl_plays"."season_year" in (2023) and "nfl_plays"."season_type" in ('REG') group by "nfl_plays"."passer_pid" having nfl_plays.pass_yards > 300 limit 500`

      compare_queries(query.toString(), expected_query)
    })

    it('should generate overall aggregate (no group by columns)', async () => {
      const { query } = await get_plays_view_results_query({
        columns: ['play_pass_yds', 'play_comp'],
        group_by: 'overall',
        params: { year: [2023] }
      })

      const expected_query = `select SUM(nfl_plays.pass_yards) as play_pass_yds, SUM(CASE WHEN nfl_plays.is_completion = true THEN 1 ELSE 0 END) as play_comp, COUNT(*) as play_count from "nfl_plays" where "nfl_plays"."season_year" in (2023) and "nfl_plays"."season_type" in ('REG') limit 500`

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

      const expected_query = `select "nfl_plays"."play_type", "nfl_plays"."pass_yards" as "play_pass_yds", "nfl_plays"."down_number" as "play_down" from "nfl_plays" where "nfl_plays"."season_year" in (2023) and "nfl_plays"."season_type" in ('REG') and nfl_plays.play_type = 'PASS' and nfl_plays.down_number in (1, 2, 3) limit 500`

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

      const expected_query = `select "nfl_plays"."play_type", "nfl_plays"."pass_yards" as "play_pass_yds" from "nfl_plays" where "nfl_plays"."season_year" in (2023) and "nfl_plays"."season_type" in ('REG') order by nfl_plays.pass_yards asc NULLS LAST limit 500`

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

      const expected_query = `select "nfl_plays"."play_type", "nfl_plays"."pass_yards" as "play_pass_yds", "nfl_plays"."down_number" as "play_down" from "nfl_plays" where "nfl_plays"."season_year" in (2023) and "nfl_plays"."season_type" in ('REG') order by nfl_plays.down_number asc NULLS LAST, nfl_plays.pass_yards desc NULLS LAST limit 500`

      compare_queries(query.toString(), expected_query)
    })
  })

  describe('string column resolution', () => {
    it('should accept column_id as string shorthand', async () => {
      const { query } = await get_plays_view_results_query({
        columns: ['play_type', 'play_down'],
        params: { year: [2023] }
      })

      const expected_query = `select "nfl_plays"."play_type", "nfl_plays"."down_number" as "play_down" from "nfl_plays" where "nfl_plays"."season_year" in (2023) and "nfl_plays"."season_type" in ('REG') limit 500`

      compare_queries(query.toString(), expected_query)
    })

    it('should accept column_id as object with params', async () => {
      const { query } = await get_plays_view_results_query({
        columns: [{ column_id: 'play_type', params: {} }],
        params: { year: [2023] }
      })

      const expected_query = `select "nfl_plays"."play_type" from "nfl_plays" where "nfl_plays"."season_year" in (2023) and "nfl_plays"."season_type" in ('REG') limit 500`

      compare_queries(query.toString(), expected_query)
    })
  })

  // The pairing this asserts is the one that bites: a view that scopes its own
  // years loses the REG default, so without an explicit season-type clause it
  // returns preseason plays under a regular-season-looking table. Measured on
  // production 2026-09-05 -- the first row of the Burrow Cover-2 view was a
  // 2025 preseason snap.
  describe('season scope', () => {
    it('emits no season-type filter when the view sets its own years', async () => {
      const { query } = await get_plays_view_results_query({
        columns: ['play_type'],
        where: [{ column_id: 'play_year', operator: 'IN', value: [2024] }]
      })

      expect(query.toString()).to.not.include('season_type')
    })

    it('lets a view restore the regular-season scope with play_seas_type', async () => {
      const { query } = await get_plays_view_results_query({
        columns: ['play_type'],
        where: [
          { column_id: 'play_year', operator: 'IN', value: [2024] },
          { column_id: 'play_seas_type', operator: '=', value: 'REG' }
        ]
      })

      expect(query.toString()).to.include("nfl_plays.season_type = 'REG'")
    })
  })

  // A plays column is three separate declarations -- the server definition, the
  // shared description, and the client field -- and nothing made them agree.
  // The failure is silent in both directions: a column with no description
  // renders a header with an empty tooltip, and a description for a column that
  // no longer exists is prose nobody can reach. The client field list cannot be
  // imported here (it carries JSX), so this asserts the two registries a server
  // test can see; the client list is covered by the column controls rendering
  // nothing for an id it does not know.
  describe('column registry parity', () => {
    it('gives every column a description and every description a column', () => {
      const column_ids = Object.keys(plays_view_column_definitions)
      const described_ids = Object.keys(plays_view_fields_index)

      expect(column_ids.filter((id) => !plays_view_fields_index[id])).to.eql([])
      expect(
        described_ids.filter((id) => !plays_view_column_definitions[id])
      ).to.eql([])
    })
  })
})
