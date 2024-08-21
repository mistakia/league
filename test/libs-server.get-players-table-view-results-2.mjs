/* global describe it */

import { get_players_table_view_results } from '#libs-server'
import { compare_queries } from './utils/index.mjs'

describe('LIBS SERVER get_players_table_view_results', () => {
  it('player contract with no params', () => {
    const query = get_players_table_view_results({
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
    const query = get_players_table_view_results({
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
    const query = get_players_table_view_results({
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
    const expected_query = `with "t5d6fff1e562ab9043d5466e404f7ead4" as (select "nfl_plays"."off", undefined as rate_type_total_count from "nfl_plays" where "nfl_plays"."seas_type" = 'REG' and not "play_type" = 'NOPL' and "nfl_plays"."year" in (2023) group by "nfl_plays"."off"), "t637d41a7043612873a6e482c3ffa3223" as (select "nfl_plays"."off" as "nfl_team", "nfl_plays"."year", "nfl_plays"."week", SUM(pass_yds) AS team_pass_yds_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."year" in (2023) group by "nfl_plays"."off", "nfl_plays"."year", "nfl_plays"."week"), "t637d41a7043612873a6e482c3ffa3223_player_team_stats" as (select "player_gamelogs"."pid", sum(t637d41a7043612873a6e482c3ffa3223.team_pass_yds_from_plays) as team_pass_yds_from_plays from "player_gamelogs" inner join "nfl_games" on "player_gamelogs"."esbid" = "nfl_games"."esbid" inner join "t637d41a7043612873a6e482c3ffa3223" on "player_gamelogs"."tm" = "t637d41a7043612873a6e482c3ffa3223"."nfl_team" and "nfl_games"."year" = "t637d41a7043612873a6e482c3ffa3223"."year" and "nfl_games"."week" = "t637d41a7043612873a6e482c3ffa3223"."week" where "nfl_games"."seas_type" = 'REG' and "nfl_games"."year" in (2023) group by "player_gamelogs"."pid") select "player"."pid", CAST(t637d41a7043612873a6e482c3ffa3223_player_team_stats.team_pass_yds_from_plays AS DECIMAL) / NULLIF(CAST(t5d6fff1e562ab9043d5466e404f7ead4.rate_type_total_count AS DECIMAL), 0) AS "team_pass_yds_from_plays_0", "player"."pos" from "player" left join "t5d6fff1e562ab9043d5466e404f7ead4" on "t5d6fff1e562ab9043d5466e404f7ead4"."off" = "player"."current_nfl_team" left join "t637d41a7043612873a6e482c3ffa3223_player_team_stats" on "t637d41a7043612873a6e482c3ffa3223_player_team_stats"."pid" = "player"."pid" group by "t637d41a7043612873a6e482c3ffa3223_player_team_stats"."team_pass_yds_from_plays", t5d6fff1e562ab9043d5466e404f7ead4.rate_type_total_count, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('team stat with per_team_off_pass_play', () => {
    const query = get_players_table_view_results({
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
    const expected_query = `with "t26cf63e426dd45ec471cd5ca968f62de" as (select "nfl_plays"."off", undefined as rate_type_total_count from "nfl_plays" where "nfl_plays"."seas_type" = 'REG' and not "play_type" = 'NOPL' and "play_type" = 'PASS' and "nfl_plays"."year" in (2023) group by "nfl_plays"."off"), "t637d41a7043612873a6e482c3ffa3223" as (select "nfl_plays"."off" as "nfl_team", "nfl_plays"."year", "nfl_plays"."week", SUM(pass_yds) AS team_pass_yds_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."year" in (2023) group by "nfl_plays"."off", "nfl_plays"."year", "nfl_plays"."week"), "t637d41a7043612873a6e482c3ffa3223_player_team_stats" as (select "player_gamelogs"."pid", sum(t637d41a7043612873a6e482c3ffa3223.team_pass_yds_from_plays) as team_pass_yds_from_plays from "player_gamelogs" inner join "nfl_games" on "player_gamelogs"."esbid" = "nfl_games"."esbid" inner join "t637d41a7043612873a6e482c3ffa3223" on "player_gamelogs"."tm" = "t637d41a7043612873a6e482c3ffa3223"."nfl_team" and "nfl_games"."year" = "t637d41a7043612873a6e482c3ffa3223"."year" and "nfl_games"."week" = "t637d41a7043612873a6e482c3ffa3223"."week" where "nfl_games"."seas_type" = 'REG' and "nfl_games"."year" in (2023) group by "player_gamelogs"."pid") select "player"."pid", CAST(t637d41a7043612873a6e482c3ffa3223_player_team_stats.team_pass_yds_from_plays AS DECIMAL) / NULLIF(CAST(t26cf63e426dd45ec471cd5ca968f62de.rate_type_total_count AS DECIMAL), 0) AS "team_pass_yds_from_plays_0", "player"."pos" from "player" left join "t26cf63e426dd45ec471cd5ca968f62de" on "t26cf63e426dd45ec471cd5ca968f62de"."off" = "player"."current_nfl_team" left join "t637d41a7043612873a6e482c3ffa3223_player_team_stats" on "t637d41a7043612873a6e482c3ffa3223_player_team_stats"."pid" = "player"."pid" group by "t637d41a7043612873a6e482c3ffa3223_player_team_stats"."team_pass_yds_from_plays", t26cf63e426dd45ec471cd5ca968f62de.rate_type_total_count, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('team stat with per_team_off_rush_play', () => {
    const query = get_players_table_view_results({
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
    const expected_query = `with "t520a1e311ccb8d5c29bf3cf36c00767f" as (select "nfl_plays"."off", undefined as rate_type_total_count from "nfl_plays" where "nfl_plays"."seas_type" = 'REG' and not "play_type" = 'NOPL' and "play_type" = 'RUSH' and "nfl_plays"."year" in (2023) group by "nfl_plays"."off"), "t637d41a7043612873a6e482c3ffa3223" as (select "nfl_plays"."off" as "nfl_team", "nfl_plays"."year", "nfl_plays"."week", SUM(rush_yds) AS team_rush_yds_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."year" in (2023) group by "nfl_plays"."off", "nfl_plays"."year", "nfl_plays"."week"), "t637d41a7043612873a6e482c3ffa3223_player_team_stats" as (select "player_gamelogs"."pid", sum(t637d41a7043612873a6e482c3ffa3223.team_rush_yds_from_plays) as team_rush_yds_from_plays from "player_gamelogs" inner join "nfl_games" on "player_gamelogs"."esbid" = "nfl_games"."esbid" inner join "t637d41a7043612873a6e482c3ffa3223" on "player_gamelogs"."tm" = "t637d41a7043612873a6e482c3ffa3223"."nfl_team" and "nfl_games"."year" = "t637d41a7043612873a6e482c3ffa3223"."year" and "nfl_games"."week" = "t637d41a7043612873a6e482c3ffa3223"."week" where "nfl_games"."seas_type" = 'REG' and "nfl_games"."year" in (2023) group by "player_gamelogs"."pid") select "player"."pid", CAST(t637d41a7043612873a6e482c3ffa3223_player_team_stats.team_rush_yds_from_plays AS DECIMAL) / NULLIF(CAST(t520a1e311ccb8d5c29bf3cf36c00767f.rate_type_total_count AS DECIMAL), 0) AS "team_rush_yds_from_plays_0", "player"."pos" from "player" left join "t520a1e311ccb8d5c29bf3cf36c00767f" on "t520a1e311ccb8d5c29bf3cf36c00767f"."off" = "player"."current_nfl_team" left join "t637d41a7043612873a6e482c3ffa3223_player_team_stats" on "t637d41a7043612873a6e482c3ffa3223_player_team_stats"."pid" = "player"."pid" group by "t637d41a7043612873a6e482c3ffa3223_player_team_stats"."team_rush_yds_from_plays", t520a1e311ccb8d5c29bf3cf36c00767f.rate_type_total_count, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('team stat with per_team_half', () => {
    const query = get_players_table_view_results({
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
    const query = get_players_table_view_results({
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
    const query = get_players_table_view_results({
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
    const query = get_players_table_view_results({
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
})
