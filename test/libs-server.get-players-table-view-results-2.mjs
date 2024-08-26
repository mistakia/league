/* global describe it */

import { get_data_view_results_query } from '#libs-server'
import { compare_queries } from './utils/index.mjs'

describe('LIBS SERVER get_data_view_results', () => {
  it('player contract with no params', () => {
    const query = get_data_view_results_query({
      columns: [
        {
          column_id: 'player_contract_base_salary'
        }
      ],
      sort: [
        {
          column_id: 'player_contract_base_salary',
          desc: true
        }
      ]
    })

    const expected_query = `select "player"."pid", "tb75ca4f410cdaf4b86f84af5464987dd"."base_salary" AS "base_salary_0", "player"."pos" from "player" left join "player_contracts" as "tb75ca4f410cdaf4b86f84af5464987dd" on "tb75ca4f410cdaf4b86f84af5464987dd"."pid" = "player"."pid" and tb75ca4f410cdaf4b86f84af5464987dd.year = '2024' group by "tb75ca4f410cdaf4b86f84af5464987dd"."base_salary", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('player contract with year', () => {
    const query = get_data_view_results_query({
      columns: [
        {
          column_id: 'player_contract_base_salary',
          params: {
            contract_year: 2022
          }
        },
        {
          column_id: 'player_contract_base_salary',
          params: {
            contract_year: 'TOTAL'
          }
        }
      ],
      sort: [
        {
          column_id: 'player_contract_base_salary',
          desc: true
        }
      ]
    })
    const expected_query = `select "player"."pid", "ta51741002ab8f03ebbd01303bdd3cf2a"."base_salary" AS "base_salary_0", "tb8130d7f4a3233d1b3579e919af8b79b"."base_salary" AS "base_salary_1", "player"."pos" from "player" left join "player_contracts" as "ta51741002ab8f03ebbd01303bdd3cf2a" on "ta51741002ab8f03ebbd01303bdd3cf2a"."pid" = "player"."pid" and ta51741002ab8f03ebbd01303bdd3cf2a.year = '2022' left join "player_contracts" as "tb8130d7f4a3233d1b3579e919af8b79b" on "tb8130d7f4a3233d1b3579e919af8b79b"."pid" = "player"."pid" and tb8130d7f4a3233d1b3579e919af8b79b.year = 'Total' group by "ta51741002ab8f03ebbd01303bdd3cf2a"."base_salary", "tb8130d7f4a3233d1b3579e919af8b79b"."base_salary", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('team stat with per_team_off_play', () => {
    const query = get_data_view_results_query({
      columns: [
        {
          column_id: 'team_pass_yards_from_plays',
          params: {
            rate_type: ['per_team_off_play'],
            year: [2023]
          }
        }
      ],
      sort: [
        {
          column_id: 'team_pass_yards_from_plays',
          desc: true
        }
      ]
    })
    const expected_query = `with "t99dd3bbc3263e8074c1bda6aa5abfa84" as (select "nfl_plays"."off", COUNT(*) as rate_type_total_count from "nfl_plays" where "nfl_plays"."seas_type" = 'REG' and not "play_type" = 'NOPL' and "nfl_plays"."year" in (2023) group by "nfl_plays"."off"), "t637d41a7043612873a6e482c3ffa3223" as (select "nfl_plays"."off" as "nfl_team", "nfl_plays"."year", "nfl_plays"."week", SUM(pass_yds) AS team_pass_yds_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."year" in (2023) group by "nfl_plays"."off", "nfl_plays"."year", "nfl_plays"."week"), "t637d41a7043612873a6e482c3ffa3223_player_team_stats" as (select "player_gamelogs"."pid", sum(t637d41a7043612873a6e482c3ffa3223.team_pass_yds_from_plays) as team_pass_yds_from_plays from "player_gamelogs" inner join "nfl_games" on "player_gamelogs"."esbid" = "nfl_games"."esbid" inner join "t637d41a7043612873a6e482c3ffa3223" on "player_gamelogs"."tm" = "t637d41a7043612873a6e482c3ffa3223"."nfl_team" and "nfl_games"."year" = "t637d41a7043612873a6e482c3ffa3223"."year" and "nfl_games"."week" = "t637d41a7043612873a6e482c3ffa3223"."week" where "nfl_games"."seas_type" = 'REG' and "nfl_games"."year" in (2023) group by "player_gamelogs"."pid") select "player"."pid", CAST(t637d41a7043612873a6e482c3ffa3223_player_team_stats.team_pass_yds_from_plays AS DECIMAL) / NULLIF(CAST(t99dd3bbc3263e8074c1bda6aa5abfa84.rate_type_total_count AS DECIMAL), 0) AS "team_pass_yds_from_plays_0", "player"."pos" from "player" left join "t99dd3bbc3263e8074c1bda6aa5abfa84" on "t99dd3bbc3263e8074c1bda6aa5abfa84"."off" = "player"."current_nfl_team" left join "t637d41a7043612873a6e482c3ffa3223_player_team_stats" on "t637d41a7043612873a6e482c3ffa3223_player_team_stats"."pid" = "player"."pid" group by "t637d41a7043612873a6e482c3ffa3223_player_team_stats"."team_pass_yds_from_plays", t99dd3bbc3263e8074c1bda6aa5abfa84.rate_type_total_count, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('team stat with per_team_off_pass_play', () => {
    const query = get_data_view_results_query({
      columns: [
        {
          column_id: 'team_pass_yards_from_plays',
          params: {
            rate_type: ['per_team_off_pass_play'],
            year: [2023]
          }
        }
      ],
      sort: [
        {
          column_id: 'team_pass_yards_from_plays',
          desc: true
        }
      ]
    })
    const expected_query = `with "tbe3a8937e6fc508a70ddc55ef6635b58" as (select "nfl_plays"."off", COUNT(*) as rate_type_total_count from "nfl_plays" where "nfl_plays"."seas_type" = 'REG' and not "play_type" = 'NOPL' and "play_type" = 'PASS' and "nfl_plays"."year" in (2023) group by "nfl_plays"."off"), "t637d41a7043612873a6e482c3ffa3223" as (select "nfl_plays"."off" as "nfl_team", "nfl_plays"."year", "nfl_plays"."week", SUM(pass_yds) AS team_pass_yds_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."year" in (2023) group by "nfl_plays"."off", "nfl_plays"."year", "nfl_plays"."week"), "t637d41a7043612873a6e482c3ffa3223_player_team_stats" as (select "player_gamelogs"."pid", sum(t637d41a7043612873a6e482c3ffa3223.team_pass_yds_from_plays) as team_pass_yds_from_plays from "player_gamelogs" inner join "nfl_games" on "player_gamelogs"."esbid" = "nfl_games"."esbid" inner join "t637d41a7043612873a6e482c3ffa3223" on "player_gamelogs"."tm" = "t637d41a7043612873a6e482c3ffa3223"."nfl_team" and "nfl_games"."year" = "t637d41a7043612873a6e482c3ffa3223"."year" and "nfl_games"."week" = "t637d41a7043612873a6e482c3ffa3223"."week" where "nfl_games"."seas_type" = 'REG' and "nfl_games"."year" in (2023) group by "player_gamelogs"."pid") select "player"."pid", CAST(t637d41a7043612873a6e482c3ffa3223_player_team_stats.team_pass_yds_from_plays AS DECIMAL) / NULLIF(CAST(tbe3a8937e6fc508a70ddc55ef6635b58.rate_type_total_count AS DECIMAL), 0) AS "team_pass_yds_from_plays_0", "player"."pos" from "player" left join "tbe3a8937e6fc508a70ddc55ef6635b58" on "tbe3a8937e6fc508a70ddc55ef6635b58"."off" = "player"."current_nfl_team" left join "t637d41a7043612873a6e482c3ffa3223_player_team_stats" on "t637d41a7043612873a6e482c3ffa3223_player_team_stats"."pid" = "player"."pid" group by "t637d41a7043612873a6e482c3ffa3223_player_team_stats"."team_pass_yds_from_plays", tbe3a8937e6fc508a70ddc55ef6635b58.rate_type_total_count, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('team stat with per_team_off_rush_play', () => {
    const query = get_data_view_results_query({
      columns: [
        {
          column_id: 'team_rush_yards_from_plays',
          params: {
            rate_type: ['per_team_off_rush_play'],
            year: [2023]
          }
        }
      ],
      sort: [
        {
          column_id: 'team_rush_yards_from_plays',
          desc: true
        }
      ]
    })
    const expected_query = `with "t251a33628b0ba377c8337eba7cf7a945" as (select "nfl_plays"."off", COUNT(*) as rate_type_total_count from "nfl_plays" where "nfl_plays"."seas_type" = 'REG' and not "play_type" = 'NOPL' and "play_type" = 'RUSH' and "nfl_plays"."year" in (2023) group by "nfl_plays"."off"), "t637d41a7043612873a6e482c3ffa3223" as (select "nfl_plays"."off" as "nfl_team", "nfl_plays"."year", "nfl_plays"."week", SUM(rush_yds) AS team_rush_yds_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."year" in (2023) group by "nfl_plays"."off", "nfl_plays"."year", "nfl_plays"."week"), "t637d41a7043612873a6e482c3ffa3223_player_team_stats" as (select "player_gamelogs"."pid", sum(t637d41a7043612873a6e482c3ffa3223.team_rush_yds_from_plays) as team_rush_yds_from_plays from "player_gamelogs" inner join "nfl_games" on "player_gamelogs"."esbid" = "nfl_games"."esbid" inner join "t637d41a7043612873a6e482c3ffa3223" on "player_gamelogs"."tm" = "t637d41a7043612873a6e482c3ffa3223"."nfl_team" and "nfl_games"."year" = "t637d41a7043612873a6e482c3ffa3223"."year" and "nfl_games"."week" = "t637d41a7043612873a6e482c3ffa3223"."week" where "nfl_games"."seas_type" = 'REG' and "nfl_games"."year" in (2023) group by "player_gamelogs"."pid") select "player"."pid", CAST(t637d41a7043612873a6e482c3ffa3223_player_team_stats.team_rush_yds_from_plays AS DECIMAL) / NULLIF(CAST(t251a33628b0ba377c8337eba7cf7a945.rate_type_total_count AS DECIMAL), 0) AS "team_rush_yds_from_plays_0", "player"."pos" from "player" left join "t251a33628b0ba377c8337eba7cf7a945" on "t251a33628b0ba377c8337eba7cf7a945"."off" = "player"."current_nfl_team" left join "t637d41a7043612873a6e482c3ffa3223_player_team_stats" on "t637d41a7043612873a6e482c3ffa3223_player_team_stats"."pid" = "player"."pid" group by "t637d41a7043612873a6e482c3ffa3223_player_team_stats"."team_rush_yds_from_plays", t251a33628b0ba377c8337eba7cf7a945.rate_type_total_count, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('team stat with per_team_half', () => {
    const query = get_data_view_results_query({
      columns: [
        {
          column_id: 'team_pass_yards_from_plays',
          params: {
            rate_type: ['per_team_half'],
            year: [2023]
          }
        }
      ],
      sort: [
        {
          column_id: 'team_pass_yards_from_plays',
          desc: true
        }
      ]
    })
    const expected_query = `with "t586fcdda5c06f8a7c6b4f6cda327b2c3" as (select "nfl_plays"."off", COUNT(DISTINCT CONCAT(nfl_plays.esbid, CASE WHEN qtr <= 2 THEN 1 ELSE 2 END)) as rate_type_total_count from "nfl_plays" where "nfl_plays"."seas_type" = 'REG' and not "play_type" = 'NOPL' and "nfl_plays"."year" in (2023) group by "nfl_plays"."off"), "t637d41a7043612873a6e482c3ffa3223" as (select "nfl_plays"."off" as "nfl_team", "nfl_plays"."year", "nfl_plays"."week", SUM(pass_yds) AS team_pass_yds_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."year" in (2023) group by "nfl_plays"."off", "nfl_plays"."year", "nfl_plays"."week"), "t637d41a7043612873a6e482c3ffa3223_player_team_stats" as (select "player_gamelogs"."pid", sum(t637d41a7043612873a6e482c3ffa3223.team_pass_yds_from_plays) as team_pass_yds_from_plays from "player_gamelogs" inner join "nfl_games" on "player_gamelogs"."esbid" = "nfl_games"."esbid" inner join "t637d41a7043612873a6e482c3ffa3223" on "player_gamelogs"."tm" = "t637d41a7043612873a6e482c3ffa3223"."nfl_team" and "nfl_games"."year" = "t637d41a7043612873a6e482c3ffa3223"."year" and "nfl_games"."week" = "t637d41a7043612873a6e482c3ffa3223"."week" where "nfl_games"."seas_type" = 'REG' and "nfl_games"."year" in (2023) group by "player_gamelogs"."pid") select "player"."pid", CAST(t637d41a7043612873a6e482c3ffa3223_player_team_stats.team_pass_yds_from_plays AS DECIMAL) / NULLIF(CAST(t586fcdda5c06f8a7c6b4f6cda327b2c3.rate_type_total_count AS DECIMAL), 0) AS "team_pass_yds_from_plays_0", "player"."pos" from "player" left join "t586fcdda5c06f8a7c6b4f6cda327b2c3" on "t586fcdda5c06f8a7c6b4f6cda327b2c3"."off" = "player"."current_nfl_team" left join "t637d41a7043612873a6e482c3ffa3223_player_team_stats" on "t637d41a7043612873a6e482c3ffa3223_player_team_stats"."pid" = "player"."pid" group by "t637d41a7043612873a6e482c3ffa3223_player_team_stats"."team_pass_yds_from_plays", t586fcdda5c06f8a7c6b4f6cda327b2c3.rate_type_total_count, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('team stat with per_team_quarter', () => {
    const query = get_data_view_results_query({
      columns: [
        {
          column_id: 'team_pass_yards_from_plays',
          params: {
            rate_type: ['per_team_quarter'],
            year: [2023]
          }
        }
      ],
      sort: [
        {
          column_id: 'team_pass_yards_from_plays',
          desc: true
        }
      ]
    })
    const expected_query = `with "t0af67f5f7bd29b4c4ea96983f9928530" as (select "nfl_plays"."off", COUNT(DISTINCT CONCAT(nfl_plays.esbid, qtr)) as rate_type_total_count from "nfl_plays" where "nfl_plays"."seas_type" = 'REG' and not "play_type" = 'NOPL' and "nfl_plays"."year" in (2023) group by "nfl_plays"."off"), "t637d41a7043612873a6e482c3ffa3223" as (select "nfl_plays"."off" as "nfl_team", "nfl_plays"."year", "nfl_plays"."week", SUM(pass_yds) AS team_pass_yds_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."year" in (2023) group by "nfl_plays"."off", "nfl_plays"."year", "nfl_plays"."week"), "t637d41a7043612873a6e482c3ffa3223_player_team_stats" as (select "player_gamelogs"."pid", sum(t637d41a7043612873a6e482c3ffa3223.team_pass_yds_from_plays) as team_pass_yds_from_plays from "player_gamelogs" inner join "nfl_games" on "player_gamelogs"."esbid" = "nfl_games"."esbid" inner join "t637d41a7043612873a6e482c3ffa3223" on "player_gamelogs"."tm" = "t637d41a7043612873a6e482c3ffa3223"."nfl_team" and "nfl_games"."year" = "t637d41a7043612873a6e482c3ffa3223"."year" and "nfl_games"."week" = "t637d41a7043612873a6e482c3ffa3223"."week" where "nfl_games"."seas_type" = 'REG' and "nfl_games"."year" in (2023) group by "player_gamelogs"."pid") select "player"."pid", CAST(t637d41a7043612873a6e482c3ffa3223_player_team_stats.team_pass_yds_from_plays AS DECIMAL) / NULLIF(CAST(t0af67f5f7bd29b4c4ea96983f9928530.rate_type_total_count AS DECIMAL), 0) AS "team_pass_yds_from_plays_0", "player"."pos" from "player" left join "t0af67f5f7bd29b4c4ea96983f9928530" on "t0af67f5f7bd29b4c4ea96983f9928530"."off" = "player"."current_nfl_team" left join "t637d41a7043612873a6e482c3ffa3223_player_team_stats" on "t637d41a7043612873a6e482c3ffa3223_player_team_stats"."pid" = "player"."pid" group by "t637d41a7043612873a6e482c3ffa3223_player_team_stats"."team_pass_yds_from_plays", t0af67f5f7bd29b4c4ea96983f9928530.rate_type_total_count, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('team stat with per_team_off_drive', () => {
    const query = get_data_view_results_query({
      columns: [
        {
          column_id: 'team_pass_yards_from_plays',
          params: {
            rate_type: ['per_team_off_drive'],
            year: [2023]
          }
        }
      ],
      sort: [
        {
          column_id: 'team_pass_yards_from_plays',
          desc: true
        }
      ]
    })
    const expected_query = `with "tfb7c9bb3332c074dc65a96eb7df23ca6" as (select "nfl_plays"."off", COUNT(DISTINCT CONCAT(nfl_plays.esbid, drive_seq)) as rate_type_total_count from "nfl_plays" where "nfl_plays"."seas_type" = 'REG' and not "play_type" = 'NOPL' and "nfl_plays"."year" in (2023) group by "nfl_plays"."off"), "t637d41a7043612873a6e482c3ffa3223" as (select "nfl_plays"."off" as "nfl_team", "nfl_plays"."year", "nfl_plays"."week", SUM(pass_yds) AS team_pass_yds_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."year" in (2023) group by "nfl_plays"."off", "nfl_plays"."year", "nfl_plays"."week"), "t637d41a7043612873a6e482c3ffa3223_player_team_stats" as (select "player_gamelogs"."pid", sum(t637d41a7043612873a6e482c3ffa3223.team_pass_yds_from_plays) as team_pass_yds_from_plays from "player_gamelogs" inner join "nfl_games" on "player_gamelogs"."esbid" = "nfl_games"."esbid" inner join "t637d41a7043612873a6e482c3ffa3223" on "player_gamelogs"."tm" = "t637d41a7043612873a6e482c3ffa3223"."nfl_team" and "nfl_games"."year" = "t637d41a7043612873a6e482c3ffa3223"."year" and "nfl_games"."week" = "t637d41a7043612873a6e482c3ffa3223"."week" where "nfl_games"."seas_type" = 'REG' and "nfl_games"."year" in (2023) group by "player_gamelogs"."pid") select "player"."pid", CAST(t637d41a7043612873a6e482c3ffa3223_player_team_stats.team_pass_yds_from_plays AS DECIMAL) / NULLIF(CAST(tfb7c9bb3332c074dc65a96eb7df23ca6.rate_type_total_count AS DECIMAL), 0) AS "team_pass_yds_from_plays_0", "player"."pos" from "player" left join "tfb7c9bb3332c074dc65a96eb7df23ca6" on "tfb7c9bb3332c074dc65a96eb7df23ca6"."off" = "player"."current_nfl_team" left join "t637d41a7043612873a6e482c3ffa3223_player_team_stats" on "t637d41a7043612873a6e482c3ffa3223_player_team_stats"."pid" = "player"."pid" group by "t637d41a7043612873a6e482c3ffa3223_player_team_stats"."team_pass_yds_from_plays", tfb7c9bb3332c074dc65a96eb7df23ca6.rate_type_total_count, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('team stat with per_team_off_series', () => {
    const query = get_data_view_results_query({
      columns: [
        {
          column_id: 'team_pass_yards_from_plays',
          params: {
            rate_type: ['per_team_off_series'],
            year: [2023]
          }
        }
      ],
      sort: [
        {
          column_id: 'team_pass_yards_from_plays',
          desc: true
        }
      ]
    })
    const expected_query = `with "tecc43374d0b62c1d1f26d46ae467fe5e" as (select "nfl_plays"."off", COUNT(DISTINCT CONCAT(nfl_plays.esbid, series_seq)) as rate_type_total_count from "nfl_plays" where "nfl_plays"."seas_type" = 'REG' and not "play_type" = 'NOPL' and "nfl_plays"."year" in (2023) group by "nfl_plays"."off"), "t637d41a7043612873a6e482c3ffa3223" as (select "nfl_plays"."off" as "nfl_team", "nfl_plays"."year", "nfl_plays"."week", SUM(pass_yds) AS team_pass_yds_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."year" in (2023) group by "nfl_plays"."off", "nfl_plays"."year", "nfl_plays"."week"), "t637d41a7043612873a6e482c3ffa3223_player_team_stats" as (select "player_gamelogs"."pid", sum(t637d41a7043612873a6e482c3ffa3223.team_pass_yds_from_plays) as team_pass_yds_from_plays from "player_gamelogs" inner join "nfl_games" on "player_gamelogs"."esbid" = "nfl_games"."esbid" inner join "t637d41a7043612873a6e482c3ffa3223" on "player_gamelogs"."tm" = "t637d41a7043612873a6e482c3ffa3223"."nfl_team" and "nfl_games"."year" = "t637d41a7043612873a6e482c3ffa3223"."year" and "nfl_games"."week" = "t637d41a7043612873a6e482c3ffa3223"."week" where "nfl_games"."seas_type" = 'REG' and "nfl_games"."year" in (2023) group by "player_gamelogs"."pid") select "player"."pid", CAST(t637d41a7043612873a6e482c3ffa3223_player_team_stats.team_pass_yds_from_plays AS DECIMAL) / NULLIF(CAST(tecc43374d0b62c1d1f26d46ae467fe5e.rate_type_total_count AS DECIMAL), 0) AS "team_pass_yds_from_plays_0", "player"."pos" from "player" left join "tecc43374d0b62c1d1f26d46ae467fe5e" on "tecc43374d0b62c1d1f26d46ae467fe5e"."off" = "player"."current_nfl_team" left join "t637d41a7043612873a6e482c3ffa3223_player_team_stats" on "t637d41a7043612873a6e482c3ffa3223_player_team_stats"."pid" = "player"."pid" group by "t637d41a7043612873a6e482c3ffa3223_player_team_stats"."team_pass_yds_from_plays", tecc43374d0b62c1d1f26d46ae467fe5e.rate_type_total_count, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('per_player_catchable_deep_target', () => {
    const query = get_data_view_results_query({
      columns: [
        {
          column_id: 'player_targets_from_plays',
          params: {
            rate_type: ['per_player_catchable_deep_target'],
            year: [2023]
          }
        }
      ],
      sort: [
        {
          column_id: 'player_targets_from_plays',
          desc: true
        }
      ]
    })
    const expected_query = `with "t1aea230d8aa99d4d3d2fd3662e7277da" as (select "nfl_plays"."trg_pid" as "pid", SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END) as rate_type_total_count from "nfl_plays" where "nfl_plays"."seas_type" = 'REG' and not "play_type" = 'NOPL' and "nfl_plays"."year" in (2023) and "nfl_plays"."dot" between 20 and 99 and "nfl_plays"."catchable_ball" = true group by "nfl_plays"."trg_pid"), "t9ae806c649624fe7332a653f6ce4f501" as (select COALESCE(trg_pid) as pid, SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END) as trg_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."year" in (2023) group by COALESCE(trg_pid)) select "player"."pid", CAST(t9ae806c649624fe7332a653f6ce4f501.trg_from_plays AS DECIMAL) / NULLIF(CAST(t1aea230d8aa99d4d3d2fd3662e7277da.rate_type_total_count AS DECIMAL), 0) AS "trg_from_plays_0", "player"."pos" from "player" left join "t1aea230d8aa99d4d3d2fd3662e7277da" on "t1aea230d8aa99d4d3d2fd3662e7277da"."pid" = "player"."pid" left join "t9ae806c649624fe7332a653f6ce4f501" on "t9ae806c649624fe7332a653f6ce4f501"."pid" = "player"."pid" group by "t9ae806c649624fe7332a653f6ce4f501"."trg_from_plays", t1aea230d8aa99d4d3d2fd3662e7277da.rate_type_total_count, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('pff_player_seasonlogs', () => {
    const query = get_data_view_results_query({
      columns: [
        { column_id: 'player_pff_offense', params: { year: [2023] } },
        { column_id: 'player_pff_defense', params: { year: [2023] } },
        { column_id: 'player_pff_special_teams', params: { year: [2023] } },
        { column_id: 'player_pff_fg_ep_kicker', params: { year: [2023] } },
        { column_id: 'player_pff_defense_rank', params: { year: [2023] } },
        { column_id: 'player_pff_grade_position', params: { year: [2023] } },
        { column_id: 'player_pff_height', params: { year: [2023] } },
        { column_id: 'player_pff_run_block', params: { year: [2023] } },
        { column_id: 'player_pff_offense_snaps', params: { year: [2023] } },
        {
          column_id: 'player_pff_special_teams_snaps',
          params: { year: [2023] }
        },
        { column_id: 'player_pff_coverage_snaps', params: { year: [2023] } },
        { column_id: 'player_pff_punter_rank', params: { year: [2023] } },
        { column_id: 'player_pff_age', params: { year: [2023] } },
        { column_id: 'player_pff_pass_rush', params: { year: [2023] } },
        { column_id: 'player_pff_punter', params: { year: [2023] } },
        { column_id: 'player_pff_unit', params: { year: [2023] } },
        { column_id: 'player_pff_pass_block', params: { year: [2023] } },
        { column_id: 'player_pff_run_block_snaps', params: { year: [2023] } },
        { column_id: 'player_pff_offense_ranked', params: { year: [2023] } },
        { column_id: 'player_pff_jersey_number', params: { year: [2023] } },
        { column_id: 'player_pff_position', params: { year: [2023] } },
        { column_id: 'player_pff_defense_snaps', params: { year: [2023] } },
        { column_id: 'player_pff_pass_snaps', params: { year: [2023] } },
        { column_id: 'player_pff_receiving', params: { year: [2023] } },
        { column_id: 'player_pff_coverage', params: { year: [2023] } },
        { column_id: 'player_pff_speed', params: { year: [2023] } },
        { column_id: 'player_pff_run', params: { year: [2023] } },
        { column_id: 'player_pff_run_defense_snaps', params: { year: [2023] } },
        { column_id: 'player_pff_defense_ranked', params: { year: [2023] } },
        { column_id: 'player_pff_pass_rush_snaps', params: { year: [2023] } },
        { column_id: 'player_pff_pass_block_snaps', params: { year: [2023] } },
        { column_id: 'player_pff_run_defense', params: { year: [2023] } },
        {
          column_id: 'player_pff_special_teams_rank',
          params: { year: [2023] }
        },
        { column_id: 'player_pff_run_snaps', params: { year: [2023] } },
        {
          column_id: 'player_pff_meets_snap_minimum',
          params: { year: [2023] }
        },
        { column_id: 'player_pff_kickoff_kicker', params: { year: [2023] } },
        { column_id: 'player_pff_status', params: { year: [2023] } },
        { column_id: 'player_pff_pass', params: { year: [2023] } },
        { column_id: 'player_pff_receiving_snaps', params: { year: [2023] } },
        { column_id: 'player_pff_weight', params: { year: [2023] } },
        { column_id: 'player_pff_overall_snaps', params: { year: [2023] } },
        { column_id: 'player_pff_offense_rank', params: { year: [2023] } }
      ],
      sort: [{ column_id: 'player_pff_offense', desc: true }]
    })
    const expected_query = `select "player"."pid", "ta90cad343257940bfecf8a1ded1f3615"."offense" AS "offense_0", "ta90cad343257940bfecf8a1ded1f3615"."defense" AS "defense_0", "ta90cad343257940bfecf8a1ded1f3615"."special_teams" AS "special_teams_0", "ta90cad343257940bfecf8a1ded1f3615"."fg_ep_kicker" AS "fg_ep_kicker_0", "ta90cad343257940bfecf8a1ded1f3615"."defense_rank" AS "defense_rank_0", "ta90cad343257940bfecf8a1ded1f3615"."grade_position" AS "grade_position_0", "ta90cad343257940bfecf8a1ded1f3615"."height" AS "height_0", "ta90cad343257940bfecf8a1ded1f3615"."run_block" AS "run_block_0", "ta90cad343257940bfecf8a1ded1f3615"."offense_snaps" AS "offense_snaps_0", "ta90cad343257940bfecf8a1ded1f3615"."special_teams_snaps" AS "special_teams_snaps_0", "ta90cad343257940bfecf8a1ded1f3615"."coverage_snaps" AS "coverage_snaps_0", "ta90cad343257940bfecf8a1ded1f3615"."punter_rank" AS "punter_rank_0", "ta90cad343257940bfecf8a1ded1f3615"."age" AS "age_0", "ta90cad343257940bfecf8a1ded1f3615"."pass_rush" AS "pass_rush_0", "ta90cad343257940bfecf8a1ded1f3615"."punter" AS "punter_0", "ta90cad343257940bfecf8a1ded1f3615"."unit" AS "unit_0", "ta90cad343257940bfecf8a1ded1f3615"."pass_block" AS "pass_block_0", "ta90cad343257940bfecf8a1ded1f3615"."run_block_snaps" AS "run_block_snaps_0", "ta90cad343257940bfecf8a1ded1f3615"."offense_ranked" AS "offense_ranked_0", "ta90cad343257940bfecf8a1ded1f3615"."jersey_number" AS "jersey_number_0", "ta90cad343257940bfecf8a1ded1f3615"."position" AS "position_0", "ta90cad343257940bfecf8a1ded1f3615"."defense_snaps" AS "defense_snaps_0", "ta90cad343257940bfecf8a1ded1f3615"."pass_snaps" AS "pass_snaps_0", "ta90cad343257940bfecf8a1ded1f3615"."receiving" AS "receiving_0", "ta90cad343257940bfecf8a1ded1f3615"."coverage" AS "coverage_0", "ta90cad343257940bfecf8a1ded1f3615"."speed" AS "speed_0", "ta90cad343257940bfecf8a1ded1f3615"."run" AS "run_0", "ta90cad343257940bfecf8a1ded1f3615"."run_defense_snaps" AS "run_defense_snaps_0", "ta90cad343257940bfecf8a1ded1f3615"."defense_ranked" AS "defense_ranked_0", "ta90cad343257940bfecf8a1ded1f3615"."pass_rush_snaps" AS "pass_rush_snaps_0", "ta90cad343257940bfecf8a1ded1f3615"."pass_block_snaps" AS "pass_block_snaps_0", "ta90cad343257940bfecf8a1ded1f3615"."run_defense" AS "run_defense_0", "ta90cad343257940bfecf8a1ded1f3615"."special_teams_rank" AS "special_teams_rank_0", "ta90cad343257940bfecf8a1ded1f3615"."run_snaps" AS "run_snaps_0", "ta90cad343257940bfecf8a1ded1f3615"."meets_snap_minimum" AS "meets_snap_minimum_0", "ta90cad343257940bfecf8a1ded1f3615"."kickoff_kicker" AS "kickoff_kicker_0", "ta90cad343257940bfecf8a1ded1f3615"."status" AS "status_0", "ta90cad343257940bfecf8a1ded1f3615"."pass" AS "pass_0", "ta90cad343257940bfecf8a1ded1f3615"."receiving_snaps" AS "receiving_snaps_0", "ta90cad343257940bfecf8a1ded1f3615"."weight" AS "weight_0", "ta90cad343257940bfecf8a1ded1f3615"."overall_snaps" AS "overall_snaps_0", "ta90cad343257940bfecf8a1ded1f3615"."offense_rank" AS "offense_rank_0", "player"."pos" from "player" left join "pff_player_seasonlogs" as "ta90cad343257940bfecf8a1ded1f3615" on "ta90cad343257940bfecf8a1ded1f3615"."pid" = "player"."pid" and "ta90cad343257940bfecf8a1ded1f3615"."year" = 2023 group by "ta90cad343257940bfecf8a1ded1f3615"."offense", "ta90cad343257940bfecf8a1ded1f3615"."defense", "ta90cad343257940bfecf8a1ded1f3615"."special_teams", "ta90cad343257940bfecf8a1ded1f3615"."fg_ep_kicker", "ta90cad343257940bfecf8a1ded1f3615"."defense_rank", "ta90cad343257940bfecf8a1ded1f3615"."grade_position", "ta90cad343257940bfecf8a1ded1f3615"."height", "ta90cad343257940bfecf8a1ded1f3615"."run_block", "ta90cad343257940bfecf8a1ded1f3615"."offense_snaps", "ta90cad343257940bfecf8a1ded1f3615"."special_teams_snaps", "ta90cad343257940bfecf8a1ded1f3615"."coverage_snaps", "ta90cad343257940bfecf8a1ded1f3615"."punter_rank", "ta90cad343257940bfecf8a1ded1f3615"."age", "ta90cad343257940bfecf8a1ded1f3615"."pass_rush", "ta90cad343257940bfecf8a1ded1f3615"."punter", "ta90cad343257940bfecf8a1ded1f3615"."unit", "ta90cad343257940bfecf8a1ded1f3615"."pass_block", "ta90cad343257940bfecf8a1ded1f3615"."run_block_snaps", "ta90cad343257940bfecf8a1ded1f3615"."offense_ranked", "ta90cad343257940bfecf8a1ded1f3615"."jersey_number", "ta90cad343257940bfecf8a1ded1f3615"."position", "ta90cad343257940bfecf8a1ded1f3615"."defense_snaps", "ta90cad343257940bfecf8a1ded1f3615"."pass_snaps", "ta90cad343257940bfecf8a1ded1f3615"."receiving", "ta90cad343257940bfecf8a1ded1f3615"."coverage", "ta90cad343257940bfecf8a1ded1f3615"."speed", "ta90cad343257940bfecf8a1ded1f3615"."run", "ta90cad343257940bfecf8a1ded1f3615"."run_defense_snaps", "ta90cad343257940bfecf8a1ded1f3615"."defense_ranked", "ta90cad343257940bfecf8a1ded1f3615"."pass_rush_snaps", "ta90cad343257940bfecf8a1ded1f3615"."pass_block_snaps", "ta90cad343257940bfecf8a1ded1f3615"."run_defense", "ta90cad343257940bfecf8a1ded1f3615"."special_teams_rank", "ta90cad343257940bfecf8a1ded1f3615"."run_snaps", "ta90cad343257940bfecf8a1ded1f3615"."meets_snap_minimum", "ta90cad343257940bfecf8a1ded1f3615"."kickoff_kicker", "ta90cad343257940bfecf8a1ded1f3615"."status", "ta90cad343257940bfecf8a1ded1f3615"."pass", "ta90cad343257940bfecf8a1ded1f3615"."receiving_snaps", "ta90cad343257940bfecf8a1ded1f3615"."weight", "ta90cad343257940bfecf8a1ded1f3615"."overall_snaps", "ta90cad343257940bfecf8a1ded1f3615"."offense_rank", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })
})
