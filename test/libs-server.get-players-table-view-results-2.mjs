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

  it('player contract with no params', async () => {
    const { query } = await get_data_view_results_query({
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

    const expected_query = `select "player"."pid", "tb75ca4f410cdaf4b86f84af5464987dd"."base_salary" AS "base_salary_0", "player"."pos" from "player" left join "player_contracts" as "tb75ca4f410cdaf4b86f84af5464987dd" on "tb75ca4f410cdaf4b86f84af5464987dd"."pid" = "player"."pid" and tb75ca4f410cdaf4b86f84af5464987dd.year = '${constants.season.stats_season_year}' group by "tb75ca4f410cdaf4b86f84af5464987dd"."base_salary", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('player contract with year', async () => {
    const { query } = await get_data_view_results_query({
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

  it('team stat with per_team_play', async () => {
    const { query } = await get_data_view_results_query({
      columns: [
        {
          column_id: 'team_pass_yards_from_plays',
          params: {
            rate_type: ['per_team_play'],
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
    const expected_query = `with "t1b4e6c4c92e262de7a6b4e92d1f3c5d5" as (select "nfl_plays"."off", COUNT(*) as rate_type_total_count from "nfl_plays" where "nfl_plays"."seas_type" = 'REG' and not "play_type" = 'NOPL' and "play_type" in ('PASS', 'RUSH') and "nfl_plays"."year" in (2023) group by "nfl_plays"."off"), "t36bf0474d4db796322b4fe1d9755f770" as (select "nfl_plays"."off" as "nfl_team", SUM(pass_yds) AS team_pass_yds_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."year" in (2023) group by "nfl_plays"."off"), "t36bf0474d4db796322b4fe1d9755f770_team_stats" as (select "t36bf0474d4db796322b4fe1d9755f770"."nfl_team", sum(t36bf0474d4db796322b4fe1d9755f770.team_pass_yds_from_plays) as team_pass_yds_from_plays from "t36bf0474d4db796322b4fe1d9755f770" group by "t36bf0474d4db796322b4fe1d9755f770"."nfl_team") select "player"."pid", CAST(t36bf0474d4db796322b4fe1d9755f770_team_stats.team_pass_yds_from_plays AS DECIMAL) / NULLIF(CAST(t1b4e6c4c92e262de7a6b4e92d1f3c5d5.rate_type_total_count AS DECIMAL), 0) AS "team_pass_yds_from_plays_0", "player"."pos" from "player" left join "t1b4e6c4c92e262de7a6b4e92d1f3c5d5" on "t1b4e6c4c92e262de7a6b4e92d1f3c5d5"."off" = "player"."current_nfl_team" left join "t36bf0474d4db796322b4fe1d9755f770_team_stats" on "t36bf0474d4db796322b4fe1d9755f770_team_stats"."nfl_team" = "player"."current_nfl_team" group by "t36bf0474d4db796322b4fe1d9755f770_team_stats"."team_pass_yds_from_plays", t1b4e6c4c92e262de7a6b4e92d1f3c5d5.rate_type_total_count, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('team stat with per_team_pass_play', async () => {
    const { query } = await get_data_view_results_query({
      columns: [
        {
          column_id: 'team_pass_yards_from_plays',
          params: {
            rate_type: ['per_team_pass_play'],
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
    const expected_query = `with "t6065fa4a5f3236295d9c4c5fc1761c66" as (select "nfl_plays"."off", COUNT(*) as rate_type_total_count from "nfl_plays" where "nfl_plays"."seas_type" = 'REG' and not "play_type" = 'NOPL' and "play_type" = 'PASS' and "nfl_plays"."year" in (2023) group by "nfl_plays"."off"), "t36bf0474d4db796322b4fe1d9755f770" as (select "nfl_plays"."off" as "nfl_team", SUM(pass_yds) AS team_pass_yds_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."year" in (2023) group by "nfl_plays"."off"), "t36bf0474d4db796322b4fe1d9755f770_team_stats" as (select "t36bf0474d4db796322b4fe1d9755f770"."nfl_team", sum(t36bf0474d4db796322b4fe1d9755f770.team_pass_yds_from_plays) as team_pass_yds_from_plays from "t36bf0474d4db796322b4fe1d9755f770" group by "t36bf0474d4db796322b4fe1d9755f770"."nfl_team") select "player"."pid", CAST(t36bf0474d4db796322b4fe1d9755f770_team_stats.team_pass_yds_from_plays AS DECIMAL) / NULLIF(CAST(t6065fa4a5f3236295d9c4c5fc1761c66.rate_type_total_count AS DECIMAL), 0) AS "team_pass_yds_from_plays_0", "player"."pos" from "player" left join "t6065fa4a5f3236295d9c4c5fc1761c66" on "t6065fa4a5f3236295d9c4c5fc1761c66"."off" = "player"."current_nfl_team" left join "t36bf0474d4db796322b4fe1d9755f770_team_stats" on "t36bf0474d4db796322b4fe1d9755f770_team_stats"."nfl_team" = "player"."current_nfl_team" group by "t36bf0474d4db796322b4fe1d9755f770_team_stats"."team_pass_yds_from_plays", t6065fa4a5f3236295d9c4c5fc1761c66.rate_type_total_count, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('team stat with per_team_rush_play', async () => {
    const { query } = await get_data_view_results_query({
      columns: [
        {
          column_id: 'team_rush_yards_from_plays',
          params: {
            rate_type: ['per_team_rush_play'],
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
    const expected_query = `with "tc2ea28ca61de58886f92690134037be1" as (select "nfl_plays"."off", COUNT(*) as rate_type_total_count from "nfl_plays" where "nfl_plays"."seas_type" = 'REG' and not "play_type" = 'NOPL' and "play_type" = 'RUSH' and "nfl_plays"."year" in (2023) group by "nfl_plays"."off"), "t36bf0474d4db796322b4fe1d9755f770" as (select "nfl_plays"."off" as "nfl_team", SUM(rush_yds) AS team_rush_yds_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."year" in (2023) group by "nfl_plays"."off"), "t36bf0474d4db796322b4fe1d9755f770_team_stats" as (select "t36bf0474d4db796322b4fe1d9755f770"."nfl_team", sum(t36bf0474d4db796322b4fe1d9755f770.team_rush_yds_from_plays) as team_rush_yds_from_plays from "t36bf0474d4db796322b4fe1d9755f770" group by "t36bf0474d4db796322b4fe1d9755f770"."nfl_team") select "player"."pid", CAST(t36bf0474d4db796322b4fe1d9755f770_team_stats.team_rush_yds_from_plays AS DECIMAL) / NULLIF(CAST(tc2ea28ca61de58886f92690134037be1.rate_type_total_count AS DECIMAL), 0) AS "team_rush_yds_from_plays_0", "player"."pos" from "player" left join "tc2ea28ca61de58886f92690134037be1" on "tc2ea28ca61de58886f92690134037be1"."off" = "player"."current_nfl_team" left join "t36bf0474d4db796322b4fe1d9755f770_team_stats" on "t36bf0474d4db796322b4fe1d9755f770_team_stats"."nfl_team" = "player"."current_nfl_team" group by "t36bf0474d4db796322b4fe1d9755f770_team_stats"."team_rush_yds_from_plays", tc2ea28ca61de58886f92690134037be1.rate_type_total_count, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('team stat with per_team_half', async () => {
    const { query } = await get_data_view_results_query({
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
    const expected_query = `with "t0b4f7c0136ebcbadf5576e83fbb6c929" as (select "nfl_plays"."off", COUNT(DISTINCT CONCAT(nfl_plays.esbid, CASE WHEN qtr <= 2 THEN 1 ELSE 2 END)) as rate_type_total_count from "nfl_plays" where "nfl_plays"."seas_type" = 'REG' and not "play_type" = 'NOPL' and "play_type" in ('PASS', 'RUSH') and "nfl_plays"."year" in (2023) group by "nfl_plays"."off"), "t36bf0474d4db796322b4fe1d9755f770" as (select "nfl_plays"."off" as "nfl_team", SUM(pass_yds) AS team_pass_yds_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."year" in (2023) group by "nfl_plays"."off"), "t36bf0474d4db796322b4fe1d9755f770_team_stats" as (select "t36bf0474d4db796322b4fe1d9755f770"."nfl_team", sum(t36bf0474d4db796322b4fe1d9755f770.team_pass_yds_from_plays) as team_pass_yds_from_plays from "t36bf0474d4db796322b4fe1d9755f770" group by "t36bf0474d4db796322b4fe1d9755f770"."nfl_team") select "player"."pid", CAST(t36bf0474d4db796322b4fe1d9755f770_team_stats.team_pass_yds_from_plays AS DECIMAL) / NULLIF(CAST(t0b4f7c0136ebcbadf5576e83fbb6c929.rate_type_total_count AS DECIMAL), 0) AS "team_pass_yds_from_plays_0", "player"."pos" from "player" left join "t0b4f7c0136ebcbadf5576e83fbb6c929" on "t0b4f7c0136ebcbadf5576e83fbb6c929"."off" = "player"."current_nfl_team" left join "t36bf0474d4db796322b4fe1d9755f770_team_stats" on "t36bf0474d4db796322b4fe1d9755f770_team_stats"."nfl_team" = "player"."current_nfl_team" group by "t36bf0474d4db796322b4fe1d9755f770_team_stats"."team_pass_yds_from_plays", t0b4f7c0136ebcbadf5576e83fbb6c929.rate_type_total_count, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('team stat with per_team_quarter', async () => {
    const { query } = await get_data_view_results_query({
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
    const expected_query = `with "tceb97d46192522de48d043bb0be8dbe0" as (select "nfl_plays"."off", COUNT(DISTINCT CONCAT(nfl_plays.esbid, qtr)) as rate_type_total_count from "nfl_plays" where "nfl_plays"."seas_type" = 'REG' and not "play_type" = 'NOPL' and "play_type" in ('PASS', 'RUSH') and "nfl_plays"."year" in (2023) group by "nfl_plays"."off"), "t36bf0474d4db796322b4fe1d9755f770" as (select "nfl_plays"."off" as "nfl_team", SUM(pass_yds) AS team_pass_yds_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."year" in (2023) group by "nfl_plays"."off"), "t36bf0474d4db796322b4fe1d9755f770_team_stats" as (select "t36bf0474d4db796322b4fe1d9755f770"."nfl_team", sum(t36bf0474d4db796322b4fe1d9755f770.team_pass_yds_from_plays) as team_pass_yds_from_plays from "t36bf0474d4db796322b4fe1d9755f770" group by "t36bf0474d4db796322b4fe1d9755f770"."nfl_team") select "player"."pid", CAST(t36bf0474d4db796322b4fe1d9755f770_team_stats.team_pass_yds_from_plays AS DECIMAL) / NULLIF(CAST(tceb97d46192522de48d043bb0be8dbe0.rate_type_total_count AS DECIMAL), 0) AS "team_pass_yds_from_plays_0", "player"."pos" from "player" left join "tceb97d46192522de48d043bb0be8dbe0" on "tceb97d46192522de48d043bb0be8dbe0"."off" = "player"."current_nfl_team" left join "t36bf0474d4db796322b4fe1d9755f770_team_stats" on "t36bf0474d4db796322b4fe1d9755f770_team_stats"."nfl_team" = "player"."current_nfl_team" group by "t36bf0474d4db796322b4fe1d9755f770_team_stats"."team_pass_yds_from_plays", tceb97d46192522de48d043bb0be8dbe0.rate_type_total_count, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('team stat with per_team_drive', async () => {
    const { query } = await get_data_view_results_query({
      columns: [
        {
          column_id: 'team_pass_yards_from_plays',
          params: {
            rate_type: ['per_team_drive'],
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
    const expected_query = `with "t143ad2f4847754cd49284798396addeb" as (select "nfl_plays"."off", COUNT(DISTINCT CONCAT(nfl_plays.esbid, drive_seq)) as rate_type_total_count from "nfl_plays" where "nfl_plays"."seas_type" = 'REG' and not "play_type" = 'NOPL' and "play_type" in ('PASS', 'RUSH') and "nfl_plays"."year" in (2023) group by "nfl_plays"."off"), "t36bf0474d4db796322b4fe1d9755f770" as (select "nfl_plays"."off" as "nfl_team", SUM(pass_yds) AS team_pass_yds_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."year" in (2023) group by "nfl_plays"."off"), "t36bf0474d4db796322b4fe1d9755f770_team_stats" as (select "t36bf0474d4db796322b4fe1d9755f770"."nfl_team", sum(t36bf0474d4db796322b4fe1d9755f770.team_pass_yds_from_plays) as team_pass_yds_from_plays from "t36bf0474d4db796322b4fe1d9755f770" group by "t36bf0474d4db796322b4fe1d9755f770"."nfl_team") select "player"."pid", CAST(t36bf0474d4db796322b4fe1d9755f770_team_stats.team_pass_yds_from_plays AS DECIMAL) / NULLIF(CAST(t143ad2f4847754cd49284798396addeb.rate_type_total_count AS DECIMAL), 0) AS "team_pass_yds_from_plays_0", "player"."pos" from "player" left join "t143ad2f4847754cd49284798396addeb" on "t143ad2f4847754cd49284798396addeb"."off" = "player"."current_nfl_team" left join "t36bf0474d4db796322b4fe1d9755f770_team_stats" on "t36bf0474d4db796322b4fe1d9755f770_team_stats"."nfl_team" = "player"."current_nfl_team" group by "t36bf0474d4db796322b4fe1d9755f770_team_stats"."team_pass_yds_from_plays", t143ad2f4847754cd49284798396addeb.rate_type_total_count, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('team stat with per_team_series', async () => {
    const { query } = await get_data_view_results_query({
      columns: [
        {
          column_id: 'team_pass_yards_from_plays',
          params: {
            rate_type: ['per_team_series'],
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
    const expected_query = `with "t26c224983c7e328dd625a56de386d1c5" as (select "nfl_plays"."off", COUNT(DISTINCT CONCAT(nfl_plays.esbid, series_seq)) as rate_type_total_count from "nfl_plays" where "nfl_plays"."seas_type" = 'REG' and not "play_type" = 'NOPL' and "play_type" in ('PASS', 'RUSH') and "nfl_plays"."year" in (2023) group by "nfl_plays"."off"), "t36bf0474d4db796322b4fe1d9755f770" as (select "nfl_plays"."off" as "nfl_team", SUM(pass_yds) AS team_pass_yds_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."year" in (2023) group by "nfl_plays"."off"), "t36bf0474d4db796322b4fe1d9755f770_team_stats" as (select "t36bf0474d4db796322b4fe1d9755f770"."nfl_team", sum(t36bf0474d4db796322b4fe1d9755f770.team_pass_yds_from_plays) as team_pass_yds_from_plays from "t36bf0474d4db796322b4fe1d9755f770" group by "t36bf0474d4db796322b4fe1d9755f770"."nfl_team") select "player"."pid", CAST(t36bf0474d4db796322b4fe1d9755f770_team_stats.team_pass_yds_from_plays AS DECIMAL) / NULLIF(CAST(t26c224983c7e328dd625a56de386d1c5.rate_type_total_count AS DECIMAL), 0) AS "team_pass_yds_from_plays_0", "player"."pos" from "player" left join "t26c224983c7e328dd625a56de386d1c5" on "t26c224983c7e328dd625a56de386d1c5"."off" = "player"."current_nfl_team" left join "t36bf0474d4db796322b4fe1d9755f770_team_stats" on "t36bf0474d4db796322b4fe1d9755f770_team_stats"."nfl_team" = "player"."current_nfl_team" group by "t36bf0474d4db796322b4fe1d9755f770_team_stats"."team_pass_yds_from_plays", t26c224983c7e328dd625a56de386d1c5.rate_type_total_count, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('per_player_catchable_deep_target', async () => {
    const { query } = await get_data_view_results_query({
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

  it('pff_player_seasonlogs', async () => {
    const { query } = await get_data_view_results_query({
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
    const expected_query = `select "player"."pid", "ta90cad343257940bfecf8a1ded1f3615"."offense" AS "pff_offense_0", "ta90cad343257940bfecf8a1ded1f3615"."defense" AS "pff_defense_0", "ta90cad343257940bfecf8a1ded1f3615"."special_teams" AS "pff_special_teams_0", "ta90cad343257940bfecf8a1ded1f3615"."fg_ep_kicker" AS "pff_fg_ep_kicker_0", "ta90cad343257940bfecf8a1ded1f3615"."defense_rank" AS "pff_defense_rank_0", "ta90cad343257940bfecf8a1ded1f3615"."grade_position" AS "pff_grade_position_0", "ta90cad343257940bfecf8a1ded1f3615"."height" AS "pff_height_0", "ta90cad343257940bfecf8a1ded1f3615"."run_block" AS "pff_run_block_0", "ta90cad343257940bfecf8a1ded1f3615"."offense_snaps" AS "pff_offense_snaps_0", "ta90cad343257940bfecf8a1ded1f3615"."special_teams_snaps" AS "pff_special_teams_snaps_0", "ta90cad343257940bfecf8a1ded1f3615"."coverage_snaps" AS "pff_coverage_snaps_0", "ta90cad343257940bfecf8a1ded1f3615"."punter_rank" AS "pff_punter_rank_0", "ta90cad343257940bfecf8a1ded1f3615"."age" AS "pff_age_0", "ta90cad343257940bfecf8a1ded1f3615"."pass_rush" AS "pff_pass_rush_0", "ta90cad343257940bfecf8a1ded1f3615"."punter" AS "pff_punter_0", "ta90cad343257940bfecf8a1ded1f3615"."unit" AS "pff_unit_0", "ta90cad343257940bfecf8a1ded1f3615"."pass_block" AS "pff_pass_block_0", "ta90cad343257940bfecf8a1ded1f3615"."run_block_snaps" AS "pff_run_block_snaps_0", "ta90cad343257940bfecf8a1ded1f3615"."offense_ranked" AS "pff_offense_ranked_0", "ta90cad343257940bfecf8a1ded1f3615"."jersey_number" AS "pff_jersey_number_0", "ta90cad343257940bfecf8a1ded1f3615"."position" AS "pff_position_0", "ta90cad343257940bfecf8a1ded1f3615"."defense_snaps" AS "pff_defense_snaps_0", "ta90cad343257940bfecf8a1ded1f3615"."pass_snaps" AS "pff_pass_snaps_0", "ta90cad343257940bfecf8a1ded1f3615"."receiving" AS "pff_receiving_0", "ta90cad343257940bfecf8a1ded1f3615"."coverage" AS "pff_coverage_0", "ta90cad343257940bfecf8a1ded1f3615"."speed" AS "pff_speed_0", "ta90cad343257940bfecf8a1ded1f3615"."run" AS "pff_run_0", "ta90cad343257940bfecf8a1ded1f3615"."run_defense_snaps" AS "pff_run_defense_snaps_0", "ta90cad343257940bfecf8a1ded1f3615"."defense_ranked" AS "pff_defense_ranked_0", "ta90cad343257940bfecf8a1ded1f3615"."pass_rush_snaps" AS "pff_pass_rush_snaps_0", "ta90cad343257940bfecf8a1ded1f3615"."pass_block_snaps" AS "pff_pass_block_snaps_0", "ta90cad343257940bfecf8a1ded1f3615"."run_defense" AS "pff_run_defense_0", "ta90cad343257940bfecf8a1ded1f3615"."special_teams_rank" AS "pff_special_teams_rank_0", "ta90cad343257940bfecf8a1ded1f3615"."run_snaps" AS "pff_run_snaps_0", "ta90cad343257940bfecf8a1ded1f3615"."meets_snap_minimum" AS "pff_meets_snap_minimum_0", "ta90cad343257940bfecf8a1ded1f3615"."kickoff_kicker" AS "pff_kickoff_kicker_0", "ta90cad343257940bfecf8a1ded1f3615"."status" AS "pff_status_0", "ta90cad343257940bfecf8a1ded1f3615"."pass" AS "pff_pass_0", "ta90cad343257940bfecf8a1ded1f3615"."receiving_snaps" AS "pff_receiving_snaps_0", "ta90cad343257940bfecf8a1ded1f3615"."weight" AS "pff_weight_0", "ta90cad343257940bfecf8a1ded1f3615"."overall_snaps" AS "pff_overall_snaps_0", "ta90cad343257940bfecf8a1ded1f3615"."offense_rank" AS "pff_offense_rank_0", "player"."pos" from "player" left join "pff_player_seasonlogs" as "ta90cad343257940bfecf8a1ded1f3615" on "ta90cad343257940bfecf8a1ded1f3615"."pid" = "player"."pid" and "ta90cad343257940bfecf8a1ded1f3615"."year" = 2023 group by "ta90cad343257940bfecf8a1ded1f3615"."offense", "ta90cad343257940bfecf8a1ded1f3615"."defense", "ta90cad343257940bfecf8a1ded1f3615"."special_teams", "ta90cad343257940bfecf8a1ded1f3615"."fg_ep_kicker", "ta90cad343257940bfecf8a1ded1f3615"."defense_rank", "ta90cad343257940bfecf8a1ded1f3615"."grade_position", "ta90cad343257940bfecf8a1ded1f3615"."height", "ta90cad343257940bfecf8a1ded1f3615"."run_block", "ta90cad343257940bfecf8a1ded1f3615"."offense_snaps", "ta90cad343257940bfecf8a1ded1f3615"."special_teams_snaps", "ta90cad343257940bfecf8a1ded1f3615"."coverage_snaps", "ta90cad343257940bfecf8a1ded1f3615"."punter_rank", "ta90cad343257940bfecf8a1ded1f3615"."age", "ta90cad343257940bfecf8a1ded1f3615"."pass_rush", "ta90cad343257940bfecf8a1ded1f3615"."punter", "ta90cad343257940bfecf8a1ded1f3615"."unit", "ta90cad343257940bfecf8a1ded1f3615"."pass_block", "ta90cad343257940bfecf8a1ded1f3615"."run_block_snaps", "ta90cad343257940bfecf8a1ded1f3615"."offense_ranked", "ta90cad343257940bfecf8a1ded1f3615"."jersey_number", "ta90cad343257940bfecf8a1ded1f3615"."position", "ta90cad343257940bfecf8a1ded1f3615"."defense_snaps", "ta90cad343257940bfecf8a1ded1f3615"."pass_snaps", "ta90cad343257940bfecf8a1ded1f3615"."receiving", "ta90cad343257940bfecf8a1ded1f3615"."coverage", "ta90cad343257940bfecf8a1ded1f3615"."speed", "ta90cad343257940bfecf8a1ded1f3615"."run", "ta90cad343257940bfecf8a1ded1f3615"."run_defense_snaps", "ta90cad343257940bfecf8a1ded1f3615"."defense_ranked", "ta90cad343257940bfecf8a1ded1f3615"."pass_rush_snaps", "ta90cad343257940bfecf8a1ded1f3615"."pass_block_snaps", "ta90cad343257940bfecf8a1ded1f3615"."run_defense", "ta90cad343257940bfecf8a1ded1f3615"."special_teams_rank", "ta90cad343257940bfecf8a1ded1f3615"."run_snaps", "ta90cad343257940bfecf8a1ded1f3615"."meets_snap_minimum", "ta90cad343257940bfecf8a1ded1f3615"."kickoff_kicker", "ta90cad343257940bfecf8a1ded1f3615"."status", "ta90cad343257940bfecf8a1ded1f3615"."pass", "ta90cad343257940bfecf8a1ded1f3615"."receiving_snaps", "ta90cad343257940bfecf8a1ded1f3615"."weight", "ta90cad343257940bfecf8a1ded1f3615"."overall_snaps", "ta90cad343257940bfecf8a1ded1f3615"."offense_rank", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('pff_player_seasonlogs with where', async () => {
    const { query } = await get_data_view_results_query({
      columns: [
        'player_pff_offense_rank',
        'player_pff_offense',
        'player_pff_offense_snaps',
        'player_pff_offense_ranked'
      ],
      sort: [
        {
          column_id: 'player_pff_offense',
          desc: true,
          column_index: 0
        }
      ],
      where: [
        {
          column_id: 'player_pff_offense_snaps',
          params: {},
          value: '200',
          operator: '>='
        }
      ],
      prefix_columns: [
        'player_name',
        'player_position',
        'player_league_roster_status'
      ],
      splits: []
    })
    const expected_query = `select "player"."pid", "ta90cad343257940bfecf8a1ded1f3615"."offense_rank" AS "pff_offense_rank_0", "ta90cad343257940bfecf8a1ded1f3615"."offense" AS "pff_offense_0", "ta90cad343257940bfecf8a1ded1f3615"."offense_snaps" AS "pff_offense_snaps_0", "ta90cad343257940bfecf8a1ded1f3615"."offense_ranked" AS "pff_offense_ranked_0", player.fname, player.lname, "player"."pos" AS "pos_0", CASE WHEN rosters_players.slot = 13 THEN 'injured_reserve' WHEN rosters_players.slot = 12 THEN 'practice_squad' WHEN rosters_players.slot IS NULL THEN 'free_agent' ELSE 'active_roster' END AS player_league_roster_status, rosters_players.slot, rosters_players.tid, rosters_players.tag, "player"."pos" from "player" inner join "pff_player_seasonlogs" as "ta90cad343257940bfecf8a1ded1f3615" on "ta90cad343257940bfecf8a1ded1f3615"."pid" = "player"."pid" and "ta90cad343257940bfecf8a1ded1f3615"."year" = ${constants.season.stats_season_year} left join "rosters_players" on "rosters_players"."pid" = "player"."pid" and "rosters_players"."year" = ${constants.season.year} and "rosters_players"."week" = ${Math.min(constants.season.week, constants.season.finalWeek)} and "rosters_players"."lid" = 1 where ta90cad343257940bfecf8a1ded1f3615.offense_snaps >= '200' group by "ta90cad343257940bfecf8a1ded1f3615"."offense_rank", "ta90cad343257940bfecf8a1ded1f3615"."offense", "ta90cad343257940bfecf8a1ded1f3615"."offense_snaps", "ta90cad343257940bfecf8a1ded1f3615"."offense_ranked", player.fname, player.lname, "player"."pos", rosters_players.slot, rosters_players.tid, rosters_players.tag, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 3 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('player_salaries with where', async () => {
    const { query } = await get_data_view_results_query({
      columns: [{ column_id: 'player_dfs_salary' }],
      sort: [{ column_id: 'player_dfs_salary', desc: true }],
      where: [
        {
          column_id: 'player_dfs_salary',
          params: {},
          value: '5000',
          operator: '>='
        }
      ]
    })
    const expected_query = `with "tfdc85d6d1e23cd26bfb9b1ea27ad3e87" as (select "player_salaries"."pid", "player_salaries"."salary", "nfl_games"."year", "nfl_games"."week" from "player_salaries" inner join "nfl_games" on "player_salaries"."esbid" = "nfl_games"."esbid" where "player_salaries"."source_id" in ('DRAFTKINGS') and "nfl_games"."year" in (${constants.season.stats_season_year}) and "nfl_games"."week" in (${constants.season.week}) and player_salaries.salary >= '5000') select "player"."pid", "tfdc85d6d1e23cd26bfb9b1ea27ad3e87"."salary" AS "dfs_salary_0", "player"."pos" from "player" inner join "tfdc85d6d1e23cd26bfb9b1ea27ad3e87" on "tfdc85d6d1e23cd26bfb9b1ea27ad3e87"."pid" = "player"."pid" group by "tfdc85d6d1e23cd26bfb9b1ea27ad3e87"."salary", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('player_rankings', async () => {
    const { query } = await get_data_view_results_query({
      columns: [
        {
          column_id: 'player_average_ranking'
        },
        {
          column_id: 'player_overall_ranking'
        },
        {
          column_id: 'player_position_ranking'
        },
        {
          column_id: 'player_min_ranking'
        },
        {
          column_id: 'player_max_ranking'
        },
        {
          column_id: 'player_ranking_standard_deviation'
        }
      ],
      where: [
        {
          column_id: 'player_average_ranking',
          value: '50',
          operator: '<='
        }
      ],
      sort: [{ column_id: 'player_average_ranking', desc: false }]
    })
    const expected_query = `with "t058c73ac39f13734c9eda890a301cfe1" as (select "pid", "player_rankings_index"."avg" AS "avg", "player_rankings_index"."overall_rank" AS "overall_rank", "player_rankings_index"."position_rank" AS "position_rank", "player_rankings_index"."min" AS "min", "player_rankings_index"."max" AS "max", "player_rankings_index"."std" AS "std" from "player_rankings_index" where "source_id" in ('FANTASYPROS') and "ranking_type" in ('PPR_REDRAFT') and "year" in (${constants.season.stats_season_year}) and "week" in (${constants.season.week}) and player_rankings_index.avg <= '50') select "player"."pid", "t058c73ac39f13734c9eda890a301cfe1"."avg" AS "average_rank_0", "t058c73ac39f13734c9eda890a301cfe1"."overall_rank" AS "overall_rank_0", "t058c73ac39f13734c9eda890a301cfe1"."position_rank" AS "position_rank_0", "t058c73ac39f13734c9eda890a301cfe1"."min" AS "min_rank_0", "t058c73ac39f13734c9eda890a301cfe1"."max" AS "max_rank_0", "t058c73ac39f13734c9eda890a301cfe1"."std" AS "rank_stddev_0", "player"."pos" from "player" inner join "t058c73ac39f13734c9eda890a301cfe1" on "t058c73ac39f13734c9eda890a301cfe1"."pid" = "player"."pid" group by "t058c73ac39f13734c9eda890a301cfe1"."avg", "t058c73ac39f13734c9eda890a301cfe1"."overall_rank", "t058c73ac39f13734c9eda890a301cfe1"."position_rank", "t058c73ac39f13734c9eda890a301cfe1"."min", "t058c73ac39f13734c9eda890a301cfe1"."max", "t058c73ac39f13734c9eda890a301cfe1"."std", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 ASC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('player_game_prop_implied_probability_from_betting_markets', async () => {
    const { query } = await get_data_view_results_query({
      sort: [
        {
          column_id:
            'player_game_prop_implied_probability_from_betting_markets',
          desc: true
        }
      ],
      prefix_columns: ['player_name', 'player_position'],
      columns: [
        {
          column_id:
            'player_game_prop_implied_probability_from_betting_markets',
          params: {
            market_type: ['GAME_RUSHING_RECEIVING_TOUCHDOWNS']
          }
        }
      ],
      where: []
    })
    const expected_query = `with "t155503430bf5cf1e9aea84ca6783ae51_markets" as (select "source_id", "source_market_id", "time_type" from "prop_markets_index" where "market_type" = 'GAME_RUSHING_RECEIVING_TOUCHDOWNS' and "time_type" = 'CLOSE' and "prop_markets_index"."year" = ${constants.season.year} and "source_id" = 'FANDUEL'), "t155503430bf5cf1e9aea84ca6783ae51" as (select pms.selection_pid, pms.selection_metric_line, 1 / odds_decimal as game_prop_implied_probability from "t155503430bf5cf1e9aea84ca6783ae51_markets" as "m" inner join "prop_market_selections_index" as "pms" on "pms"."source_id" = "m"."source_id" and "pms"."source_market_id" = "m"."source_market_id" and "pms"."time_type" = "m"."time_type") select "player"."pid", player.fname, player.lname, "player"."pos" AS "pos_0", "t155503430bf5cf1e9aea84ca6783ae51"."game_prop_implied_probability" AS "game_prop_implied_probability_betting_market_0", "player"."pos" from "player" left join "t155503430bf5cf1e9aea84ca6783ae51" on "t155503430bf5cf1e9aea84ca6783ae51"."selection_pid" = "player"."pid" group by player.fname, player.lname, "player"."pos", "t155503430bf5cf1e9aea84ca6783ae51"."game_prop_implied_probability", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 5 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('player_practice', async () => {
    const { query } = await get_data_view_results_query({
      columns: [
        {
          column_id: 'player_practice_status'
        },
        {
          column_id: 'player_practice_injury'
        },
        {
          column_id: 'player_practice_designation_monday',
          params: {
            single_week: [
              {
                dynamic_type: 'current_week'
              }
            ]
          }
        },
        {
          column_id: 'player_practice_designation_tuesday'
        },
        {
          column_id: 'player_practice_designation_wednesday'
        },
        {
          column_id: 'player_practice_designation_thursday'
        },
        {
          column_id: 'player_practice_designation_friday'
        },
        {
          column_id: 'player_practice_designation_saturday'
        },
        {
          column_id: 'player_practice_designation_sunday'
        }
      ],
      sort: [{ column_id: 'player_practice_status', desc: true }]
    })
    const expected_query = `with "t6020611723198f73e3330ef86ab56ea2" as (select "pid", "formatted_status", "inj", "m", "tu", "w", "th", "f", "s", "su" from "practice" where "year" in (${constants.season.stats_season_year}) and "week" in (${constants.season.week})) select "player"."pid", "t6020611723198f73e3330ef86ab56ea2"."formatted_status" AS "practice_status_0", "t6020611723198f73e3330ef86ab56ea2"."inj" AS "practice_injury_0", "t6020611723198f73e3330ef86ab56ea2"."m" AS "player_practice_designation_m_0", "t6020611723198f73e3330ef86ab56ea2"."tu" AS "player_practice_designation_tu_0", "t6020611723198f73e3330ef86ab56ea2"."w" AS "player_practice_designation_w_0", "t6020611723198f73e3330ef86ab56ea2"."th" AS "player_practice_designation_th_0", "t6020611723198f73e3330ef86ab56ea2"."f" AS "player_practice_designation_f_0", "t6020611723198f73e3330ef86ab56ea2"."s" AS "player_practice_designation_s_0", "t6020611723198f73e3330ef86ab56ea2"."su" AS "player_practice_designation_su_0", "player"."pos" from "player" left join "t6020611723198f73e3330ef86ab56ea2" on "t6020611723198f73e3330ef86ab56ea2"."pid" = "player"."pid" group by "t6020611723198f73e3330ef86ab56ea2"."formatted_status", "t6020611723198f73e3330ef86ab56ea2"."inj", "t6020611723198f73e3330ef86ab56ea2"."m", "t6020611723198f73e3330ef86ab56ea2"."tu", "t6020611723198f73e3330ef86ab56ea2"."w", "t6020611723198f73e3330ef86ab56ea2"."th", "t6020611723198f73e3330ef86ab56ea2"."f", "t6020611723198f73e3330ef86ab56ea2"."s", "t6020611723198f73e3330ef86ab56ea2"."su", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('team_game_implied_team_total_from_betting_markets', async () => {
    const { query } = await get_data_view_results_query({
      columns: [
        {
          column_id: 'team_game_implied_team_total_from_betting_markets'
        }
      ],
      sort: [
        {
          column_id: 'team_game_implied_team_total_from_betting_markets',
          desc: true
        }
      ]
    })
    const expected_query = `with "t121851529271591f730857d3e4f98b84_spread" as (select "prop_markets_index"."esbid", "pms"."selection_pid", "pms"."selection_metric_line" as "spread" from "prop_markets_index" inner join "prop_market_selections_index" as "pms" on "pms"."source_id" = "prop_markets_index"."source_id" and "pms"."source_market_id" = "prop_markets_index"."source_market_id" and "pms"."time_type" = "prop_markets_index"."time_type" inner join "nfl_games" on "nfl_games"."esbid" = "prop_markets_index"."esbid" and "nfl_games"."year" = "prop_markets_index"."year" where "market_type" = 'GAME_SPREAD' and "prop_markets_index"."time_type" = 'CLOSE' and "prop_markets_index"."year" = ${constants.season.stats_season_year} and "prop_markets_index"."source_id" = 'DRAFTKINGS' and "nfl_games"."week" = ${constants.season.nfl_seas_week} and "nfl_games"."seas_type" = '${constants.season.nfl_seas_type}'), "t121851529271591f730857d3e4f98b84_total" as (select "prop_markets_index"."esbid", "pms"."selection_metric_line" as "total" from "prop_markets_index" inner join "prop_market_selections_index" as "pms" on "pms"."source_id" = "prop_markets_index"."source_id" and "pms"."source_market_id" = "prop_markets_index"."source_market_id" and "pms"."time_type" = "prop_markets_index"."time_type" inner join "nfl_games" on "nfl_games"."esbid" = "prop_markets_index"."esbid" and "nfl_games"."year" = "prop_markets_index"."year" where "market_type" = 'GAME_TOTAL' and "prop_markets_index"."time_type" = 'CLOSE' and "prop_markets_index"."year" = ${constants.season.stats_season_year} and "prop_markets_index"."source_id" = 'DRAFTKINGS' and "nfl_games"."week" = ${constants.season.nfl_seas_week} and "nfl_games"."seas_type" = '${constants.season.nfl_seas_type}'), "t121851529271591f730857d3e4f98b84" as (select "s"."esbid", "s"."selection_pid", (t.total - s.spread) / 2 as implied_team_total from "t121851529271591f730857d3e4f98b84_spread" as "s" inner join "t121851529271591f730857d3e4f98b84_total" as "t" on "s"."esbid" = "t"."esbid") select "player"."pid", "t121851529271591f730857d3e4f98b84"."implied_team_total" AS "team_game_implied_team_total_betting_market_0", "player"."pos" from "player" left join "t121851529271591f730857d3e4f98b84" on "t121851529271591f730857d3e4f98b84"."selection_pid" = "player"."current_nfl_team" group by "t121851529271591f730857d3e4f98b84"."implied_team_total", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('team_espn_win_rates', async () => {
    const { query } = await get_data_view_results_query({
      columns: [
        { column_id: 'team_espn_pass_rush_win_rate' },
        { column_id: 'team_espn_pass_block_win_rate' },
        { column_id: 'team_espn_run_block_win_rate' },
        { column_id: 'team_espn_run_stop_win_rate' }
      ],
      sort: [{ column_id: 'team_espn_pass_rush_win_rate', desc: true }]
    })
    const expected_query = `select "player"."pid", "espn_team_win_rates_index"."pass_rush_win_rate" AS "espn_team_pass_rush_win_rate_0", "espn_team_win_rates_index"."pass_block_win_rate" AS "espn_team_pass_block_win_rate_0", "espn_team_win_rates_index"."run_block_win_rate" AS "espn_team_run_block_win_rate_0", "espn_team_win_rates_index"."run_stop_win_rate" AS "espn_team_run_stop_win_rate_0", "player"."pos" from "player" left join "espn_team_win_rates_index" on "espn_team_win_rates_index"."team" = "player"."current_nfl_team" and "espn_team_win_rates_index"."year" = ${constants.season.year} group by "espn_team_win_rates_index"."pass_rush_win_rate", "espn_team_win_rates_index"."pass_block_win_rate", "espn_team_win_rates_index"."run_block_win_rate", "espn_team_win_rates_index"."run_stop_win_rate", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('player_espn_line_win_rate', async () => {
    const { query } = await get_data_view_results_query({
      columns: [
        {
          column_id: 'player_espn_line_win_rate',
          params: {
            win_rate_type: 'PASS_BLOCK'
          }
        }
      ],
      sort: [{ column_id: 'player_espn_line_win_rate', desc: true }]
    })
    const expected_query = `select "player"."pid", "espn_player_win_rates_index"."win_rate" AS "espn_line_win_rate_0", "player"."pos" from "player" left join "espn_player_win_rates_index" on "espn_player_win_rates_index"."pid" = "player"."pid" and "espn_player_win_rates_index"."espn_win_rate_type" = 'PASS_BLOCK' and "espn_player_win_rates_index"."year" = ${constants.season.year} group by "espn_player_win_rates_index"."win_rate", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('player prop historical hit rate and edge, with where', async () => {
    const { query } = await get_data_view_results_query({
      columns: [
        {
          column_id: 'player_game_prop_historical_hit_rate',
          params: {
            historical_range: 'current_season',
            hit_type: 'hard',
            week: [
              {
                dynamic_type: 'current_week'
              }
            ]
          }
        },
        {
          column_id: 'player_game_prop_historical_edge',
          params: {
            historical_range: 'current_season',
            hit_type: 'hard',
            week: [
              {
                dynamic_type: 'current_week'
              }
            ]
          }
        }
      ],
      sort: [{ column_id: 'player_game_prop_historical_hit_rate', desc: true }],
      where: [
        {
          column_id: 'player_game_prop_historical_edge',
          column_index: 0,
          operator: '>=',
          value: 0,
          params: {
            historical_range: 'current_season',
            hit_type: 'hard',
            week: [
              {
                dynamic_type: 'current_week'
              }
            ]
          }
        }
      ]
    })
    const expected_query = `with "tcde9ed3546153d3783feedb7fc331296_markets" as (select "source_id", "source_market_id", "time_type" from "prop_markets_index" inner join "nfl_games" on "nfl_games"."esbid" = "prop_markets_index"."esbid" and "nfl_games"."year" = "prop_markets_index"."year" and "nfl_games"."seas_type" = '${constants.season.nfl_seas_type}' and "nfl_games"."week" = ${constants.season.week} where "market_type" = 'GAME_PASSING_YARDS' and "time_type" = 'CLOSE' and "prop_markets_index"."year" = ${constants.season.year} and "source_id" = 'FANDUEL'), "tcde9ed3546153d3783feedb7fc331296" as (select pms.selection_pid, pms.selection_metric_line, pms.current_season_hit_rate_hard, pms.current_season_edge_hard from "tcde9ed3546153d3783feedb7fc331296_markets" as "m" inner join "prop_market_selections_index" as "pms" on "pms"."source_id" = "m"."source_id" and "pms"."source_market_id" = "m"."source_market_id" and "pms"."time_type" = "m"."time_type" where pms.current_season_edge_hard >= '0') select "player"."pid", tcde9ed3546153d3783feedb7fc331296.current_season_hit_rate_hard as prop_historical_hit_rate_0, tcde9ed3546153d3783feedb7fc331296.current_season_edge_hard as prop_historical_edge_0, "player"."pos" from "player" inner join "tcde9ed3546153d3783feedb7fc331296" on "tcde9ed3546153d3783feedb7fc331296"."selection_pid" = "player"."pid" group by tcde9ed3546153d3783feedb7fc331296.current_season_hit_rate_hard, tcde9ed3546153d3783feedb7fc331296.current_season_edge_hard, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('team stat with def unit and rate type', async () => {
    const { query } = await get_data_view_results_query({
      columns: [
        {
          column_id: 'team_pass_yards_from_plays',
          params: {
            team_unit: 'def',
            rate_type: 'per_team_pass_play',
            year: 2024
          }
        }
      ],
      sort: [{ column_id: 'team_pass_yards_from_plays', desc: true }]
    })
    const expected_query = `with "t72dd346e69dcc17e2e17c4083808e602" as (select "nfl_plays"."def", COUNT(*) as rate_type_total_count from "nfl_plays" where "nfl_plays"."seas_type" = 'REG' and not "play_type" = 'NOPL' and "play_type" = 'PASS' and "nfl_plays"."year" in (2024) group by "nfl_plays"."def"), "t572f4adbaed404fa0cff7011344b562d" as (select "nfl_plays"."def" as "nfl_team", SUM(pass_yds) AS team_pass_yds_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."year" in (2024) group by "nfl_plays"."def"), "t572f4adbaed404fa0cff7011344b562d_team_stats" as (select "t572f4adbaed404fa0cff7011344b562d"."nfl_team", sum(t572f4adbaed404fa0cff7011344b562d.team_pass_yds_from_plays) as team_pass_yds_from_plays from "t572f4adbaed404fa0cff7011344b562d" group by "t572f4adbaed404fa0cff7011344b562d"."nfl_team") select "player"."pid", CAST(t572f4adbaed404fa0cff7011344b562d_team_stats.team_pass_yds_from_plays AS DECIMAL) / NULLIF(CAST(t72dd346e69dcc17e2e17c4083808e602.rate_type_total_count AS DECIMAL), 0) AS "team_pass_yds_from_plays_0", "player"."pos" from "player" left join "t72dd346e69dcc17e2e17c4083808e602" on "t72dd346e69dcc17e2e17c4083808e602"."def" = "player"."current_nfl_team" left join "t572f4adbaed404fa0cff7011344b562d_team_stats" on "t572f4adbaed404fa0cff7011344b562d_team_stats"."nfl_team" = "player"."current_nfl_team" group by "t572f4adbaed404fa0cff7011344b562d_team_stats"."team_pass_yds_from_plays", t72dd346e69dcc17e2e17c4083808e602.rate_type_total_count, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('team stat with def unit and rate type, limit to player active', async () => {
    const { query } = await get_data_view_results_query({
      columns: [
        {
          column_id: 'team_pass_yards_from_plays',
          params: {
            team_unit: 'def',
            rate_type: 'per_team_pass_play',
            limit_to_player_active_games: true,
            year: 2024
          }
        }
      ],
      sort: [{ column_id: 'team_pass_yards_from_plays', desc: true }]
    })
    const expected_query = `with "t72dd346e69dcc17e2e17c4083808e602" as (select "nfl_plays"."def", COUNT(*) as rate_type_total_count from "nfl_plays" where "nfl_plays"."seas_type" = 'REG' and not "play_type" = 'NOPL' and "play_type" = 'PASS' and "nfl_plays"."year" in (2024) group by "nfl_plays"."def"), "t36ac8d28ba1c1bcff2548570f391e7cc" as (select "nfl_plays"."def" as "nfl_team", SUM(pass_yds) AS team_pass_yds_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."year" in (2024) group by "nfl_plays"."def"), "t36ac8d28ba1c1bcff2548570f391e7cc_player_team_stats" as (select "player_gamelogs"."pid", sum(t36ac8d28ba1c1bcff2548570f391e7cc.team_pass_yds_from_plays) as team_pass_yds_from_plays from "player_gamelogs" inner join "nfl_games" on "player_gamelogs"."esbid" = "nfl_games"."esbid" inner join "t36ac8d28ba1c1bcff2548570f391e7cc" on "player_gamelogs"."tm" = "t36ac8d28ba1c1bcff2548570f391e7cc"."nfl_team" and "nfl_games"."year" = "t36ac8d28ba1c1bcff2548570f391e7cc"."year" and "nfl_games"."week" = "t36ac8d28ba1c1bcff2548570f391e7cc"."week" where "nfl_games"."seas_type" = 'REG' group by "player_gamelogs"."pid") select "player"."pid", CAST(t36ac8d28ba1c1bcff2548570f391e7cc_player_team_stats.team_pass_yds_from_plays AS DECIMAL) / NULLIF(CAST(t72dd346e69dcc17e2e17c4083808e602.rate_type_total_count AS DECIMAL), 0) AS "team_pass_yds_from_plays_0", "player"."pos" from "player" left join "t72dd346e69dcc17e2e17c4083808e602" on "t72dd346e69dcc17e2e17c4083808e602"."def" = "player"."current_nfl_team" left join "t36ac8d28ba1c1bcff2548570f391e7cc_player_team_stats" on "t36ac8d28ba1c1bcff2548570f391e7cc_player_team_stats"."pid" = "player"."pid" group by "t36ac8d28ba1c1bcff2548570f391e7cc_player_team_stats"."team_pass_yds_from_plays", t72dd346e69dcc17e2e17c4083808e602.rate_type_total_count, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('team field with matchup_opponent_type param', async () => {
    const { query } = await get_data_view_results_query({
      sort: [
        {
          column_id: 'team_pass_yards_from_plays',
          desc: true
        }
      ],
      prefix_columns: ['player_name', 'player_position'],
      columns: [
        {
          column_id: 'team_pass_yards_from_plays',
          params: {
            team_unit: ['def'],
            year: [2024],
            rate_type: ['per_game'],
            matchup_opponent_type: ['current_week_opponent_total']
          }
        }
      ],
      where: [
        {
          column_id: 'game_opponent',
          operator: 'IN',
          value: ['WAS', 'ARI', 'LAR'],
          params: {
            week: [
              {
                dynamic_type: 'current_week'
              }
            ]
          }
        }
      ]
    })
    const expected_query = `with "current_week_opponents" as (select "h" as "nfl_team", "v" as "opponent" from "public"."nfl_games" where "year" = 2024 and "week" = ${constants.season.nfl_seas_week} and "seas_type" = '${constants.season.nfl_seas_type}' union select "v" as "nfl_team", "h" as "opponent" from "public"."nfl_games" where "year" = 2024 and "week" = ${constants.season.nfl_seas_week} and "seas_type" = '${constants.season.nfl_seas_type}'), "t8eab6ab582cefa683d25edd23d775e72" as (select "nfl_plays"."off" as "team", count(distinct "nfl_plays"."esbid") as "rate_type_total_count" from "nfl_plays" where "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."year" in (2024) group by "nfl_plays"."off"), "t21688413952ededbdad717469034208c" as (select "year", "week", v as nfl_team, h as game_opponent, true as game_is_home from "nfl_games" where "year" in (2024) and "week" in (${constants.season.week}) and "seas_type" = '${constants.season.nfl_seas_type}' and h IN ('WAS', 'ARI', 'LAR') union select "year", "week", h as nfl_team, v as game_opponent, false as game_is_home from "nfl_games" where "year" in (2024) and "week" in (${constants.season.week}) and "seas_type" = '${constants.season.nfl_seas_type}' and v IN ('WAS', 'ARI', 'LAR')), "t2499920d348f58d2e046bda75243c5e0" as (select "nfl_plays"."def" as "nfl_team", SUM(pass_yds) AS team_pass_yds_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."year" in (2024) group by "nfl_plays"."def"), "t2499920d348f58d2e046bda75243c5e0_team_stats" as (select "t2499920d348f58d2e046bda75243c5e0"."nfl_team", sum(t2499920d348f58d2e046bda75243c5e0.team_pass_yds_from_plays) as team_pass_yds_from_plays from "t2499920d348f58d2e046bda75243c5e0" group by "t2499920d348f58d2e046bda75243c5e0"."nfl_team") select "player"."pid", player.fname, player.lname, "player"."pos" AS "pos_0", CAST(t2499920d348f58d2e046bda75243c5e0_team_stats.team_pass_yds_from_plays AS DECIMAL) / NULLIF(CAST(t8eab6ab582cefa683d25edd23d775e72.rate_type_total_count AS DECIMAL), 0) AS "team_pass_yds_from_plays_0", "player"."pos" from "player" inner join "current_week_opponents" on "player"."current_nfl_team" = "current_week_opponents"."nfl_team" left join "t8eab6ab582cefa683d25edd23d775e72" on "t8eab6ab582cefa683d25edd23d775e72"."team" = "current_week_opponents"."opponent" inner join "t21688413952ededbdad717469034208c" on "t21688413952ededbdad717469034208c"."nfl_team" = "player"."current_nfl_team" left join "t2499920d348f58d2e046bda75243c5e0_team_stats" on "t2499920d348f58d2e046bda75243c5e0_team_stats"."nfl_team" = "current_week_opponents"."opponent" group by player.fname, player.lname, "player"."pos", "t2499920d348f58d2e046bda75243c5e0_team_stats"."team_pass_yds_from_plays", t8eab6ab582cefa683d25edd23d775e72.rate_type_total_count, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 5 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('player_snaps', async () => {
    const { query } = await get_data_view_results_query({
      columns: [{ column_id: 'player_snaps' }],
      sort: [{ column_id: 'player_snaps', desc: true }]
    })
    const expected_query = `with "t99ec2031f7623f960a0210041b13ea19" as (select "nfl_snaps"."gsis_it_id", COUNT(*) as rate_type_total_count from "nfl_plays" inner join "nfl_snaps" on "nfl_plays"."esbid" = "nfl_snaps"."esbid" and "nfl_plays"."playId" = "nfl_snaps"."playId" where "nfl_plays"."seas_type" = 'REG' and not "play_type" = 'NOPL' and "play_type" in ('PASS', 'RUSH') and "nfl_plays"."year" in (${constants.season.stats_season_year}) group by "nfl_snaps"."gsis_it_id") select "player"."pid", t99ec2031f7623f960a0210041b13ea19.rate_type_total_count as player_snaps_0, "player"."pos" from "player" left join "t99ec2031f7623f960a0210041b13ea19" on "t99ec2031f7623f960a0210041b13ea19"."gsis_it_id" = "player"."gsis_it_id" group by t99ec2031f7623f960a0210041b13ea19.rate_type_total_count, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('player yards created and blocked + team yards blocked', async () => {
    const { query } = await get_data_view_results_query({
      columns: [
        {
          column_id: 'player_yards_created_from_plays',
          params: {
            year: [2024]
          }
        },
        {
          column_id: 'player_yards_blocked_from_plays',
          params: {
            year: [2024]
          }
        },
        {
          column_id: 'team_yards_blocked_from_plays',
          params: {
            year: [2024]
          }
        }
      ],
      sort: [{ column_id: 'player_yards_created_from_plays', desc: true }]
    })
    const expected_query = `with "t879c15e01a8799a161de11923bc11a6b" as (select COALESCE(bc_pid, trg_pid) as pid, SUM(yards_created) as yards_created_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."year" in (2024) group by COALESCE(bc_pid, trg_pid)), "tbfd48ac1e7f693fefb192cf2579087b2" as (select COALESCE(bc_pid) as pid, SUM(yards_blocked) as yards_blocked_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."year" in (2024) group by COALESCE(bc_pid)), "ta883516fdb1bedbb0e8e9205ee6ae188" as (select "nfl_plays"."off" as "nfl_team", SUM(yards_blocked) AS team_yards_blocked_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."year" in (2024) group by "nfl_plays"."off"), "ta883516fdb1bedbb0e8e9205ee6ae188_team_stats" as (select "ta883516fdb1bedbb0e8e9205ee6ae188"."nfl_team", sum(ta883516fdb1bedbb0e8e9205ee6ae188.team_yards_blocked_from_plays) as team_yards_blocked_from_plays from "ta883516fdb1bedbb0e8e9205ee6ae188" group by "ta883516fdb1bedbb0e8e9205ee6ae188"."nfl_team") select "player"."pid", "t879c15e01a8799a161de11923bc11a6b"."yards_created_from_plays" AS "yards_created_from_plays_0", "tbfd48ac1e7f693fefb192cf2579087b2"."yards_blocked_from_plays" AS "yards_blocked_from_plays_0", "ta883516fdb1bedbb0e8e9205ee6ae188_team_stats"."team_yards_blocked_from_plays" AS "team_yards_blocked_from_plays_0", "player"."pos" from "player" left join "t879c15e01a8799a161de11923bc11a6b" on "t879c15e01a8799a161de11923bc11a6b"."pid" = "player"."pid" left join "tbfd48ac1e7f693fefb192cf2579087b2" on "tbfd48ac1e7f693fefb192cf2579087b2"."pid" = "player"."pid" left join "ta883516fdb1bedbb0e8e9205ee6ae188_team_stats" on "ta883516fdb1bedbb0e8e9205ee6ae188_team_stats"."nfl_team" = "player"."current_nfl_team" group by "t879c15e01a8799a161de11923bc11a6b"."yards_created_from_plays", "tbfd48ac1e7f693fefb192cf2579087b2"."yards_blocked_from_plays", "ta883516fdb1bedbb0e8e9205ee6ae188_team_stats"."team_yards_blocked_from_plays", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('player routes', async () => {
    const { query } = await get_data_view_results_query({
      columns: [
        {
          column_id: 'player_routes',
          params: {
            year: [2024]
          }
        }
      ],
      sort: [{ column_id: 'player_routes', desc: true }]
    })
    const expected_query = `with "t435f7da7b3527423757861419904233d" as (select "nfl_plays_receiver"."gsis_id", COUNT(*) as rate_type_total_count from "nfl_plays_receiver" inner join "nfl_plays" on "nfl_plays_receiver"."esbid" = "nfl_plays"."esbid" and "nfl_plays_receiver"."playId" = "nfl_plays"."playId" where "nfl_plays"."seas_type" = 'REG' and "play_type" = 'PASS' and "nfl_plays"."year" in (${constants.season.year}) group by "nfl_plays_receiver"."gsis_id") select "player"."pid", t435f7da7b3527423757861419904233d.rate_type_total_count as player_routes_0, "player"."pos" from "player" left join "t435f7da7b3527423757861419904233d" on "t435f7da7b3527423757861419904233d"."gsis_id" = "player"."gsisid" group by t435f7da7b3527423757861419904233d.rate_type_total_count, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })
})
