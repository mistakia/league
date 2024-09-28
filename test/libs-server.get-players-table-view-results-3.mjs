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

  it('team series success rate from plays', () => {
    const { query } = get_data_view_results_query({
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

    const expected_query = `with "t65417c18efcc4d13e54a67b3a260889e" as (select "nfl_plays"."off" as "nfl_team", "nfl_plays"."year", "nfl_plays"."week", COUNT(DISTINCT CASE WHEN series_result IN ('FIRST_DOWN', 'TOUCHDOWN') THEN CONCAT(esbid, '_', series_seq) END) as team_series_conversion_rate_from_plays_numerator, COUNT(DISTINCT CASE WHEN series_result NOT IN ('QB_KNEEL', 'END_OF_HALF') THEN CONCAT(esbid, '_', series_seq) END) as team_series_conversion_rate_from_plays_denominator from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."year" in (${constants.season.year}) group by "nfl_plays"."off", "nfl_plays"."year", "nfl_plays"."week"), "t65417c18efcc4d13e54a67b3a260889e_team_stats" as (select "t65417c18efcc4d13e54a67b3a260889e"."nfl_team", sum(t65417c18efcc4d13e54a67b3a260889e.team_series_conversion_rate_from_plays_numerator) / sum(t65417c18efcc4d13e54a67b3a260889e.team_series_conversion_rate_from_plays_denominator) as team_series_conversion_rate_from_plays from "t65417c18efcc4d13e54a67b3a260889e" where "t65417c18efcc4d13e54a67b3a260889e"."year" in (${constants.season.year}) group by "t65417c18efcc4d13e54a67b3a260889e"."nfl_team") select "player"."pid", "t65417c18efcc4d13e54a67b3a260889e_team_stats"."team_series_conversion_rate_from_plays" AS "team_series_conversion_rate_from_plays_0", "player"."pos" from "player" left join "t65417c18efcc4d13e54a67b3a260889e_team_stats" on "t65417c18efcc4d13e54a67b3a260889e_team_stats"."nfl_team" = "player"."current_nfl_team" group by "t65417c18efcc4d13e54a67b3a260889e_team_stats"."team_series_conversion_rate_from_plays", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('player nfl teams', () => {
    const { query } = get_data_view_results_query({
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
    const expected_query = `with "base_years" as (SELECT unnest(ARRAY[2020,2021,2022,2023,2024]) as year), "player_years" as (SELECT DISTINCT player.pid, base_years.year FROM player CROSS JOIN base_years), "td6be67d9d166e9f60060dd53d9c6596e" as (select "player_gamelogs"."pid", count(*) as "rate_type_total_count", array_agg(distinct player_gamelogs.tm) as teams, "nfl_games"."year" from "player_gamelogs" left join "nfl_games" on "nfl_games"."esbid" = "player_gamelogs"."esbid" where "nfl_games"."seas_type" = 'REG' and "player_gamelogs"."active" = true group by "nfl_games"."year", "player_gamelogs"."pid"), "t4e422f08bd5e7b8923d45ecc3da571f1" as (select COALESCE(trg_pid) as pid, "nfl_plays"."year", SUM(CASE WHEN comp = true THEN recv_yds ELSE 0 END) as rec_yds_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."year" in (2020, 2021, 2022, 2023, 2024) group by "nfl_plays"."year", COALESCE(trg_pid)) select "player"."pid", td6be67d9d166e9f60060dd53d9c6596e.teams as player_nfl_teams_0, "t4e422f08bd5e7b8923d45ecc3da571f1"."rec_yds_from_plays" AS "rec_yds_from_plays_0", "player_years"."year", "player"."pos" from "player_years" inner join "player" on "player"."pid" = "player_years"."pid" left join "td6be67d9d166e9f60060dd53d9c6596e" on "td6be67d9d166e9f60060dd53d9c6596e"."pid" = "player"."pid" and "td6be67d9d166e9f60060dd53d9c6596e"."year" = "player_years"."year" left join "t4e422f08bd5e7b8923d45ecc3da571f1" on "t4e422f08bd5e7b8923d45ecc3da571f1"."pid" = "player"."pid" and t4e422f08bd5e7b8923d45ecc3da571f1.year = player_years.year and t4e422f08bd5e7b8923d45ecc3da571f1.year IN (2020,2021,2022,2023,2024) where td6be67d9d166e9f60060dd53d9c6596e.teams::text[] && ARRAY['CIN']::text[] group by td6be67d9d166e9f60060dd53d9c6596e.teams, "t4e422f08bd5e7b8923d45ecc3da571f1"."rec_yds_from_plays", "player_years"."year", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 3 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('team dova', () => {
    const { query } = get_data_view_results_query({
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
    const expected_query = `with "current_week_opponents" as (select "h" as "nfl_team", "v" as "opponent" from "public"."nfl_games" where "year" = 2024 and "week" = 4 and "seas_type" = 'REG' union select "v" as "nfl_team", "h" as "opponent" from "public"."nfl_games" where "year" = 2024 and "week" = 4 and "seas_type" = 'REG') select "player"."pid", "t41e00b9bde2622961e16bab51896f43c"."team_adjusted_line_yards" AS "team_adjusted_line_yards_0", t19bb7769b37e8f152a7e4ff0e4db8c1c.pass_wr3_dvoa as team_unit_dvoa_0, "player"."pos" from "player" inner join "current_week_opponents" on "player"."current_nfl_team" = "current_week_opponents"."nfl_team" left join "dvoa_team_unit_seasonlogs_index" as "t41e00b9bde2622961e16bab51896f43c" on "t41e00b9bde2622961e16bab51896f43c"."nfl_team" = "current_week_opponents"."opponent" and "t41e00b9bde2622961e16bab51896f43c"."year" = 2024 and "t41e00b9bde2622961e16bab51896f43c"."team_unit" = 'OFFENSE' left join "dvoa_team_unit_seasonlogs_index" as "t19bb7769b37e8f152a7e4ff0e4db8c1c" on "t19bb7769b37e8f152a7e4ff0e4db8c1c"."nfl_team" = "player"."current_nfl_team" and "t19bb7769b37e8f152a7e4ff0e4db8c1c"."year" = 2024 and "t19bb7769b37e8f152a7e4ff0e4db8c1c"."team_unit" = 'DEFENSE' group by "t41e00b9bde2622961e16bab51896f43c"."team_adjusted_line_yards", t19bb7769b37e8f152a7e4ff0e4db8c1c.pass_wr3_dvoa, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })
})
