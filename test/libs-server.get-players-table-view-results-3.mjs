/* global describe it before */
import MockDate from 'mockdate'
import debug from 'debug'

import { get_data_view_results_query } from '#libs-server'
import { constants } from '#libs-shared'
import { compare_queries } from './utils/index.mjs'

describe('LIBS SERVER get_data_view_results', () => {
  before(() => {
    MockDate.reset()
    debug.enable('data-views')
  })

  it('team series success rate from plays', async () => {
    const { query } = await get_data_view_results_query({
      columns: [
        {
          column_id: 'team_series_conversion_rate_from_plays',
          params: {
            year: [2024]
          }
        }
      ],
      sort: [
        {
          column_id: 'team_series_conversion_rate_from_plays',
          desc: true
        }
      ]
    })
    const expected_query = `with "ta883516fdb1bedbb0e8e9205ee6ae188" as (select "nfl_plays"."off" as "nfl_team", COUNT(DISTINCT CASE WHEN series_result IN ('FIRST_DOWN', 'TOUCHDOWN') THEN CONCAT(esbid, '_', series_seq) END) as team_series_conversion_rate_from_plays_numerator, COUNT(DISTINCT CASE WHEN series_result NOT IN ('QB_KNEEL', 'END_OF_HALF') THEN CONCAT(esbid, '_', series_seq) END) as team_series_conversion_rate_from_plays_denominator from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."year" in (2024) and "nfl_plays"."seas_type" in ('REG') group by "nfl_plays"."off"), "ta883516fdb1bedbb0e8e9205ee6ae188_team_stats" as (select "ta883516fdb1bedbb0e8e9205ee6ae188"."nfl_team", sum(ta883516fdb1bedbb0e8e9205ee6ae188.team_series_conversion_rate_from_plays_numerator) / sum(ta883516fdb1bedbb0e8e9205ee6ae188.team_series_conversion_rate_from_plays_denominator) as team_series_conversion_rate_from_plays from "ta883516fdb1bedbb0e8e9205ee6ae188" group by "ta883516fdb1bedbb0e8e9205ee6ae188"."nfl_team") select "player"."pid", "ta883516fdb1bedbb0e8e9205ee6ae188_team_stats"."team_series_conversion_rate_from_plays" AS "team_series_conversion_rate_from_plays_0", "player"."pos" from "player" left join "ta883516fdb1bedbb0e8e9205ee6ae188_team_stats" on "ta883516fdb1bedbb0e8e9205ee6ae188_team_stats"."nfl_team" = "player"."current_nfl_team" group by "ta883516fdb1bedbb0e8e9205ee6ae188_team_stats"."team_series_conversion_rate_from_plays", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('player nfl teams', async () => {
    const { query } = await get_data_view_results_query({
      columns: [
        {
          column_id: 'player_receiving_yards_from_plays',
          params: {
            year: [2020, 2021, 2022, 2023, 2024]
          }
        },
        {
          column_id: 'player_nfl_teams'
        }
      ],
      splits: ['year'],
      where: [
        {
          column_id: 'player_nfl_teams',
          operator: 'IN',
          value: ['CIN']
        }
      ],
      sort: [
        {
          column_id: 'player_receiving_yards_from_plays',
          desc: true
        }
      ]
    })
    const expected_query = `with "base_years" as (SELECT unnest(ARRAY[2020,2021,2022,2023,2024]) as year), "player_years" as (SELECT DISTINCT player.pid, base_years.year FROM player CROSS JOIN base_years), "td6be67d9d166e9f60060dd53d9c6596e" as (select "player_gamelogs"."pid", count(*) as "rate_type_total_count", array_agg(distinct player_gamelogs.tm) as teams, "nfl_games"."year" from "player_gamelogs" left join "nfl_games" on "nfl_games"."esbid" = "player_gamelogs"."esbid" where "nfl_games"."seas_type" in ('REG') and "player_gamelogs"."active" = true group by "nfl_games"."year", "player_gamelogs"."pid"), "t4e422f08bd5e7b8923d45ecc3da571f1" as (select COALESCE(trg_pid) as pid, "nfl_plays"."year", SUM(CASE WHEN comp = true THEN recv_yds ELSE 0 END) as rec_yds_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."year" in (2020, 2021, 2022, 2023, 2024) and "nfl_plays"."seas_type" in ('REG') group by "nfl_plays"."year", COALESCE(trg_pid)) select "player"."pid", td6be67d9d166e9f60060dd53d9c6596e.teams as player_nfl_teams_0, "t4e422f08bd5e7b8923d45ecc3da571f1"."rec_yds_from_plays" AS "rec_yds_from_plays_0", "player_years"."year", "player"."pos" from "player_years" inner join "player" on "player"."pid" = "player_years"."pid" left join "td6be67d9d166e9f60060dd53d9c6596e" on "td6be67d9d166e9f60060dd53d9c6596e"."pid" = "player"."pid" and "td6be67d9d166e9f60060dd53d9c6596e"."year" = "player_years"."year" left join "t4e422f08bd5e7b8923d45ecc3da571f1" on "t4e422f08bd5e7b8923d45ecc3da571f1"."pid" = "player"."pid" and t4e422f08bd5e7b8923d45ecc3da571f1.year = player_years.year and t4e422f08bd5e7b8923d45ecc3da571f1.year IN (2020,2021,2022,2023,2024) where td6be67d9d166e9f60060dd53d9c6596e.teams::text[] && ARRAY['CIN']::text[] group by td6be67d9d166e9f60060dd53d9c6596e.teams, "t4e422f08bd5e7b8923d45ecc3da571f1"."rec_yds_from_plays", "player_years"."year", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 3 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('team dova', async () => {
    const { query } = await get_data_view_results_query({
      columns: [
        {
          column_id: 'team_unit_adjusted_line_yards',
          params: {
            year: [2024],
            team_unit: ['offense'],
            matchup_opponent_type: ['current_week_opponent_total']
          }
        },
        {
          column_id: 'team_unit_dvoa',
          params: {
            year: [2024],
            team_unit: ['defense'],
            dvoa_type: 'pass_wr3_dvoa'
          }
        }
      ],
      sort: [
        {
          column_id: 'team_unit_adjusted_line_yards',
          desc: true
        }
      ]
    })
    const expected_query = `with "current_week_opponents" as (select "h" as "nfl_team", "v" as "opponent" from "public"."nfl_games" where "year" = ${constants.season.year} and "week" = ${constants.season.nfl_seas_week} and "seas_type" = '${constants.season.nfl_seas_type}' union select "v" as "nfl_team", "h" as "opponent" from "public"."nfl_games" where "year" = ${constants.season.year} and "week" = ${constants.season.nfl_seas_week} and "seas_type" = '${constants.season.nfl_seas_type}') select "player"."pid", "t41e00b9bde2622961e16bab51896f43c"."team_adjusted_line_yards" AS "team_adjusted_line_yards_0", t19bb7769b37e8f152a7e4ff0e4db8c1c.pass_wr3_dvoa as team_unit_dvoa_0, "player"."pos" from "player" inner join "current_week_opponents" on "player"."current_nfl_team" = "current_week_opponents"."nfl_team" left join "dvoa_team_unit_seasonlogs_index" as "t41e00b9bde2622961e16bab51896f43c" on "t41e00b9bde2622961e16bab51896f43c"."nfl_team" = "current_week_opponents"."opponent" and "t41e00b9bde2622961e16bab51896f43c"."year" = 2024 and "t41e00b9bde2622961e16bab51896f43c"."team_unit" = 'OFFENSE' left join "dvoa_team_unit_seasonlogs_index" as "t19bb7769b37e8f152a7e4ff0e4db8c1c" on "t19bb7769b37e8f152a7e4ff0e4db8c1c"."nfl_team" = "player"."current_nfl_team" and "t19bb7769b37e8f152a7e4ff0e4db8c1c"."year" = 2024 and "t19bb7769b37e8f152a7e4ff0e4db8c1c"."team_unit" = 'DEFENSE' group by "t41e00b9bde2622961e16bab51896f43c"."team_adjusted_line_yards", t19bb7769b37e8f152a7e4ff0e4db8c1c.pass_wr3_dvoa, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('player receiving with nfl_games table params', async () => {
    const { query } = await get_data_view_results_query({
      columns: [
        {
          column_id: 'player_receiving_yards_from_plays',
          params: {
            year: [2024],
            day: ['MN']
          }
        }
      ],
      sort: [
        {
          column_id: 'player_receiving_yards_from_plays',
          desc: true
        }
      ]
    })
    const expected_query = `with "tf76584443fc9aa886e48d5d8d650d996" as (select COALESCE(trg_pid) as pid, SUM(CASE WHEN comp = true THEN recv_yds ELSE 0 END) as rec_yds_from_plays from "nfl_plays" inner join "nfl_games" on "nfl_games"."esbid" = "nfl_plays"."esbid" where not "play_type" = 'NOPL' and "nfl_plays"."year" in (2024) and "nfl_plays"."seas_type" in ('REG') and "nfl_games"."day" in ('MN') group by COALESCE(trg_pid)) select "player"."pid", "tf76584443fc9aa886e48d5d8d650d996"."rec_yds_from_plays" AS "rec_yds_from_plays_0", "player"."pos" from "player" left join "tf76584443fc9aa886e48d5d8d650d996" on "tf76584443fc9aa886e48d5d8d650d996"."pid" = "player"."pid" group by "tf76584443fc9aa886e48d5d8d650d996"."rec_yds_from_plays", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('team espn line win rates with matchup_opponent_type param', async () => {
    const { query } = await get_data_view_results_query({
      view_id: 'ef18d7a8-f02a-440b-a375-0e7ae0e9f5d1',
      columns: [
        {
          column_id: 'team_espn_run_block_win_rate',
          params: {
            matchup_opponent_type: 'current_week_opponent_total',
            year: [2024]
          }
        }
      ],
      sort: [
        {
          column_id: 'team_espn_run_block_win_rate',
          desc: true
        }
      ],
      where: [
        {
          column_id: 'player_position',
          params: {},
          value: ['TEAM'],
          operator: 'IN'
        }
      ],
      splits: []
    })
    const expected_query = `with "current_week_opponents" as (select "h" as "nfl_team", "v" as "opponent" from "public"."nfl_games" where "year" = ${constants.season.year} and "week" = ${constants.season.nfl_seas_week} and "seas_type" = '${constants.season.nfl_seas_type}' union select "v" as "nfl_team", "h" as "opponent" from "public"."nfl_games" where "year" = ${constants.season.year} and "week" = ${constants.season.nfl_seas_week} and "seas_type" = '${constants.season.nfl_seas_type}') select "player"."pid", "espn_team_win_rates_index"."run_block_win_rate" AS "espn_team_run_block_win_rate_0", "player"."pos" from "player" inner join "current_week_opponents" on "player"."current_nfl_team" = "current_week_opponents"."nfl_team" left join "espn_team_win_rates_index" on "espn_team_win_rates_index"."team" = "current_week_opponents"."opponent" and "espn_team_win_rates_index"."year" = 2024 where player.pos IN ('TEAM') group by "espn_team_win_rates_index"."run_block_win_rate", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('team drive count from plays', async () => {
    const { query } = await get_data_view_results_query({
      columns: [
        {
          column_id: 'team_drive_count_from_plays',
          params: {
            year: [2024],
            week: [1],
            qtr: [1]
          }
        }
      ],
      where: [
        {
          column_id: 'player_position',
          params: {},
          value: ['TEAM'],
          operator: 'IN'
        }
      ],
      splits: []
    })
    const expected_query = `with "t2fd39fbbbad053a3f99d693c6702789e" as (select "nfl_plays"."off" as "nfl_team", COUNT(DISTINCT CONCAT(esbid, '_', drive_seq)) AS team_drive_count_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."year" in (2024) and "nfl_plays"."week" in (1) and "nfl_plays"."seas_type" in ('REG') and "nfl_plays"."qtr" in (1) group by "nfl_plays"."off"), "t2fd39fbbbad053a3f99d693c6702789e_team_stats" as (select "t2fd39fbbbad053a3f99d693c6702789e"."nfl_team", sum(t2fd39fbbbad053a3f99d693c6702789e.team_drive_count_from_plays) as team_drive_count_from_plays from "t2fd39fbbbad053a3f99d693c6702789e" group by "t2fd39fbbbad053a3f99d693c6702789e"."nfl_team") select "player"."pid", "t2fd39fbbbad053a3f99d693c6702789e_team_stats"."team_drive_count_from_plays" AS "team_drive_count_from_plays_0", "player"."pos" from "player" left join "t2fd39fbbbad053a3f99d693c6702789e_team_stats" on "t2fd39fbbbad053a3f99d693c6702789e_team_stats"."nfl_team" = "player"."current_nfl_team" where player.pos IN ('TEAM') group by "t2fd39fbbbad053a3f99d693c6702789e_team_stats"."team_drive_count_from_plays", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('nfl team seasonlogs fields', async () => {
    const { query } = await get_data_view_results_query({
      columns: [
        {
          column_id: 'nfl_team_seasonlogs_ry',
          params: {
            year: [2024],
            matchup_opponent_type: 'current_week_opponent_total',
            single_position: 'RB',
            stat_type: 'AGAINST_ADJ',
            time_type: 'LAST_FOUR'
          }
        },
        {
          column_id: 'nfl_team_seasonlogs_ry',
          params: {
            year: [2024],
            matchup_opponent_type: 'current_week_opponent_total',
            single_position: 'RB',
            stat_type: 'AGAINST_ADJ',
            time_type: 'LAST_EIGHT'
          }
        },
        {
          column_id: 'nfl_team_seasonlogs_ry',
          params: {
            year: [2024],
            matchup_opponent_type: 'current_week_opponent_total',
            single_position: 'RB',
            stat_type: 'AGAINST_ADJ',
            time_type: 'SEASON'
          }
        }
      ],
      where: [
        {
          column_id: 'player_position',
          params: {},
          value: ['RB'],
          operator: 'IN'
        }
      ]
    })
    const expected_query = `with "current_week_opponents" as (select "h" as "nfl_team", "v" as "opponent" from "public"."nfl_games" where "year" = ${constants.season.year} and "week" = ${constants.season.nfl_seas_week} and "seas_type" = '${constants.season.nfl_seas_type}' union select "v" as "nfl_team", "h" as "opponent" from "public"."nfl_games" where "year" = ${constants.season.year} and "week" = ${constants.season.nfl_seas_week} and "seas_type" = '${constants.season.nfl_seas_type}') select "player"."pid", "tfe39a39a1a74e9d64bdca028581d049a"."ry" AS "nfl_team_seasonlogs_ry_0", "te2f90d96f7d058a1982c3a4ce34985a6"."ry" AS "nfl_team_seasonlogs_ry_1", "td7a35b3921d39bc4e736321320190682"."ry" AS "nfl_team_seasonlogs_ry_2", "player"."pos" from "player" inner join "current_week_opponents" on "player"."current_nfl_team" = "current_week_opponents"."nfl_team" left join "nfl_team_seasonlogs" as "tfe39a39a1a74e9d64bdca028581d049a" on "tfe39a39a1a74e9d64bdca028581d049a"."tm" = "current_week_opponents"."opponent" and "tfe39a39a1a74e9d64bdca028581d049a"."year" = 2024 and "tfe39a39a1a74e9d64bdca028581d049a"."stat_key" = 'RB_AGAINST_ADJ_LAST_FOUR' left join "nfl_team_seasonlogs" as "te2f90d96f7d058a1982c3a4ce34985a6" on "te2f90d96f7d058a1982c3a4ce34985a6"."tm" = "current_week_opponents"."opponent" and "te2f90d96f7d058a1982c3a4ce34985a6"."year" = 2024 and "te2f90d96f7d058a1982c3a4ce34985a6"."stat_key" = 'RB_AGAINST_ADJ_LAST_EIGHT' left join "nfl_team_seasonlogs" as "td7a35b3921d39bc4e736321320190682" on "td7a35b3921d39bc4e736321320190682"."tm" = "current_week_opponents"."opponent" and "td7a35b3921d39bc4e736321320190682"."year" = 2024 and "td7a35b3921d39bc4e736321320190682"."stat_key" = 'RB_AGAINST_ADJ' where player.pos IN ('RB') group by "tfe39a39a1a74e9d64bdca028581d049a"."ry", "te2f90d96f7d058a1982c3a4ce34985a6"."ry", "td7a35b3921d39bc4e736321320190682"."ry", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('nfl team league seasonlogs fields', async () => {
    const { query } = await get_data_view_results_query({
      columns: [
        {
          column_id: 'league_nfl_team_seasonlogs_points',
          params: {
            year: [2024],
            matchup_opponent_type: 'current_week_opponent_total',
            single_position: 'DST',
            stat_type: 'AGAINST_ADJ',
            time_type: 'LAST_FOUR'
          }
        },
        {
          column_id: 'league_nfl_team_seasonlogs_points',
          params: {
            year: [2024],
            matchup_opponent_type: 'current_week_opponent_total',
            single_position: 'DST',
            stat_type: 'AGAINST_ADJ',
            time_type: 'LAST_EIGHT'
          }
        },
        {
          column_id: 'league_nfl_team_seasonlogs_points',
          params: {
            year: [2024],
            matchup_opponent_type: 'current_week_opponent_total',
            single_position: 'DST',
            stat_type: 'AGAINST_ADJ',
            time_type: 'SEASON'
          }
        }
      ],
      where: [
        {
          column_id: 'player_position',
          params: {},
          value: ['DST'],
          operator: 'IN'
        }
      ]
    })
    const expected_query = `with "current_week_opponents" as (select "h" as "nfl_team", "v" as "opponent" from "public"."nfl_games" where "year" = ${constants.season.year} and "week" = ${constants.season.nfl_seas_week} and "seas_type" = '${constants.season.nfl_seas_type}' union select "v" as "nfl_team", "h" as "opponent" from "public"."nfl_games" where "year" = ${constants.season.year} and "week" = ${constants.season.nfl_seas_week} and "seas_type" = '${constants.season.nfl_seas_type}') select "player"."pid", "tf8de8b452c5328170f28af2fd3c5b6f2"."pts" AS "league_nfl_team_seasonlogs_pts_0", "t9bd8dc189b8b6a0b23b50f09f6fe0bb7"."pts" AS "league_nfl_team_seasonlogs_pts_1", "ta091f9b442e5ed6ba3af81ee23a2e319"."pts" AS "league_nfl_team_seasonlogs_pts_2", "player"."pos" from "player" inner join "current_week_opponents" on "player"."current_nfl_team" = "current_week_opponents"."nfl_team" left join "league_nfl_team_seasonlogs" as "tf8de8b452c5328170f28af2fd3c5b6f2" on "tf8de8b452c5328170f28af2fd3c5b6f2"."tm" = "current_week_opponents"."opponent" and "tf8de8b452c5328170f28af2fd3c5b6f2"."year" = 2024 and "tf8de8b452c5328170f28af2fd3c5b6f2"."lid" = 1 and "tf8de8b452c5328170f28af2fd3c5b6f2"."stat_key" = 'DST_AGAINST_ADJ_LAST_FOUR' left join "league_nfl_team_seasonlogs" as "t9bd8dc189b8b6a0b23b50f09f6fe0bb7" on "t9bd8dc189b8b6a0b23b50f09f6fe0bb7"."tm" = "current_week_opponents"."opponent" and "t9bd8dc189b8b6a0b23b50f09f6fe0bb7"."year" = 2024 and "t9bd8dc189b8b6a0b23b50f09f6fe0bb7"."lid" = 1 and "t9bd8dc189b8b6a0b23b50f09f6fe0bb7"."stat_key" = 'DST_AGAINST_ADJ_LAST_EIGHT' left join "league_nfl_team_seasonlogs" as "ta091f9b442e5ed6ba3af81ee23a2e319" on "ta091f9b442e5ed6ba3af81ee23a2e319"."tm" = "current_week_opponents"."opponent" and "ta091f9b442e5ed6ba3af81ee23a2e319"."year" = 2024 and "ta091f9b442e5ed6ba3af81ee23a2e319"."lid" = 1 and "ta091f9b442e5ed6ba3af81ee23a2e319"."stat_key" = 'DST_AGAINST_ADJ' where player.pos IN ('DST') group by "tf8de8b452c5328170f28af2fd3c5b6f2"."pts", "t9bd8dc189b8b6a0b23b50f09f6fe0bb7"."pts", "ta091f9b442e5ed6ba3af81ee23a2e319"."pts", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('sort by splits year', async () => {
    const { query } = await get_data_view_results_query({
      columns: [
        {
          column_id: 'player_weighted_opportunity_from_plays',
          params: {
            year: [2024],
            rate_type: [null]
          }
        }
      ],
      sort: [
        {
          column_id: 'week',
          desc: true
        }
      ],
      where: [
        {
          column_id: 'player_nfl_teams',
          params: {},
          value: 'TB',
          operator: '='
        },
        {
          column_id: 'player_position',
          params: {},
          value: ['RB'],
          operator: 'IN'
        }
      ],
      prefix_columns: ['player_name', 'player_nfl_teams', 'player_position'],
      splits: ['week', 'year']
    })
    const expected_query = `with "base_years" as (SELECT unnest(ARRAY[2024]) as year), "player_years" as (SELECT DISTINCT player.pid, base_years.year FROM player CROSS JOIN base_years), "player_years_weeks" as (SELECT player_years.pid, nfl_year_week_timestamp.year, nfl_year_week_timestamp.week FROM player_years INNER JOIN nfl_year_week_timestamp ON player_years.year = nfl_year_week_timestamp.year), "tf851d676fddeb70ff3d41e0198712cb9" as (select "player_gamelogs"."pid", count(*) as "rate_type_total_count", array_agg(distinct player_gamelogs.tm) as teams, "nfl_games"."week", "nfl_games"."year" from "player_gamelogs" left join "nfl_games" on "nfl_games"."esbid" = "player_gamelogs"."esbid" where "nfl_games"."seas_type" in ('REG') and "player_gamelogs"."active" = true group by "nfl_games"."week", "nfl_games"."year", "player_gamelogs"."pid"), "t5525969ee1c8752b8face9cbcb02ceb7" as (select COALESCE(bc_pid, trg_pid) as pid, "nfl_plays"."week", "nfl_plays"."year", ROUND(SUM(CASE WHEN nfl_plays.ydl_100 <= 20 AND bc_pid IS NOT NULL THEN 1.30 WHEN nfl_plays.ydl_100 <= 20 AND trg_pid IS NOT NULL THEN 2.25 WHEN nfl_plays.ydl_100 > 20 AND bc_pid IS NOT NULL THEN 0.48 WHEN nfl_plays.ydl_100 > 20 AND trg_pid IS NOT NULL THEN 1.43 ELSE 0 END), 2) as weighted_opportunity_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."year" in (2024) and "nfl_plays"."seas_type" in ('REG') group by "nfl_plays"."week", "nfl_plays"."year", COALESCE(bc_pid, trg_pid)) select "player"."pid", player.fname, player.lname, "player"."pos" AS "pos_0", tf851d676fddeb70ff3d41e0198712cb9.teams as player_nfl_teams_0, "t5525969ee1c8752b8face9cbcb02ceb7"."weighted_opportunity_from_plays" AS "weighted_opportunity_from_plays_0", "player_years_weeks"."week", "player_years"."year", "player"."pos" from "player_years_weeks" inner join "player" on "player"."pid" = "player_years_weeks"."pid" inner join "player_years" on "player_years"."pid" = "player"."pid" and "player_years"."year" = "player_years_weeks"."year" left join "tf851d676fddeb70ff3d41e0198712cb9" on "tf851d676fddeb70ff3d41e0198712cb9"."pid" = "player"."pid" and "tf851d676fddeb70ff3d41e0198712cb9"."year" = "player_years_weeks"."year" and "tf851d676fddeb70ff3d41e0198712cb9"."week" = "player_years_weeks"."week" left join "t5525969ee1c8752b8face9cbcb02ceb7" on "t5525969ee1c8752b8face9cbcb02ceb7"."pid" = "player"."pid" and "t5525969ee1c8752b8face9cbcb02ceb7"."year" = 2024 and t5525969ee1c8752b8face9cbcb02ceb7.week = player_years_weeks.week where player.pos IN ('RB') and 'TB'::text = ANY(tf851d676fddeb70ff3d41e0198712cb9.teams::text[]) group by player.fname, player.lname, "player"."pos", tf851d676fddeb70ff3d41e0198712cb9.teams, "t5525969ee1c8752b8face9cbcb02ceb7"."weighted_opportunity_from_plays", "player_years_weeks"."week", "player_years"."year", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by player_years_weeks.week DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })
})
