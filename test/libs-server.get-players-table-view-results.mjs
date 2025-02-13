/* global describe it before */

import * as chai from 'chai'
import MockDate from 'mockdate'
import debug from 'debug'

import { get_data_view_results_query } from '#libs-server'
import { constants, bookmaker_constants } from '#libs-shared'
import { compare_queries } from './utils/index.mjs'

const { expect } = chai

const one_week = 1000 * 60 * 60 * 24 * 7
const twelve_hours = 43200000
const six_hours = 21600000
const one_hour = 3600000

const all_years = Array.from(
  { length: constants.season.year - 1999 },
  (_, i) => i + 2000
)

describe('LIBS SERVER get_data_view_results', () => {
  before(() => {
    MockDate.reset()
    debug.enable('data-views')
  })

  it('should return a query', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      limit: 1000
    })
    const expected_query =
      'select "player"."pid", "player"."pos" from "player" group by "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by "player"."pid" asc limit 1000'
    expect(query.toString()).to.equal(expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(one_week)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('should handle player_target_share_from_plays', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      prefix_columns: ['player_name'],
      columns: [
        {
          column_id: 'player_target_share_from_plays',
          params: {
            year: [2023]
          }
        }
      ],
      where: [
        {
          column_id: 'player_target_share_from_plays',
          operator: '>=',
          value: 25,
          params: {
            year: [2023]
          }
        }
      ],
      sort: [
        {
          column_id: 'player_target_share_from_plays',
          desc: true
        }
      ]
    })
    const expected_query = `with "t7ce618d9efd1bad910446e01527397b9" as (select "pg"."pid", ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / NULLIF(SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END), 0), 2) as trg_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and ("trg_pid" is not null) and "nfl_plays"."year" in (2023) and "nfl_plays"."seas_type" in ('REG') group by "pg"."pid" having ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / NULLIF(SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END), 0), 2) >= '25') select "player"."pid", "t7ce618d9efd1bad910446e01527397b9"."trg_share_from_plays" AS "trg_share_from_plays_0", player.fname, player.lname, "player"."pos" from "player" inner join "t7ce618d9efd1bad910446e01527397b9" on "t7ce618d9efd1bad910446e01527397b9"."pid" = "player"."pid" group by "t7ce618d9efd1bad910446e01527397b9"."trg_share_from_plays", player.fname, player.lname, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(one_week)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('should handle player_target_share_from_plays — duplicates', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      prefix_columns: ['player_name'],
      columns: [
        {
          column_id: 'player_target_share_from_plays',
          params: {
            year: [2023]
          }
        },
        {
          column_id: 'player_target_share_from_plays',
          params: {
            year: [2023]
          }
        }
      ],
      where: [
        {
          column_id: 'player_target_share_from_plays',
          operator: '>=',
          value: 25,
          params: {
            year: [2023]
          }
        },
        {
          column_id: 'player_target_share_from_plays',
          operator: '>=',
          value: 25,
          params: {
            year: [2023]
          }
        }
      ],
      sort: [
        {
          column_id: 'player_target_share_from_plays',
          desc: true
        }
      ]
    })
    const expected_query = `with "t7ce618d9efd1bad910446e01527397b9" as (select "pg"."pid", ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / NULLIF(SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END), 0), 2) as trg_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and ("trg_pid" is not null) and "nfl_plays"."year" in (2023) and "nfl_plays"."seas_type" in ('REG') group by "pg"."pid" having ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / NULLIF(SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END), 0), 2) >= '25') select "player"."pid", "t7ce618d9efd1bad910446e01527397b9"."trg_share_from_plays" AS "trg_share_from_plays_0", "t7ce618d9efd1bad910446e01527397b9"."trg_share_from_plays" AS "trg_share_from_plays_1", player.fname, player.lname, "player"."pos" from "player" inner join "t7ce618d9efd1bad910446e01527397b9" on "t7ce618d9efd1bad910446e01527397b9"."pid" = "player"."pid" group by "t7ce618d9efd1bad910446e01527397b9"."trg_share_from_plays", "t7ce618d9efd1bad910446e01527397b9"."trg_share_from_plays", player.fname, player.lname, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(one_week)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('should handle player_target_share_from_plays - different params', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      prefix_columns: ['player_name'],
      columns: [
        {
          column_id: 'player_target_share_from_plays',
          params: {
            year: [2023]
          }
        },
        {
          column_id: 'player_target_share_from_plays',
          params: {
            year: [2022],
            week: [1, 2, 3]
          }
        }
      ],
      where: [
        {
          column_id: 'player_target_share_from_plays',
          operator: '>=',
          value: 25,
          params: {
            year: [2023]
          }
        }
      ],
      sort: [
        {
          column_id: 'player_target_share_from_plays',
          desc: true
        }
      ]
    })
    const expected_query = `with "t57303c049413002b904f2ae5f68271e8" as (select "pg"."pid", ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / NULLIF(SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END), 0), 2) as trg_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and ("trg_pid" is not null) and "nfl_plays"."year" in (2023) and "nfl_plays"."seas_type" in ('REG') group by "pg"."pid" having ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / NULLIF(SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END), 0), 2) >= '25'), "t1b8e51c9b1d91a5e7e8f67bdd12b3513" as (select "pg"."pid", ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / NULLIF(SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END), 0), 2) as trg_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and ("trg_pid" is not null) and "nfl_plays"."year" in (2022) and "nfl_plays"."week" in (1, 2, 3) and "nfl_plays"."seas_type" in ('REG') group by "pg"."pid") select "player"."pid", "t57303c049413002b904f2ae5f68271e8"."trg_share_from_plays" AS "trg_share_from_plays_0", player.fname, player.lname, "t1b8e51c9b1d91a5e7e8f67bdd12b3513"."trg_share_from_plays" AS "trg_share_from_plays_1", "player"."pos" from "player" inner join "t57303c049413002b904f2ae5f68271e8" on "t57303c049413002b904f2ae5f68271e8"."pid" = "player"."pid" left join "t1b8e51c9b1d91a5e7e8f67bdd12b3513" on "t1b8e51c9b1d91a5e7e8f67bdd12b3513"."pid" = "player"."pid" group by "t57303c049413002b904f2ae5f68271e8"."trg_share_from_plays", player.fname, player.lname, "t1b8e51c9b1d91a5e7e8f67bdd12b3513"."trg_share_from_plays", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(one_week)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('should handle player_air_yards_share_from_plays', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      prefix_columns: ['player_name'],
      columns: [
        {
          column_id: 'player_air_yards_share_from_plays',
          params: {
            year: [2023]
          }
        }
      ],
      where: [
        {
          column_id: 'player_air_yards_share_from_plays',
          operator: '>=',
          value: 25,
          params: {
            year: [2023]
          }
        }
      ],
      sort: [
        {
          column_id: 'player_air_yards_share_from_plays',
          desc: true
        }
      ]
    })
    const expected_query = `with "ta221528ca1830dbe89790d290a767c71" as (select "pg"."pid", CASE WHEN SUM(nfl_plays.dot) > 0 THEN ROUND(100.0 * SUM(CASE WHEN nfl_plays.trg_pid = pg.pid THEN nfl_plays.dot ELSE 0 END) / NULLIF(SUM(nfl_plays.dot), 0), 2) ELSE 0 END as air_yds_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and ("trg_pid" is not null) and "nfl_plays"."year" in (2023) and "nfl_plays"."seas_type" in ('REG') group by "pg"."pid" having CASE WHEN SUM(nfl_plays.dot) > 0 THEN ROUND(100.0 * SUM(CASE WHEN nfl_plays.trg_pid = pg.pid THEN nfl_plays.dot ELSE 0 END) / NULLIF(SUM(nfl_plays.dot), 0), 2) ELSE 0 END >= '25') select "player"."pid", "ta221528ca1830dbe89790d290a767c71"."air_yds_share_from_plays" AS "air_yds_share_from_plays_0", player.fname, player.lname, "player"."pos" from "player" inner join "ta221528ca1830dbe89790d290a767c71" on "ta221528ca1830dbe89790d290a767c71"."pid" = "player"."pid" group by "ta221528ca1830dbe89790d290a767c71"."air_yds_share_from_plays", player.fname, player.lname, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(one_week)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('should handle player_target_share_from_plays with a where clause', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      prefix_columns: ['player_name'],
      columns: [
        {
          column_id: 'player_target_share_from_plays',
          params: {
            year: [2023],
            dwn: [3]
          }
        },
        {
          column_id: 'player_targets_from_plays',
          params: {
            year: [2023],
            dwn: [3]
          }
        },
        {
          column_id: 'player_target_share_from_plays',
          params: {
            year: [2023],
            qtr: [1, 2]
          }
        }
      ],
      where: [
        {
          column_id: 'player_targets_from_plays',
          operator: '>=',
          value: '15',
          params: {
            year: [2023],
            dwn: [3]
          }
        }
      ],
      sort: [
        {
          column_id: 'player_target_share_from_plays',
          desc: true
        }
      ]
    })
    const expected_query = `with "tce165951cc2bb309a474cf53c2ca4302" as (select COALESCE(trg_pid) as pid, SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END) as trg_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."year" in (2023) and "nfl_plays"."seas_type" in ('REG') and "nfl_plays"."dwn" in (3) group by COALESCE(trg_pid) having SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END) >= '15'), "t2d03060ec3dd48c51d3e682caa8a1c01" as (select "pg"."pid", ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / NULLIF(SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END), 0), 2) as trg_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and ("trg_pid" is not null) and "nfl_plays"."year" in (2023) and "nfl_plays"."seas_type" in ('REG') and "nfl_plays"."dwn" in (3) group by "pg"."pid"), "tfa2af921cb48b3703f4c6b825f8c5251" as (select "pg"."pid", ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / NULLIF(SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END), 0), 2) as trg_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and ("trg_pid" is not null) and "nfl_plays"."year" in (2023) and "nfl_plays"."seas_type" in ('REG') and "nfl_plays"."qtr" in (1, 2) group by "pg"."pid") select "player"."pid", "tce165951cc2bb309a474cf53c2ca4302"."trg_from_plays" AS "trg_from_plays_0", player.fname, player.lname, "t2d03060ec3dd48c51d3e682caa8a1c01"."trg_share_from_plays" AS "trg_share_from_plays_0", "tfa2af921cb48b3703f4c6b825f8c5251"."trg_share_from_plays" AS "trg_share_from_plays_1", "player"."pos" from "player" inner join "tce165951cc2bb309a474cf53c2ca4302" on "tce165951cc2bb309a474cf53c2ca4302"."pid" = "player"."pid" left join "t2d03060ec3dd48c51d3e682caa8a1c01" on "t2d03060ec3dd48c51d3e682caa8a1c01"."pid" = "player"."pid" left join "tfa2af921cb48b3703f4c6b825f8c5251" on "tfa2af921cb48b3703f4c6b825f8c5251"."pid" = "player"."pid" group by "tce165951cc2bb309a474cf53c2ca4302"."trg_from_plays", player.fname, player.lname, "t2d03060ec3dd48c51d3e682caa8a1c01"."trg_share_from_plays", "tfa2af921cb48b3703f4c6b825f8c5251"."trg_share_from_plays", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 5 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(one_week)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('should create a split query — year', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      splits: ['year'],
      prefix_columns: ['player_name'],
      columns: [
        {
          column_id: 'player_rush_yards_from_plays',
          params: { year: [2020, 2021, 2022, 2023] }
        }
      ],
      sort: [
        {
          column_id: 'player_rush_yards_from_plays',
          desc: true
        }
      ]
    })
    const expected_query = `with "base_years" as (SELECT unnest(ARRAY[2020,2021,2022,2023]) as year), "player_years" as (SELECT DISTINCT player.pid, base_years.year FROM player CROSS JOIN base_years), "t75ffb93b4d49b2fdda73e643ce2c32ed" as (select COALESCE(bc_pid) as pid, "nfl_plays"."year", SUM(rush_yds) as rush_yds_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."year" in (2020, 2021, 2022, 2023) and "nfl_plays"."seas_type" in ('REG') group by "nfl_plays"."year", COALESCE(bc_pid)) select "player"."pid", player.fname, player.lname, "t75ffb93b4d49b2fdda73e643ce2c32ed"."rush_yds_from_plays" AS "rush_yds_from_plays_0", "player_years"."year", "player"."pos" from "player_years" inner join "player" on "player"."pid" = "player_years"."pid" left join "t75ffb93b4d49b2fdda73e643ce2c32ed" on "t75ffb93b4d49b2fdda73e643ce2c32ed"."pid" = "player"."pid" and t75ffb93b4d49b2fdda73e643ce2c32ed.year = player_years.year and t75ffb93b4d49b2fdda73e643ce2c32ed.year IN (2020,2021,2022,2023) group by player.fname, player.lname, "t75ffb93b4d49b2fdda73e643ce2c32ed"."rush_yds_from_plays", "player_years"."year", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 4 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(one_week)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('should create a splits query — year', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      splits: ['year'],
      prefix_columns: ['player_name'],
      columns: [
        {
          column_id: 'player_rush_yards_from_plays',
          params: { year: [2020, 2021, 2022, 2023] }
        },
        {
          column_id: 'player_rush_yds_per_attempt_from_plays',
          params: {
            year: [2023],
            xpass_prob: [0, 0.4]
          }
        },
        {
          column_id: 'player_rush_yards_from_plays',
          params: { dwn: [1, 2], year: [2020, 2021, 2022, 2023] }
        }
      ],
      sort: [
        {
          column_id: 'player_rush_yards_from_plays',
          desc: true
        }
      ]
    })
    const expected_query = `with "base_years" as (SELECT unnest(ARRAY[2020,2021,2022,2023]) as year), "player_years" as (SELECT DISTINCT player.pid, base_years.year FROM player CROSS JOIN base_years), "t223afe0ce18594c3ea3afe8fc9c21a14" as (select COALESCE(bc_pid) as pid, "nfl_plays"."year", SUM(rush_yds) as rush_yds_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."year" in (2020, 2021, 2022, 2023) and "nfl_plays"."seas_type" in ('REG') group by "nfl_plays"."year", COALESCE(bc_pid)), "t38e1566ffcb5a0235069f0001ffaaca3" as (select COALESCE(bc_pid) as pid, "nfl_plays"."year", CASE WHEN SUM(CASE WHEN bc_pid IS NOT NULL THEN 1 ELSE 0 END) > 0 THEN CAST(ROUND(SUM(rush_yds)::decimal / SUM(CASE WHEN bc_pid IS NOT NULL THEN 1 ELSE 0 END), 2) AS decimal) ELSE 0 END as rush_yds_per_att_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."year" in (2023) and "nfl_plays"."seas_type" in ('REG') and "nfl_plays"."xpass_prob" between 0 and 0.4 group by "nfl_plays"."year", COALESCE(bc_pid)), "tdab3b3458f616d53451b7db79ebbd7c9" as (select COALESCE(bc_pid) as pid, "nfl_plays"."year", SUM(rush_yds) as rush_yds_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."year" in (2020, 2021, 2022, 2023) and "nfl_plays"."seas_type" in ('REG') and "nfl_plays"."dwn" in (1, 2) group by "nfl_plays"."year", COALESCE(bc_pid)) select "player"."pid", player.fname, player.lname, "t223afe0ce18594c3ea3afe8fc9c21a14"."rush_yds_from_plays" AS "rush_yds_from_plays_0", "t38e1566ffcb5a0235069f0001ffaaca3"."rush_yds_per_att_from_plays" AS "rush_yds_per_att_from_plays_0", "tdab3b3458f616d53451b7db79ebbd7c9"."rush_yds_from_plays" AS "rush_yds_from_plays_1", "player_years"."year", "player"."pos" from "player_years" inner join "player" on "player"."pid" = "player_years"."pid" left join "t223afe0ce18594c3ea3afe8fc9c21a14" on "t223afe0ce18594c3ea3afe8fc9c21a14"."pid" = "player"."pid" and t223afe0ce18594c3ea3afe8fc9c21a14.year = player_years.year and t223afe0ce18594c3ea3afe8fc9c21a14.year IN (2020,2021,2022,2023) left join "t38e1566ffcb5a0235069f0001ffaaca3" on "t38e1566ffcb5a0235069f0001ffaaca3"."pid" = "player"."pid" and "t38e1566ffcb5a0235069f0001ffaaca3"."year" = 2023 left join "tdab3b3458f616d53451b7db79ebbd7c9" on "tdab3b3458f616d53451b7db79ebbd7c9"."pid" = "player"."pid" and tdab3b3458f616d53451b7db79ebbd7c9.year = player_years.year and tdab3b3458f616d53451b7db79ebbd7c9.year IN (2020,2021,2022,2023) group by player.fname, player.lname, "t223afe0ce18594c3ea3afe8fc9c21a14"."rush_yds_from_plays", "t38e1566ffcb5a0235069f0001ffaaca3"."rush_yds_per_att_from_plays", "tdab3b3458f616d53451b7db79ebbd7c9"."rush_yds_from_plays", "player_years"."year", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 4 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(one_week)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('should create a splits query - year', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      columns: [
        {
          column_id: 'player_weighted_opportunity_rating_from_plays',
          params: {
            year: [2023, 2022],
            xpass_prob: [0.7, 1]
          }
        },
        {
          column_id: 'player_targets_from_plays',
          params: {
            xpass_prob: [0.7, 1],
            year: [2023, 2022]
          }
        }
      ],
      sort: [
        {
          column_id: 'player_weighted_opportunity_rating_from_plays',
          desc: true
        }
      ],
      where: [
        {
          column_id: 'player_position',
          operator: 'IN',
          value: ['WR']
        }
      ],
      prefix_columns: ['player_name'],
      splits: ['year']
    })
    const expected_query = `with "base_years" as (SELECT unnest(ARRAY[2022,2023]) as year), "player_years" as (SELECT DISTINCT player.pid, base_years.year FROM player CROSS JOIN base_years), "t8e05d4febe24bd8927dfb10e8782efaf" as (select "pg"."pid", ROUND((1.5 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / NULLIF(SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END), 0)) + (0.7 * SUM(CASE WHEN nfl_plays.trg_pid = pg.pid THEN nfl_plays.dot ELSE 0 END) / NULLIF(SUM(nfl_plays.dot), 0)), 4) as weighted_opp_rating_from_plays, "nfl_plays"."year" from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and ("trg_pid" is not null) and "nfl_plays"."year" in (2022, 2023) and "nfl_plays"."seas_type" in ('REG') and "nfl_plays"."xpass_prob" between 0.7 and 1 group by "pg"."pid", "nfl_plays"."year"), "t1dda92c6670892ed848f8fcd4e1ddb4c" as (select COALESCE(trg_pid) as pid, "nfl_plays"."year", SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END) as trg_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."year" in (2022, 2023) and "nfl_plays"."seas_type" in ('REG') and "nfl_plays"."xpass_prob" between 0.7 and 1 group by "nfl_plays"."year", COALESCE(trg_pid)) select "player"."pid", player.fname, player.lname, "t8e05d4febe24bd8927dfb10e8782efaf"."weighted_opp_rating_from_plays" AS "weighted_opp_rating_from_plays_0", "t1dda92c6670892ed848f8fcd4e1ddb4c"."trg_from_plays" AS "trg_from_plays_0", "player_years"."year", "player"."pos" from "player_years" inner join "player" on "player"."pid" = "player_years"."pid" left join "t8e05d4febe24bd8927dfb10e8782efaf" on "t8e05d4febe24bd8927dfb10e8782efaf"."pid" = "player"."pid" and t8e05d4febe24bd8927dfb10e8782efaf.year = player_years.year and t8e05d4febe24bd8927dfb10e8782efaf.year IN (2022,2023) left join "t1dda92c6670892ed848f8fcd4e1ddb4c" on "t1dda92c6670892ed848f8fcd4e1ddb4c"."pid" = "player"."pid" and t1dda92c6670892ed848f8fcd4e1ddb4c.year = player_years.year and t1dda92c6670892ed848f8fcd4e1ddb4c.year IN (2022,2023) where player.pos IN ('WR') group by player.fname, player.lname, "t8e05d4febe24bd8927dfb10e8782efaf"."weighted_opp_rating_from_plays", "t1dda92c6670892ed848f8fcd4e1ddb4c"."trg_from_plays", "player_years"."year", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 4 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(one_week)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('should create a splits query with espn open scores', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      splits: ['year'],
      prefix_columns: ['player_name'],
      columns: [
        {
          column_id: 'player_espn_open_score'
        },
        {
          column_id: 'player_weighted_opportunity_rating_from_plays'
        }
      ],
      sort: [
        {
          column_id: 'player_espn_open_score',
          desc: true
        }
      ]
    })
    const expected_query = `with "base_years" as (SELECT unnest(ARRAY[${all_years}]) as year), "player_years" as (SELECT DISTINCT player.pid, base_years.year FROM player CROSS JOIN base_years), "t0d31bb13a5dc7fd801599711a85716b8" as (select "pg"."pid", ROUND((1.5 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / NULLIF(SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END), 0)) + (0.7 * SUM(CASE WHEN nfl_plays.trg_pid = pg.pid THEN nfl_plays.dot ELSE 0 END) / NULLIF(SUM(nfl_plays.dot), 0)), 4) as weighted_opp_rating_from_plays, "nfl_plays"."year" from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and ("trg_pid" is not null) and "nfl_plays"."seas_type" in ('REG') group by "pg"."pid", "nfl_plays"."year") select "player"."pid", player.fname, player.lname, "player_seasonlogs"."espn_open_score" AS "espn_open_score_0", "t0d31bb13a5dc7fd801599711a85716b8"."weighted_opp_rating_from_plays" AS "weighted_opp_rating_from_plays_0", "player_years"."year", "player"."pos" from "player_years" inner join "player" on "player"."pid" = "player_years"."pid" left join "player_seasonlogs" on "player_seasonlogs"."pid" = "player"."pid" and player_seasonlogs.year = player_years.year and "player_seasonlogs"."seas_type" = 'REG' left join "t0d31bb13a5dc7fd801599711a85716b8" on "t0d31bb13a5dc7fd801599711a85716b8"."pid" = "player"."pid" and t0d31bb13a5dc7fd801599711a85716b8.year = player_years.year group by player.fname, player.lname, "player_seasonlogs"."espn_open_score", "t0d31bb13a5dc7fd801599711a85716b8"."weighted_opp_rating_from_plays", "player_years"."year", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 4 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(six_hours)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('should create a query with fantasy points from seasonlogs', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      prefix_columns: ['player_name'],
      columns: [
        {
          column_id: 'player_fantasy_points_from_seasonlogs',
          params: {
            year: 2022
          }
        },
        {
          column_id: 'player_fantasy_points_per_game_from_seasonlogs',
          params: {
            year: 2022
          }
        },
        {
          column_id: 'player_fantasy_points_rank_from_seasonlogs',
          params: {
            year: 2022
          }
        },
        {
          column_id: 'player_fantasy_points_position_rank_from_seasonlogs',
          params: {
            year: 2022
          }
        }
      ],
      sort: [
        {
          column_id: 'player_fantasy_points_from_seasonlogs',
          desc: true
        }
      ]
    })
    const expected_query = `select "player"."pid", player.fname, player.lname, "t2dc419c5ac00a6f3a1433df75f943988"."points" AS "points_from_seasonlogs_0", "t2dc419c5ac00a6f3a1433df75f943988"."points_per_game" AS "points_per_game_from_seasonlogs_0", "t2dc419c5ac00a6f3a1433df75f943988"."points_rnk" AS "points_rnk_from_seasonlogs_0", "t2dc419c5ac00a6f3a1433df75f943988"."points_pos_rnk" AS "points_pos_rnk_from_seasonlogs_0", "player"."pos" from "player" left join "scoring_format_player_seasonlogs" as "t2dc419c5ac00a6f3a1433df75f943988" on "t2dc419c5ac00a6f3a1433df75f943988"."pid" = "player"."pid" and "t2dc419c5ac00a6f3a1433df75f943988"."year" = 2022 and t2dc419c5ac00a6f3a1433df75f943988.scoring_format_hash = '0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d' group by player.fname, player.lname, "t2dc419c5ac00a6f3a1433df75f943988"."points", "t2dc419c5ac00a6f3a1433df75f943988"."points_per_game", "t2dc419c5ac00a6f3a1433df75f943988"."points_rnk", "t2dc419c5ac00a6f3a1433df75f943988"."points_pos_rnk", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 4 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(one_week)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('should create a query with fantasy points from careerlogs', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      prefix_columns: ['player_name'],
      columns: [
        'player_fantasy_points_from_careerlogs',
        'player_fantasy_points_per_game_from_careerlogs',
        'player_fantasy_top_3_seasons_from_careerlogs',
        'player_fantasy_top_6_seasons_from_careerlogs',
        'player_fantasy_top_12_seasons_from_careerlogs',
        'player_fantasy_top_24_seasons_from_careerlogs',
        'player_fantasy_top_36_seasons_from_careerlogs'
      ],
      sort: [
        {
          column_id: 'player_fantasy_points_from_careerlogs',
          desc: true
        }
      ]
    })
    const expected_query = `select "player"."pid", player.fname, player.lname, "t0984699909800a4c1372fbe19abf07af"."points" AS "points_from_careerlogs_0", "t0984699909800a4c1372fbe19abf07af"."points_per_game" AS "points_per_game_from_careerlogs_0", "t0984699909800a4c1372fbe19abf07af"."top_3" AS "top_3_from_careerlogs_0", "t0984699909800a4c1372fbe19abf07af"."top_6" AS "top_6_from_careerlogs_0", "t0984699909800a4c1372fbe19abf07af"."top_12" AS "top_12_from_careerlogs_0", "t0984699909800a4c1372fbe19abf07af"."top_24" AS "top_24_from_careerlogs_0", "t0984699909800a4c1372fbe19abf07af"."top_36" AS "top_36_from_careerlogs_0", "player"."pos" from "player" left join "scoring_format_player_careerlogs" as "t0984699909800a4c1372fbe19abf07af" on "t0984699909800a4c1372fbe19abf07af"."pid" = "player"."pid" and t0984699909800a4c1372fbe19abf07af.scoring_format_hash = '0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d' group by player.fname, player.lname, "t0984699909800a4c1372fbe19abf07af"."points", "t0984699909800a4c1372fbe19abf07af"."points_per_game", "t0984699909800a4c1372fbe19abf07af"."top_3", "t0984699909800a4c1372fbe19abf07af"."top_6", "t0984699909800a4c1372fbe19abf07af"."top_12", "t0984699909800a4c1372fbe19abf07af"."top_24", "t0984699909800a4c1372fbe19abf07af"."top_36", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 4 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(six_hours)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('should create a query with fields from league format seasonlogs and careerlogs', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      prefix_columns: ['player_name'],
      columns: [
        'player_startable_games_from_seasonlogs',
        'player_points_added_from_seasonlogs',
        'player_points_added_per_game_from_seasonlogs',
        'player_points_added_rank_from_seasonlogs',
        'player_points_added_position_rank_from_seasonlogs',
        'player_startable_games_from_careerlogs',
        'player_points_added_from_careerlogs',
        'player_points_added_per_game_from_careerlogs',
        'player_best_season_points_added_per_game_from_careerlogs',
        'player_points_added_first_three_seasons_from_careerlogs',
        'player_points_added_first_four_seasons_from_careerlogs',
        'player_points_added_first_five_seasons_from_careerlogs',
        'player_points_added_first_season_from_careerlogs',
        'player_points_added_second_season_from_careerlogs',
        'player_points_added_third_season_from_careerlogs',
        'player_draft_rank_from_careerlogs'
      ],
      sort: [
        {
          column_id: 'player_points_added_per_game_from_careerlogs',
          desc: true
        }
      ]
    })
    const expected_query = `select "player"."pid", player.fname, player.lname, "tbf494cbb4bcb89adaa6d672c8bfb17c2"."startable_games" AS "startable_games_from_seasonlogs_0", "tbf494cbb4bcb89adaa6d672c8bfb17c2"."points_added" AS "points_added_from_seasonlogs_0", "tbf494cbb4bcb89adaa6d672c8bfb17c2"."points_added_per_game" AS "points_added_per_game_from_seasonlogs_0", "tbf494cbb4bcb89adaa6d672c8bfb17c2"."points_added_rnk" AS "points_added_rnk_from_seasonlogs_0", "tbf494cbb4bcb89adaa6d672c8bfb17c2"."points_added_pos_rnk" AS "points_added_pos_rnk_from_seasonlogs_0", "t2c88ab25d4acbc66daf6137b64987326"."startable_games" AS "startable_games_from_careerlogs_0", "t2c88ab25d4acbc66daf6137b64987326"."points_added" AS "points_added_from_careerlogs_0", "t2c88ab25d4acbc66daf6137b64987326"."points_added_per_game" AS "points_added_per_game_from_careerlogs_0", "t2c88ab25d4acbc66daf6137b64987326"."best_season_points_added_per_game" AS "best_season_points_added_per_game_from_careerlogs_0", "t2c88ab25d4acbc66daf6137b64987326"."points_added_first_three_seas" AS "points_added_first_three_seas_from_careerlogs_0", "t2c88ab25d4acbc66daf6137b64987326"."points_added_first_four_seas" AS "points_added_first_four_seas_from_careerlogs_0", "t2c88ab25d4acbc66daf6137b64987326"."points_added_first_five_seas" AS "points_added_first_five_seas_from_careerlogs_0", "t2c88ab25d4acbc66daf6137b64987326"."points_added_first_seas" AS "points_added_first_seas_from_careerlogs_0", "t2c88ab25d4acbc66daf6137b64987326"."points_added_second_seas" AS "points_added_second_seas_from_careerlogs_0", "t2c88ab25d4acbc66daf6137b64987326"."points_added_third_seas" AS "points_added_third_seas_from_careerlogs_0", "t2c88ab25d4acbc66daf6137b64987326"."draft_rank" AS "draft_rank_from_careerlogs_0", "player"."pos" from "player" left join "league_format_player_seasonlogs" as "tbf494cbb4bcb89adaa6d672c8bfb17c2" on "tbf494cbb4bcb89adaa6d672c8bfb17c2"."pid" = "player"."pid" and tbf494cbb4bcb89adaa6d672c8bfb17c2.league_format_hash = '1985e1968b75707ebcab9da620176a0b218c5c1bd28d00cbbc4d1744a1631d0b' and tbf494cbb4bcb89adaa6d672c8bfb17c2.year IN (${constants.season.stats_season_year}) left join "league_format_player_careerlogs" as "t2c88ab25d4acbc66daf6137b64987326" on "t2c88ab25d4acbc66daf6137b64987326"."pid" = "player"."pid" and t2c88ab25d4acbc66daf6137b64987326.league_format_hash = '1985e1968b75707ebcab9da620176a0b218c5c1bd28d00cbbc4d1744a1631d0b' group by player.fname, player.lname, "tbf494cbb4bcb89adaa6d672c8bfb17c2"."startable_games", "tbf494cbb4bcb89adaa6d672c8bfb17c2"."points_added", "tbf494cbb4bcb89adaa6d672c8bfb17c2"."points_added_per_game", "tbf494cbb4bcb89adaa6d672c8bfb17c2"."points_added_rnk", "tbf494cbb4bcb89adaa6d672c8bfb17c2"."points_added_pos_rnk", "t2c88ab25d4acbc66daf6137b64987326"."startable_games", "t2c88ab25d4acbc66daf6137b64987326"."points_added", "t2c88ab25d4acbc66daf6137b64987326"."points_added_per_game", "t2c88ab25d4acbc66daf6137b64987326"."best_season_points_added_per_game", "t2c88ab25d4acbc66daf6137b64987326"."points_added_first_three_seas", "t2c88ab25d4acbc66daf6137b64987326"."points_added_first_four_seas", "t2c88ab25d4acbc66daf6137b64987326"."points_added_first_five_seas", "t2c88ab25d4acbc66daf6137b64987326"."points_added_first_seas", "t2c88ab25d4acbc66daf6137b64987326"."points_added_second_seas", "t2c88ab25d4acbc66daf6137b64987326"."points_added_third_seas", "t2c88ab25d4acbc66daf6137b64987326"."draft_rank", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 11 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(six_hours)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('should create a query with fields from season prop betting markets', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      prefix_columns: ['player_name'],
      columns: [
        {
          column_id: 'player_season_prop_line_from_betting_markets',
          params: {
            market_type:
              bookmaker_constants.player_prop_types.SEASON_PASSING_YARDS
          }
        },
        {
          column_id: 'player_season_prop_line_from_betting_markets',
          params: {
            market_type:
              bookmaker_constants.player_prop_types.SEASON_RECEIVING_YARDS
          }
        },
        {
          column_id: 'player_season_prop_line_from_betting_markets',
          params: {
            market_type:
              bookmaker_constants.player_prop_types.SEASON_RUSHING_YARDS
          }
        }
      ],
      sort: [
        {
          column_id: 'player_season_prop_line_from_betting_markets',
          column_index: 1,
          desc: true
        }
      ]
    })
    const expected_query = `with "t121851529271591f730857d3e4f98b84_markets" as (select "source_id", "source_market_id", "time_type" from "prop_markets_index" where "market_type" = 'SEASON_PASSING_YARDS' and "time_type" = 'CLOSE' and "prop_markets_index"."year" = ${constants.season.year} and "source_id" = 'FANDUEL'), "t121851529271591f730857d3e4f98b84" as (select pms.selection_pid, pms.selection_metric_line from "t121851529271591f730857d3e4f98b84_markets" as "m" inner join "prop_market_selections_index" as "pms" on "pms"."source_id" = "m"."source_id" and "pms"."source_market_id" = "m"."source_market_id" and "pms"."time_type" = "m"."time_type"), "tf57b566bd3a7d4a2bab2e0fb0601b9dd_markets" as (select "source_id", "source_market_id", "time_type" from "prop_markets_index" where "market_type" = 'SEASON_RECEIVING_YARDS' and "time_type" = 'CLOSE' and "prop_markets_index"."year" = ${constants.season.year} and "source_id" = 'FANDUEL'), "tf57b566bd3a7d4a2bab2e0fb0601b9dd" as (select pms.selection_pid, pms.selection_metric_line from "tf57b566bd3a7d4a2bab2e0fb0601b9dd_markets" as "m" inner join "prop_market_selections_index" as "pms" on "pms"."source_id" = "m"."source_id" and "pms"."source_market_id" = "m"."source_market_id" and "pms"."time_type" = "m"."time_type"), "t00ce719a66cf482d3504d1591e7c68a2_markets" as (select "source_id", "source_market_id", "time_type" from "prop_markets_index" where "market_type" = 'SEASON_RUSHING_YARDS' and "time_type" = 'CLOSE' and "prop_markets_index"."year" = ${constants.season.year} and "source_id" = 'FANDUEL'), "t00ce719a66cf482d3504d1591e7c68a2" as (select pms.selection_pid, pms.selection_metric_line from "t00ce719a66cf482d3504d1591e7c68a2_markets" as "m" inner join "prop_market_selections_index" as "pms" on "pms"."source_id" = "m"."source_id" and "pms"."source_market_id" = "m"."source_market_id" and "pms"."time_type" = "m"."time_type") select "player"."pid", player.fname, player.lname, "t121851529271591f730857d3e4f98b84"."selection_metric_line" AS "season_prop_line_betting_market_0", "tf57b566bd3a7d4a2bab2e0fb0601b9dd"."selection_metric_line" AS "season_prop_line_betting_market_1", "t00ce719a66cf482d3504d1591e7c68a2"."selection_metric_line" AS "season_prop_line_betting_market_2", "player"."pos" from "player" left join "t121851529271591f730857d3e4f98b84" on "t121851529271591f730857d3e4f98b84"."selection_pid" = "player"."pid" left join "tf57b566bd3a7d4a2bab2e0fb0601b9dd" on "tf57b566bd3a7d4a2bab2e0fb0601b9dd"."selection_pid" = "player"."pid" left join "t00ce719a66cf482d3504d1591e7c68a2" on "t00ce719a66cf482d3504d1591e7c68a2"."selection_pid" = "player"."pid" group by player.fname, player.lname, "t121851529271591f730857d3e4f98b84"."selection_metric_line", "tf57b566bd3a7d4a2bab2e0fb0601b9dd"."selection_metric_line", "t00ce719a66cf482d3504d1591e7c68a2"."selection_metric_line", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 5 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(one_hour)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('should create a query with field from player game prop betting markets', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      prefix_columns: ['player_name'],
      columns: [
        {
          column_id: 'player_game_prop_line_from_betting_markets',
          params: {
            market_type:
              bookmaker_constants.player_prop_types.GAME_PASSING_YARDS,
            year: 2023,
            week: 1,
            seas_type: 'REG'
          }
        }
      ],
      sort: [
        {
          column_id: 'player_game_prop_line_from_betting_markets',
          desc: true
        }
      ]
    })
    const expected_query = `with "t134cedd36b06cf89d1febbcc60149100_markets" as (select "source_id", "source_market_id", "time_type" from "prop_markets_index" inner join "nfl_games" on "nfl_games"."esbid" = "prop_markets_index"."esbid" and "nfl_games"."year" = "prop_markets_index"."year" and "nfl_games"."seas_type" = 'REG' and "nfl_games"."week" = 1 where "market_type" = 'GAME_PASSING_YARDS' and "time_type" = 'CLOSE' and "prop_markets_index"."year" = 2023 and "source_id" = 'FANDUEL'), "t134cedd36b06cf89d1febbcc60149100" as (select pms.selection_pid, pms.selection_metric_line from "t134cedd36b06cf89d1febbcc60149100_markets" as "m" inner join "prop_market_selections_index" as "pms" on "pms"."source_id" = "m"."source_id" and "pms"."source_market_id" = "m"."source_market_id" and "pms"."time_type" = "m"."time_type") select "player"."pid", player.fname, player.lname, "t134cedd36b06cf89d1febbcc60149100"."selection_metric_line" AS "game_prop_line_betting_market_0", "player"."pos" from "player" left join "t134cedd36b06cf89d1febbcc60149100" on "t134cedd36b06cf89d1febbcc60149100"."selection_pid" = "player"."pid" group by player.fname, player.lname, "t134cedd36b06cf89d1febbcc60149100"."selection_metric_line", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 4 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(one_week)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('should create a query showing career gamelogs with a where filter on first game receiving yards', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      prefix_columns: ['player_name'],
      columns: [
        'player_fantasy_top_1_seasons_from_careerlogs',
        'player_fantasy_top_3_seasons_from_careerlogs',
        'player_fantasy_top_6_seasons_from_careerlogs',
        'player_fantasy_top_12_seasons_from_careerlogs',
        'player_fantasy_top_24_games_from_careerlogs',
        'player_fantasy_top_36_games_from_careerlogs'
      ],
      sort: [
        {
          column_id: 'player_fantasy_top_1_seasons_from_careerlogs',
          desc: true
        }
      ],
      where: [
        {
          column_id: 'player_target_share_from_plays',
          operator: '>=',
          value: 15,
          params: {
            career_game: [1, 1]
          }
        }
      ]
    })
    const expected_query = `with "t8556b9a9c4bf250fab85e549eaed8521" as (select "pg"."pid", ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / NULLIF(SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END), 0), 2) as trg_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and ("trg_pid" is not null) and "pg"."career_game" between 1 and 1 and "nfl_plays"."seas_type" in ('REG') group by "pg"."pid" having ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / NULLIF(SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END), 0), 2) >= '15') select "player"."pid", player.fname, player.lname, "t0984699909800a4c1372fbe19abf07af"."top_1" AS "top_1_from_careerlogs_0", "t0984699909800a4c1372fbe19abf07af"."top_3" AS "top_3_from_careerlogs_0", "t0984699909800a4c1372fbe19abf07af"."top_6" AS "top_6_from_careerlogs_0", "t0984699909800a4c1372fbe19abf07af"."top_12" AS "top_12_from_careerlogs_0", "player"."pos" from "player" inner join "t8556b9a9c4bf250fab85e549eaed8521" on "t8556b9a9c4bf250fab85e549eaed8521"."pid" = "player"."pid" left join "scoring_format_player_careerlogs" as "t0984699909800a4c1372fbe19abf07af" on "t0984699909800a4c1372fbe19abf07af"."pid" = "player"."pid" and t0984699909800a4c1372fbe19abf07af.scoring_format_hash = '0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d' group by player.fname, player.lname, "t0984699909800a4c1372fbe19abf07af"."top_1", "t0984699909800a4c1372fbe19abf07af"."top_3", "t0984699909800a4c1372fbe19abf07af"."top_6", "t0984699909800a4c1372fbe19abf07af"."top_12", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 4 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(six_hours)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('should create a query for season projected stats', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      sort: [
        {
          column_id: 'player_season_projected_points_added',
          desc: true
        }
      ],
      prefix_columns: ['player_name', 'player_league_roster_status'],
      columns: [
        'player_season_projected_points_added',
        'player_season_projected_points',
        'player_season_projected_pass_yds',
        'player_season_projected_pass_tds',
        'player_season_projected_pass_ints',
        'player_season_projected_rush_atts',
        'player_season_projected_rush_yds',
        'player_season_projected_rush_tds',
        'player_season_projected_fumbles_lost',
        'player_season_projected_targets',
        'player_season_projected_recs',
        'player_season_projected_rec_yds',
        'player_season_projected_rec_tds'
      ]
    })
    const expected_query = `select "player"."pid", player.fname, player.lname, CASE WHEN rosters_players.slot = 13 THEN 'injured_reserve' WHEN rosters_players.slot = 12 THEN 'practice_squad' WHEN rosters_players.slot IS NULL THEN 'free_agent' ELSE 'active_roster' END AS player_league_roster_status, rosters_players.slot, rosters_players.tid, rosters_players.tag, "t265b999c74514c26d03e1e5bf72bbcca"."pts_added" AS "season_projected_points_added_0", "t07887d1cc826d9aef7d20e96e08343f1"."total" AS "season_projected_points_0", "t6f54c05eac6ba296f8748f9026c2d01f"."py" AS "season_projected_pass_yds_0", "t6f54c05eac6ba296f8748f9026c2d01f"."tdp" AS "season_projected_pass_tds_0", "t6f54c05eac6ba296f8748f9026c2d01f"."ints" AS "season_projected_pass_ints_0", "t6f54c05eac6ba296f8748f9026c2d01f"."ra" AS "season_projected_rush_atts_0", "t6f54c05eac6ba296f8748f9026c2d01f"."ry" AS "season_projected_rush_yds_0", "t6f54c05eac6ba296f8748f9026c2d01f"."tdr" AS "season_projected_rush_tds_0", "t6f54c05eac6ba296f8748f9026c2d01f"."fuml" AS "season_projected_fumbles_lost_0", "t6f54c05eac6ba296f8748f9026c2d01f"."trg" AS "season_projected_targets_0", "t6f54c05eac6ba296f8748f9026c2d01f"."rec" AS "season_projected_recs_0", "t6f54c05eac6ba296f8748f9026c2d01f"."recy" AS "season_projected_rec_yds_0", "t6f54c05eac6ba296f8748f9026c2d01f"."tdrec" AS "season_projected_rec_tds_0", "player"."pos" from "player" left join "rosters_players" on "rosters_players"."pid" = "player"."pid" and "rosters_players"."year" = ${constants.season.year} and "rosters_players"."week" = ${Math.min(constants.season.week, constants.season.finalWeek)} and "rosters_players"."lid" = 1 left join "league_format_player_projection_values" as "t265b999c74514c26d03e1e5bf72bbcca" on "t265b999c74514c26d03e1e5bf72bbcca"."pid" = "player"."pid" and "t265b999c74514c26d03e1e5bf72bbcca"."year" = ${constants.season.year} and "t265b999c74514c26d03e1e5bf72bbcca"."week" = '0' and "t265b999c74514c26d03e1e5bf72bbcca"."league_format_hash" = '1985e1968b75707ebcab9da620176a0b218c5c1bd28d00cbbc4d1744a1631d0b' left join "scoring_format_player_projection_points" as "t07887d1cc826d9aef7d20e96e08343f1" on "t07887d1cc826d9aef7d20e96e08343f1"."pid" = "player"."pid" and "t07887d1cc826d9aef7d20e96e08343f1"."year" = ${constants.season.year} and "t07887d1cc826d9aef7d20e96e08343f1"."week" = '0' and "t07887d1cc826d9aef7d20e96e08343f1"."scoring_format_hash" = '0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d' left join "projections_index" as "t6f54c05eac6ba296f8748f9026c2d01f" on "t6f54c05eac6ba296f8748f9026c2d01f"."pid" = "player"."pid" and "t6f54c05eac6ba296f8748f9026c2d01f"."year" = ${constants.season.year} and "t6f54c05eac6ba296f8748f9026c2d01f"."week" = '0' and "t6f54c05eac6ba296f8748f9026c2d01f"."sourceid" = 18 and "t6f54c05eac6ba296f8748f9026c2d01f"."seas_type" = 'REG' group by player.fname, player.lname, rosters_players.slot, rosters_players.tid, rosters_players.tag, "t265b999c74514c26d03e1e5bf72bbcca"."pts_added", "t07887d1cc826d9aef7d20e96e08343f1"."total", "t6f54c05eac6ba296f8748f9026c2d01f"."py", "t6f54c05eac6ba296f8748f9026c2d01f"."tdp", "t6f54c05eac6ba296f8748f9026c2d01f"."ints", "t6f54c05eac6ba296f8748f9026c2d01f"."ra", "t6f54c05eac6ba296f8748f9026c2d01f"."ry", "t6f54c05eac6ba296f8748f9026c2d01f"."tdr", "t6f54c05eac6ba296f8748f9026c2d01f"."fuml", "t6f54c05eac6ba296f8748f9026c2d01f"."trg", "t6f54c05eac6ba296f8748f9026c2d01f"."rec", "t6f54c05eac6ba296f8748f9026c2d01f"."recy", "t6f54c05eac6ba296f8748f9026c2d01f"."tdrec", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 8 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    const cache_ttl =
      constants.season.nfl_seas_type === 'POST' ? twelve_hours : six_hours
    expect(data_view_metadata.cache_ttl).to.equal(cache_ttl)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('should create a query for season projected stats', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      sort: [
        {
          column_id: 'player_season_projected_points_added',
          desc: true
        }
      ],
      prefix_columns: ['player_name', 'player_league_roster_status'],
      columns: [
        {
          column_id: 'player_season_projected_points_added',
          params: {
            year: [2023]
          }
        },
        {
          column_id: 'player_season_projected_points',
          params: {
            year: [2023]
          }
        },
        {
          column_id: 'player_season_projected_pass_yds',
          params: {
            year: [2023]
          }
        },
        {
          column_id: 'player_season_projected_pass_tds',
          params: {
            year: [2023]
          }
        },
        {
          column_id: 'player_season_projected_pass_ints',
          params: {
            year: [2023]
          }
        },
        {
          column_id: 'player_season_projected_rush_atts',
          params: {
            year: [2023]
          }
        },
        {
          column_id: 'player_season_projected_rush_yds',
          params: {
            year: [2023]
          }
        },
        {
          column_id: 'player_season_projected_rush_tds',
          params: {
            year: [2023]
          }
        },
        {
          column_id: 'player_season_projected_fumbles_lost',
          params: {
            year: [2023]
          }
        },
        {
          column_id: 'player_season_projected_targets',
          params: {
            year: [2023]
          }
        },
        {
          column_id: 'player_season_projected_recs',
          params: {
            year: [2023]
          }
        },
        {
          column_id: 'player_season_projected_rec_yds',
          params: {
            year: [2023]
          }
        },
        {
          column_id: 'player_season_projected_rec_tds',
          params: {
            year: [2023]
          }
        }
      ]
    })
    const expected_query = `select "player"."pid", player.fname, player.lname, CASE WHEN rosters_players.slot = 13 THEN 'injured_reserve' WHEN rosters_players.slot = 12 THEN 'practice_squad' WHEN rosters_players.slot IS NULL THEN 'free_agent' ELSE 'active_roster' END AS player_league_roster_status, rosters_players.slot, rosters_players.tid, rosters_players.tag, "t26d9d9efaab14f81317e0aab19bb619c"."pts_added" AS "season_projected_points_added_0", "t0dfe1f40a872fb6aad6963492077913c"."total" AS "season_projected_points_0", "t06adaa2b44f8b40e476affee9748a3c5"."py" AS "season_projected_pass_yds_0", "t06adaa2b44f8b40e476affee9748a3c5"."tdp" AS "season_projected_pass_tds_0", "t06adaa2b44f8b40e476affee9748a3c5"."ints" AS "season_projected_pass_ints_0", "t06adaa2b44f8b40e476affee9748a3c5"."ra" AS "season_projected_rush_atts_0", "t06adaa2b44f8b40e476affee9748a3c5"."ry" AS "season_projected_rush_yds_0", "t06adaa2b44f8b40e476affee9748a3c5"."tdr" AS "season_projected_rush_tds_0", "t06adaa2b44f8b40e476affee9748a3c5"."fuml" AS "season_projected_fumbles_lost_0", "t06adaa2b44f8b40e476affee9748a3c5"."trg" AS "season_projected_targets_0", "t06adaa2b44f8b40e476affee9748a3c5"."rec" AS "season_projected_recs_0", "t06adaa2b44f8b40e476affee9748a3c5"."recy" AS "season_projected_rec_yds_0", "t06adaa2b44f8b40e476affee9748a3c5"."tdrec" AS "season_projected_rec_tds_0", "player"."pos" from "player" left join "rosters_players" on "rosters_players"."pid" = "player"."pid" and "rosters_players"."year" = ${constants.season.year} and "rosters_players"."week" = ${Math.min(constants.season.week, constants.season.finalWeek)} and "rosters_players"."lid" = 1 left join "league_format_player_projection_values" as "t26d9d9efaab14f81317e0aab19bb619c" on "t26d9d9efaab14f81317e0aab19bb619c"."pid" = "player"."pid" and "t26d9d9efaab14f81317e0aab19bb619c"."year" = 2023 and "t26d9d9efaab14f81317e0aab19bb619c"."week" = '0' and "t26d9d9efaab14f81317e0aab19bb619c"."league_format_hash" = '1985e1968b75707ebcab9da620176a0b218c5c1bd28d00cbbc4d1744a1631d0b' left join "scoring_format_player_projection_points" as "t0dfe1f40a872fb6aad6963492077913c" on "t0dfe1f40a872fb6aad6963492077913c"."pid" = "player"."pid" and "t0dfe1f40a872fb6aad6963492077913c"."year" = 2023 and "t0dfe1f40a872fb6aad6963492077913c"."week" = '0' and "t0dfe1f40a872fb6aad6963492077913c"."scoring_format_hash" = '0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d' left join "projections_index" as "t06adaa2b44f8b40e476affee9748a3c5" on "t06adaa2b44f8b40e476affee9748a3c5"."pid" = "player"."pid" and "t06adaa2b44f8b40e476affee9748a3c5"."year" = 2023 and "t06adaa2b44f8b40e476affee9748a3c5"."week" = '0' and "t06adaa2b44f8b40e476affee9748a3c5"."sourceid" = 18 and "t06adaa2b44f8b40e476affee9748a3c5"."seas_type" = 'REG' group by player.fname, player.lname, rosters_players.slot, rosters_players.tid, rosters_players.tag, "t26d9d9efaab14f81317e0aab19bb619c"."pts_added", "t0dfe1f40a872fb6aad6963492077913c"."total", "t06adaa2b44f8b40e476affee9748a3c5"."py", "t06adaa2b44f8b40e476affee9748a3c5"."tdp", "t06adaa2b44f8b40e476affee9748a3c5"."ints", "t06adaa2b44f8b40e476affee9748a3c5"."ra", "t06adaa2b44f8b40e476affee9748a3c5"."ry", "t06adaa2b44f8b40e476affee9748a3c5"."tdr", "t06adaa2b44f8b40e476affee9748a3c5"."fuml", "t06adaa2b44f8b40e476affee9748a3c5"."trg", "t06adaa2b44f8b40e476affee9748a3c5"."rec", "t06adaa2b44f8b40e476affee9748a3c5"."recy", "t06adaa2b44f8b40e476affee9748a3c5"."tdrec", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 8 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(twelve_hours)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('should create a query for week projected stats', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      sort: [
        {
          column_id: 'player_week_projected_pass_yds',
          desc: true
        }
      ],
      prefix_columns: ['player_name', 'player_league_roster_status'],
      columns: [
        {
          column_id: 'player_week_projected_pass_yds',
          params: {
            year: [2023],
            week: [2]
          }
        }
      ],
      where: []
    })
    const expected_query = `select "player"."pid", player.fname, player.lname, CASE WHEN rosters_players.slot = 13 THEN 'injured_reserve' WHEN rosters_players.slot = 12 THEN 'practice_squad' WHEN rosters_players.slot IS NULL THEN 'free_agent' ELSE 'active_roster' END AS player_league_roster_status, rosters_players.slot, rosters_players.tid, rosters_players.tag, "tdaa3548559fc3de994ece727a3d03fa9"."py" AS "week_projected_pass_yds_0", "player"."pos" from "player" left join "rosters_players" on "rosters_players"."pid" = "player"."pid" and "rosters_players"."year" = ${constants.season.year} and "rosters_players"."week" = ${Math.min(constants.season.week, constants.season.finalWeek)} and "rosters_players"."lid" = 1 left join "projections_index" as "tdaa3548559fc3de994ece727a3d03fa9" on "tdaa3548559fc3de994ece727a3d03fa9"."pid" = "player"."pid" and "tdaa3548559fc3de994ece727a3d03fa9"."year" = 2023 and "tdaa3548559fc3de994ece727a3d03fa9"."week" = '2' and "tdaa3548559fc3de994ece727a3d03fa9"."sourceid" = 18 and "tdaa3548559fc3de994ece727a3d03fa9"."seas_type" = 'REG' group by player.fname, player.lname, rosters_players.slot, rosters_players.tid, rosters_players.tag, "tdaa3548559fc3de994ece727a3d03fa9"."py", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 8 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(twelve_hours)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('should create a query for season projected stats - split', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      columns: [
        {
          column_id: 'player_season_projected_rush_atts',
          params: {
            year: [2023, 2022, 2021, 2020]
          }
        },
        'player_season_projected_rush_yds',
        'player_rush_attempts_from_plays'
      ],
      sort: [
        {
          column_id: 'player_season_projected_rush_atts',
          desc: true
        }
      ],
      where: [
        {
          column_id: 'player_position',
          operator: 'IN',
          value: ['RB']
        }
      ],
      prefix_columns: ['player_name'],
      splits: ['year']
    })
    const expected_query = `with "base_years" as (SELECT unnest(ARRAY[2020,2021,2022,2023]) as year), "player_years" as (SELECT DISTINCT player.pid, base_years.year FROM player CROSS JOIN base_years), "t1206dd6a0185f87789312514d524dfa0" as (select COALESCE(bc_pid) as pid, "nfl_plays"."year", COUNT(CASE WHEN bc_pid IS NOT NULL THEN 1 ELSE NULL END) as rush_atts_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" in ('REG') group by "nfl_plays"."year", COALESCE(bc_pid)) select "player"."pid", player.fname, player.lname, "t06adaa2b44f8b40e476affee9748a3c5"."ra" AS "season_projected_rush_atts_0", "t6f54c05eac6ba296f8748f9026c2d01f"."ry" AS "season_projected_rush_yds_0", "t1206dd6a0185f87789312514d524dfa0"."rush_atts_from_plays" AS "rush_atts_from_plays_0", "player_years"."year", "player"."pos" from "player_years" inner join "player" on "player"."pid" = "player_years"."pid" left join "projections_index" as "t06adaa2b44f8b40e476affee9748a3c5" on "t06adaa2b44f8b40e476affee9748a3c5"."pid" = "player"."pid" and t06adaa2b44f8b40e476affee9748a3c5.year = player_years.year and t06adaa2b44f8b40e476affee9748a3c5.year IN (2023,2022,2021,2020) and "t06adaa2b44f8b40e476affee9748a3c5"."week" = '0' and "t06adaa2b44f8b40e476affee9748a3c5"."sourceid" = 18 and "t06adaa2b44f8b40e476affee9748a3c5"."seas_type" = 'REG' left join "projections_index" as "t6f54c05eac6ba296f8748f9026c2d01f" on "t6f54c05eac6ba296f8748f9026c2d01f"."pid" = "player"."pid" and t6f54c05eac6ba296f8748f9026c2d01f.year = player_years.year and "t6f54c05eac6ba296f8748f9026c2d01f"."week" = '0' and "t6f54c05eac6ba296f8748f9026c2d01f"."sourceid" = 18 and "t6f54c05eac6ba296f8748f9026c2d01f"."seas_type" = 'REG' left join "t1206dd6a0185f87789312514d524dfa0" on "t1206dd6a0185f87789312514d524dfa0"."pid" = "player"."pid" and t1206dd6a0185f87789312514d524dfa0.year = player_years.year where player.pos IN ('RB') group by player.fname, player.lname, "t06adaa2b44f8b40e476affee9748a3c5"."ra", "t6f54c05eac6ba296f8748f9026c2d01f"."ry", "t1206dd6a0185f87789312514d524dfa0"."rush_atts_from_plays", "player_years"."year", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 4 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(six_hours)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('should create a query with an N+1 column', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      columns: [
        {
          column_id: 'player_receiving_first_down_share_from_plays',
          params: {
            year: [2023, 2022, 2021, 2020, 2019, 2018, 2017]
          }
        },
        {
          column_id: 'player_fantasy_points_per_game_from_seasonlogs',
          params: {
            year: [2023, 2022, 2021, 2020, 2019, 2018, 2017]
          }
        },
        {
          column_id: 'player_espn_overall_score',
          params: {
            year: [2023, 2022, 2021, 2020, 2019, 2018, 2017]
          }
        },
        {
          column_id: 'player_fantasy_points_per_game_from_seasonlogs',
          params: {
            year_offset: [-3]
          }
        },
        {
          column_id: 'player_receiving_yards_from_plays',
          params: {
            year_offset: [1]
          }
        },
        {
          column_id: 'player_rush_yards_from_plays',
          params: {
            year_offset: [1]
          }
        }
      ],
      sort: [
        {
          column_id: 'player_fantasy_points_per_game_from_seasonlogs',
          desc: true,
          column_index: 0
        }
      ],
      where: [
        {
          column_id: 'player_position',
          operator: 'IN',
          value: ['WR']
        },
        {
          column_id: 'player_targets_from_plays',
          operator: '>=',
          value: '55'
        },
        {
          column_id: 'player_espn_overall_score',
          operator: '>',
          value: '0'
        }
      ],
      prefix_columns: ['player_name'],
      splits: ['year']
    })
    const expected_query = `with "base_years" as (SELECT unnest(ARRAY[2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024]) as year), "player_years" as (SELECT DISTINCT player.pid, base_years.year FROM player CROSS JOIN base_years), "td98f174615a5189ee284dbdaa246b629" as (select COALESCE(trg_pid) as pid, "nfl_plays"."year", SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END) as trg_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" in ('REG') group by "nfl_plays"."year", COALESCE(trg_pid) having SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END) >= '55'), "t6aebf0595e3b5ac6a6fa0d4dae92ad2e" as (select "pg"."pid", ROUND(100.0 * SUM(CASE WHEN nfl_plays.trg_pid = pg.pid THEN CASE WHEN nfl_plays.first_down THEN 1 ELSE 0 END ELSE 0 END) / NULLIF(SUM(CASE WHEN nfl_plays.first_down THEN 1 ELSE 0 END), 0), 2) as recv_first_down_share_from_plays, "nfl_plays"."year" from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and ("trg_pid" is not null) and "nfl_plays"."year" in (2017, 2018, 2019, 2020, 2021, 2022, 2023) and "nfl_plays"."seas_type" in ('REG') group by "pg"."pid", "nfl_plays"."year"), "t1130aa2d97dc5e54b67dd1267dfbbd9e" as (select COALESCE(trg_pid) as pid, "nfl_plays"."year", SUM(CASE WHEN comp = true THEN recv_yds ELSE 0 END) as rec_yds_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" in ('REG') group by "nfl_plays"."year", COALESCE(trg_pid)), "t43b4946259357a04c5f13d1d92eed11d" as (select COALESCE(bc_pid) as pid, "nfl_plays"."year", SUM(rush_yds) as rush_yds_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" in ('REG') group by "nfl_plays"."year", COALESCE(bc_pid)) select "player"."pid", player.fname, player.lname, "player_seasonlogs"."espn_overall_score" AS "espn_overall_score_0", "t6aebf0595e3b5ac6a6fa0d4dae92ad2e"."recv_first_down_share_from_plays" AS "recv_first_down_share_from_plays_0", "t8a4a84e735183537b2ba13726efd3e32"."points_per_game" AS "points_per_game_from_seasonlogs_0", "t43dad6b6c946e7f3d08b4cb24334c705"."points_per_game" AS "points_per_game_from_seasonlogs_1", "t1130aa2d97dc5e54b67dd1267dfbbd9e"."rec_yds_from_plays" AS "rec_yds_from_plays_0", "t43b4946259357a04c5f13d1d92eed11d"."rush_yds_from_plays" AS "rush_yds_from_plays_0", "player_years"."year", "player"."pos" from "player_years" inner join "player" on "player"."pid" = "player_years"."pid" inner join "td98f174615a5189ee284dbdaa246b629" on "td98f174615a5189ee284dbdaa246b629"."pid" = "player"."pid" and td98f174615a5189ee284dbdaa246b629.year = player_years.year inner join "player_seasonlogs" on "player_seasonlogs"."pid" = "player"."pid" and player_seasonlogs.year = player_years.year and "player_seasonlogs"."seas_type" = 'REG' left join "t6aebf0595e3b5ac6a6fa0d4dae92ad2e" on "t6aebf0595e3b5ac6a6fa0d4dae92ad2e"."pid" = "player"."pid" and t6aebf0595e3b5ac6a6fa0d4dae92ad2e.year = player_years.year and t6aebf0595e3b5ac6a6fa0d4dae92ad2e.year IN (2017,2018,2019,2020,2021,2022,2023) left join "scoring_format_player_seasonlogs" as "t8a4a84e735183537b2ba13726efd3e32" on "t8a4a84e735183537b2ba13726efd3e32"."pid" = "player"."pid" and t8a4a84e735183537b2ba13726efd3e32.year = player_years.year and t8a4a84e735183537b2ba13726efd3e32.year IN (2023,2022,2021,2020,2019,2018,2017) and t8a4a84e735183537b2ba13726efd3e32.scoring_format_hash = '0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d' left join "scoring_format_player_seasonlogs" as "t43dad6b6c946e7f3d08b4cb24334c705" on "t43dad6b6c946e7f3d08b4cb24334c705"."pid" = "player"."pid" and t43dad6b6c946e7f3d08b4cb24334c705.year = player_years.year + -3 and t43dad6b6c946e7f3d08b4cb24334c705.scoring_format_hash = '0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d' left join "t1130aa2d97dc5e54b67dd1267dfbbd9e" on "t1130aa2d97dc5e54b67dd1267dfbbd9e"."pid" = "player"."pid" and t1130aa2d97dc5e54b67dd1267dfbbd9e.year = player_years.year + 1 left join "t43b4946259357a04c5f13d1d92eed11d" on "t43b4946259357a04c5f13d1d92eed11d"."pid" = "player"."pid" and t43b4946259357a04c5f13d1d92eed11d.year = player_years.year + 1 where player.pos IN ('WR') and player_seasonlogs.espn_overall_score > '0' group by player.fname, player.lname, "player_seasonlogs"."espn_overall_score", "t6aebf0595e3b5ac6a6fa0d4dae92ad2e"."recv_first_down_share_from_plays", "t8a4a84e735183537b2ba13726efd3e32"."points_per_game", "t43dad6b6c946e7f3d08b4cb24334c705"."points_per_game", "t1130aa2d97dc5e54b67dd1267dfbbd9e"."rec_yds_from_plays", "t43b4946259357a04c5f13d1d92eed11d"."rush_yds_from_plays", "player_years"."year", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 6 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(six_hours)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('should create a query with prospect columns, weighted opportunity, and opportunity share', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      columns: [
        {
          column_id: 'player_weighted_opportunity_from_plays',
          params: {
            years: [2023, 2022, 2021, 2020]
          }
        },
        {
          column_id: 'player_opportunity_share_from_plays'
        },
        {
          column_id: 'player_body_mass_index'
        },
        {
          column_id: 'player_speed_score'
        },
        {
          column_id: 'player_height_adjusted_speed_score'
        },
        {
          column_id: 'player_agility_score'
        },
        {
          column_id: 'player_burst_score'
        }
      ],
      sort: [
        {
          column_id: 'player_weighted_opportunity_from_plays',
          desc: true
        }
      ]
    })
    const expected_query = `with "tb3e36120a917f58fcbf72b163549f606" as (select COALESCE(bc_pid, trg_pid) as pid, ROUND(SUM(CASE WHEN nfl_plays.ydl_100 <= 20 AND bc_pid IS NOT NULL THEN 1.30 WHEN nfl_plays.ydl_100 <= 20 AND trg_pid IS NOT NULL THEN 2.25 WHEN nfl_plays.ydl_100 > 20 AND bc_pid IS NOT NULL THEN 0.48 WHEN nfl_plays.ydl_100 > 20 AND trg_pid IS NOT NULL THEN 1.43 ELSE 0 END), 2) as weighted_opportunity_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" in ('REG') group by COALESCE(bc_pid, trg_pid)), "td2b8e0d3ac807cd59229c712aefce1fd" as (select "pg"."pid", ROUND(100.0 * (COUNT(CASE WHEN nfl_plays.bc_pid = pg.pid THEN 1 ELSE NULL END) + COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END)) / NULLIF(SUM(CASE WHEN nfl_plays.bc_pid IS NOT NULL OR nfl_plays.trg_pid IS NOT NULL THEN 1 ELSE 0 END), 0), 2) as opportunity_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and ("bc_pid" is not null or "trg_pid" is not null) and "nfl_plays"."seas_type" in ('REG') group by "pg"."pid") select "player"."pid", "tb3e36120a917f58fcbf72b163549f606"."weighted_opportunity_from_plays" AS "weighted_opportunity_from_plays_0", "td2b8e0d3ac807cd59229c712aefce1fd"."opportunity_share_from_plays" AS "opportunity_share_from_plays_0", CASE WHEN player.height > 0 THEN ROUND(CAST((player.weight::float / NULLIF(player.height::float * player.height::float, 0)) * 703 AS NUMERIC), 2) ELSE NULL END as bmi_0, CASE WHEN player.forty > 0 THEN ROUND((player.weight * 200.0) / NULLIF(POWER(player.forty, 4), 0), 2) ELSE NULL END as speed_score_0, CASE WHEN player.pos IN ('WR', 'TE') AND player.forty > 0 THEN ROUND(((player.weight * 200.0) / NULLIF(POWER(player.forty, 4), 0)) * (player.height / CASE WHEN player.pos = 'TE' THEN 76.4 ELSE 73.0 END), 2) ELSE NULL END as height_adjusted_speed_score_0, ROUND(COALESCE(player.shuttle, 0) + COALESCE(player.cone, 0), 2) as agility_score_0, ROUND(COALESCE(player.vertical, 0) + (COALESCE(player.broad, 0) / 12.0), 2) as burst_score_0, "player"."pos" from "player" left join "tb3e36120a917f58fcbf72b163549f606" on "tb3e36120a917f58fcbf72b163549f606"."pid" = "player"."pid" left join "td2b8e0d3ac807cd59229c712aefce1fd" on "td2b8e0d3ac807cd59229c712aefce1fd"."pid" = "player"."pid" group by "tb3e36120a917f58fcbf72b163549f606"."weighted_opportunity_from_plays", "td2b8e0d3ac807cd59229c712aefce1fd"."opportunity_share_from_plays", player.weight, player.height, player.weight, player.forty, player.weight, player.forty, player.height, player.pos, player.shuttle, player.cone, player.vertical, player.broad, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(six_hours)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('should create a query with player metrics, weighted opportunity, and roster status — sorted by bmi', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      sort: [
        {
          column_id: 'player_body_mass_index',
          desc: true
        }
      ],
      prefix_columns: ['player_name', 'player_league_roster_status'],
      columns: [
        'player_weighted_opportunity_from_plays',
        'player_opportunity_share_from_plays',
        'player_body_mass_index',
        'player_speed_score',
        'player_height_adjusted_speed_score',
        'player_agility_score',
        'player_burst_score'
      ],
      where: []
    })
    const expected_query = `with "tb3e36120a917f58fcbf72b163549f606" as (select COALESCE(bc_pid, trg_pid) as pid, ROUND(SUM(CASE WHEN nfl_plays.ydl_100 <= 20 AND bc_pid IS NOT NULL THEN 1.30 WHEN nfl_plays.ydl_100 <= 20 AND trg_pid IS NOT NULL THEN 2.25 WHEN nfl_plays.ydl_100 > 20 AND bc_pid IS NOT NULL THEN 0.48 WHEN nfl_plays.ydl_100 > 20 AND trg_pid IS NOT NULL THEN 1.43 ELSE 0 END), 2) as weighted_opportunity_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" in ('REG') group by COALESCE(bc_pid, trg_pid)), "td2b8e0d3ac807cd59229c712aefce1fd" as (select "pg"."pid", ROUND(100.0 * (COUNT(CASE WHEN nfl_plays.bc_pid = pg.pid THEN 1 ELSE NULL END) + COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END)) / NULLIF(SUM(CASE WHEN nfl_plays.bc_pid IS NOT NULL OR nfl_plays.trg_pid IS NOT NULL THEN 1 ELSE 0 END), 0), 2) as opportunity_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and ("bc_pid" is not null or "trg_pid" is not null) and "nfl_plays"."seas_type" in ('REG') group by "pg"."pid") select "player"."pid", player.fname, player.lname, CASE WHEN player.height > 0 THEN ROUND(CAST((player.weight::float / NULLIF(player.height::float * player.height::float, 0)) * 703 AS NUMERIC), 2) ELSE NULL END as bmi_0, CASE WHEN player.forty > 0 THEN ROUND((player.weight * 200.0) / NULLIF(POWER(player.forty, 4), 0), 2) ELSE NULL END as speed_score_0, CASE WHEN player.pos IN ('WR', 'TE') AND player.forty > 0 THEN ROUND(((player.weight * 200.0) / NULLIF(POWER(player.forty, 4), 0)) * (player.height / CASE WHEN player.pos = 'TE' THEN 76.4 ELSE 73.0 END), 2) ELSE NULL END as height_adjusted_speed_score_0, ROUND(COALESCE(player.shuttle, 0) + COALESCE(player.cone, 0), 2) as agility_score_0, ROUND(COALESCE(player.vertical, 0) + (COALESCE(player.broad, 0) / 12.0), 2) as burst_score_0, CASE WHEN rosters_players.slot = 13 THEN 'injured_reserve' WHEN rosters_players.slot = 12 THEN 'practice_squad' WHEN rosters_players.slot IS NULL THEN 'free_agent' ELSE 'active_roster' END AS player_league_roster_status, rosters_players.slot, rosters_players.tid, rosters_players.tag, "tb3e36120a917f58fcbf72b163549f606"."weighted_opportunity_from_plays" AS "weighted_opportunity_from_plays_0", "td2b8e0d3ac807cd59229c712aefce1fd"."opportunity_share_from_plays" AS "opportunity_share_from_plays_0", "player"."pos" from "player" left join "rosters_players" on "rosters_players"."pid" = "player"."pid" and "rosters_players"."year" = ${constants.season.year} and "rosters_players"."week" = ${Math.min(constants.season.week, constants.season.finalWeek)} and "rosters_players"."lid" = 1 left join "tb3e36120a917f58fcbf72b163549f606" on "tb3e36120a917f58fcbf72b163549f606"."pid" = "player"."pid" left join "td2b8e0d3ac807cd59229c712aefce1fd" on "td2b8e0d3ac807cd59229c712aefce1fd"."pid" = "player"."pid" group by player.fname, player.lname, player.weight, player.height, player.weight, player.forty, player.weight, player.forty, player.height, player.pos, player.shuttle, player.cone, player.vertical, player.broad, rosters_players.slot, rosters_players.tid, rosters_players.tag, "tb3e36120a917f58fcbf72b163549f606"."weighted_opportunity_from_plays", "td2b8e0d3ac807cd59229c712aefce1fd"."opportunity_share_from_plays", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 4 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(six_hours)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('should generate query for fantasy points by plays — split by year 2022 to 2023', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      columns: [
        {
          column_id: 'player_fantasy_points_from_plays',
          params: {
            year: [2022, 2023]
          }
        },
        {
          column_id: 'player_fantasy_points_from_seasonlogs',
          params: {
            year: [2022, 2023],
            scoring_format_hash:
              'ad64bf40cdfec0a1ebdf66453fa57687832f7556f3870251c044d5d270fc089e'
          }
        }
      ],
      sort: [
        {
          column_id: 'player_fantasy_points_from_plays',
          desc: true
        }
      ],
      splits: ['year']
    })
    const expected_query = `with "base_years" as (SELECT unnest(ARRAY[2022,2023]) as year), "player_years" as (SELECT DISTINCT player.pid, base_years.year FROM player CROSS JOIN base_years), "tf3b2f4f44c1977dac3344cf400954b61" as (select fantasy_points_plays.pid, ROUND(SUM(CASE WHEN pid_type = 'trg' AND comp = true THEN 1 ELSE 0 END + CASE WHEN pid_type IN ('bc', 'trg') THEN COALESCE(rush_yds, 0) + COALESCE(recv_yds, 0) ELSE 0 END * 0.1 + CASE WHEN pid_type = 'psr' THEN COALESCE(pass_yds, 0) ELSE 0 END * 0.04 + CASE WHEN pid_type = 'bc' AND rush_td = true THEN 6 WHEN pid_type = 'trg' AND pass_td = true THEN 6 WHEN pid_type = 'psr' AND pass_td = true THEN 4 ELSE 0 END + CASE WHEN pid_type = 'psr' AND int = true THEN -1 ELSE 0 END + CASE WHEN pid_type = 'fuml' THEN -1 ELSE 0 END), 2) as fantasy_points_from_plays, "fantasy_points_plays"."year" from (select bc_pid as pid, 'bc' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year from "nfl_plays" where "bc_pid" is not null union all select psr_pid as pid, 'psr' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year from "nfl_plays" where "psr_pid" is not null union all select trg_pid as pid, 'trg' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year from "nfl_plays" where "trg_pid" is not null union all select player_fuml_pid as pid, 'fuml' as pid_type, NULL as rush_yds, NULL as recv_yds, NULL as rush_td, NULL as td, NULL as comp, NULL as int, NULL as pass_yds, NULL as pass_td, play_type, seas_type, year from "nfl_plays" where "player_fuml_pid" is not null) as "fantasy_points_plays" where not "play_type" = 'NOPL' and "fantasy_points_plays"."year" in (2022, 2023) and "fantasy_points_plays"."seas_type" in ('REG') group by "fantasy_points_plays"."year", "fantasy_points_plays"."pid") select "player"."pid", "tf3b2f4f44c1977dac3344cf400954b61"."fantasy_points_from_plays" AS "fantasy_points_from_plays_0", "t7f074a6a223c6b25aa0ab11ab5c40539"."points" AS "points_from_seasonlogs_0", "player_years"."year", "player"."pos" from "player_years" inner join "player" on "player"."pid" = "player_years"."pid" left join "tf3b2f4f44c1977dac3344cf400954b61" on "tf3b2f4f44c1977dac3344cf400954b61"."pid" = "player"."pid" and tf3b2f4f44c1977dac3344cf400954b61.year = player_years.year and tf3b2f4f44c1977dac3344cf400954b61.year IN (2022,2023) left join "scoring_format_player_seasonlogs" as "t7f074a6a223c6b25aa0ab11ab5c40539" on "t7f074a6a223c6b25aa0ab11ab5c40539"."pid" = "player"."pid" and t7f074a6a223c6b25aa0ab11ab5c40539.year = player_years.year and t7f074a6a223c6b25aa0ab11ab5c40539.year IN (2022,2023) and t7f074a6a223c6b25aa0ab11ab5c40539.scoring_format_hash = 'ad64bf40cdfec0a1ebdf66453fa57687832f7556f3870251c044d5d270fc089e' group by "tf3b2f4f44c1977dac3344cf400954b61"."fantasy_points_from_plays", "t7f074a6a223c6b25aa0ab11ab5c40539"."points", "player_years"."year", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(one_week)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('should generate a fantasy points by play with per_game rate_type query', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      sort: [
        {
          column_id: 'player_fantasy_points_from_plays',
          desc: true
        }
      ],
      prefix_columns: ['player_name', 'player_league_roster_status'],
      columns: [
        {
          column_id: 'player_fantasy_points_from_plays',
          params: {
            year: [2023],
            rate_type: ['per_game']
          }
        }
      ],
      where: []
    })
    const expected_query = `with "tb972f2cc9e2375df01dce515be38a32b" as (select "player_gamelogs"."pid", count(*) as "rate_type_total_count", array_agg(distinct player_gamelogs.tm) as teams from "player_gamelogs" left join "nfl_games" on "nfl_games"."esbid" = "player_gamelogs"."esbid" where "nfl_games"."seas_type" in ('REG') and "player_gamelogs"."active" = true and "nfl_games"."year" in (2023) group by "player_gamelogs"."pid"), "t378d2a86ff3b4bed1f59e8c2a301e6f7" as (select fantasy_points_plays.pid, ROUND(SUM(CASE WHEN pid_type = 'trg' AND comp = true THEN 1 ELSE 0 END + CASE WHEN pid_type IN ('bc', 'trg') THEN COALESCE(rush_yds, 0) + COALESCE(recv_yds, 0) ELSE 0 END * 0.1 + CASE WHEN pid_type = 'psr' THEN COALESCE(pass_yds, 0) ELSE 0 END * 0.04 + CASE WHEN pid_type = 'bc' AND rush_td = true THEN 6 WHEN pid_type = 'trg' AND pass_td = true THEN 6 WHEN pid_type = 'psr' AND pass_td = true THEN 4 ELSE 0 END + CASE WHEN pid_type = 'psr' AND int = true THEN -1 ELSE 0 END + CASE WHEN pid_type = 'fuml' THEN -1 ELSE 0 END), 2) as fantasy_points_from_plays from (select bc_pid as pid, 'bc' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year from "nfl_plays" where "bc_pid" is not null union all select psr_pid as pid, 'psr' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year from "nfl_plays" where "psr_pid" is not null union all select trg_pid as pid, 'trg' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year from "nfl_plays" where "trg_pid" is not null union all select player_fuml_pid as pid, 'fuml' as pid_type, NULL as rush_yds, NULL as recv_yds, NULL as rush_td, NULL as td, NULL as comp, NULL as int, NULL as pass_yds, NULL as pass_td, play_type, seas_type, year from "nfl_plays" where "player_fuml_pid" is not null) as "fantasy_points_plays" where not "play_type" = 'NOPL' and "fantasy_points_plays"."year" in (2023) and "fantasy_points_plays"."seas_type" in ('REG') group by "fantasy_points_plays"."pid") select "player"."pid", player.fname, player.lname, CASE WHEN rosters_players.slot = 13 THEN 'injured_reserve' WHEN rosters_players.slot = 12 THEN 'practice_squad' WHEN rosters_players.slot IS NULL THEN 'free_agent' ELSE 'active_roster' END AS player_league_roster_status, rosters_players.slot, rosters_players.tid, rosters_players.tag, CAST(t378d2a86ff3b4bed1f59e8c2a301e6f7.fantasy_points_from_plays AS DECIMAL) / NULLIF(CAST(tb972f2cc9e2375df01dce515be38a32b.rate_type_total_count AS DECIMAL), 0) AS "fantasy_points_from_plays_0", "player"."pos" from "player" left join "tb972f2cc9e2375df01dce515be38a32b" on "tb972f2cc9e2375df01dce515be38a32b"."pid" = "player"."pid" left join "rosters_players" on "rosters_players"."pid" = "player"."pid" and "rosters_players"."year" = ${constants.season.year} and "rosters_players"."week" = ${Math.min(constants.season.week, constants.season.finalWeek)} and "rosters_players"."lid" = 1 left join "t378d2a86ff3b4bed1f59e8c2a301e6f7" on "t378d2a86ff3b4bed1f59e8c2a301e6f7"."pid" = "player"."pid" group by player.fname, player.lname, rosters_players.slot, rosters_players.tid, rosters_players.tag, "t378d2a86ff3b4bed1f59e8c2a301e6f7"."fantasy_points_from_plays", tb972f2cc9e2375df01dce515be38a32b.rate_type_total_count, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 8 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(twelve_hours)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('should generate a tackle columns query', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      columns: [
        {
          column_id: 'player_solo_tackles_from_plays',
          params: {
            year: [2023]
          }
        }
      ],
      sort: [
        {
          column_id: 'player_solo_tackles_from_plays',
          desc: true
        }
      ]
    })
    const expected_query = `with "t89755c4c161289c0528388aab8875aa4" as (select pid, SUM(CASE WHEN pid_column = 'solo_tackle_1_pid' THEN 1 WHEN pid_column = 'solo_tackle_2_pid' THEN 1 WHEN pid_column = 'solo_tackle_3_pid' THEN 1 ELSE 0 END) AS solo_tackles_from_plays from (select solo_tackle_1_pid as pid, 'solo_tackle_1_pid' as pid_column, play_type, seas_type, year from "nfl_plays" where "solo_tackle_1_pid" is not null union all select solo_tackle_2_pid as pid, 'solo_tackle_2_pid' as pid_column, play_type, seas_type, year from "nfl_plays" where "solo_tackle_2_pid" is not null union all select solo_tackle_3_pid as pid, 'solo_tackle_3_pid' as pid_column, play_type, seas_type, year from "nfl_plays" where "solo_tackle_3_pid" is not null) as "defensive_plays" where not "play_type" = 'NOPL' and "defensive_plays"."year" in (2023) and "defensive_plays"."seas_type" in ('REG') group by "pid") select "player"."pid", "t89755c4c161289c0528388aab8875aa4"."solo_tackles_from_plays" AS "solo_tackles_from_plays_0", "player"."pos" from "player" left join "t89755c4c161289c0528388aab8875aa4" on "t89755c4c161289c0528388aab8875aa4"."pid" = "player"."pid" group by "t89755c4c161289c0528388aab8875aa4"."solo_tackles_from_plays", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(one_week)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('should generate a tackle assist columns query', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      columns: [
        {
          column_id: 'player_combined_tackles_from_plays',
          params: {
            year: [2023]
          }
        }
      ],
      sort: [
        {
          column_id: 'player_combined_tackles_from_plays',
          desc: true
        }
      ]
    })
    const expected_query = `with "t545d6f61e3f3d701d190cd7810893e81" as (select pid, SUM(CASE WHEN pid_column = 'solo_tackle_1_pid' THEN 1 WHEN pid_column = 'solo_tackle_2_pid' THEN 1 WHEN pid_column = 'solo_tackle_3_pid' THEN 1 WHEN pid_column = 'assisted_tackle_1_pid' THEN 1 WHEN pid_column = 'assisted_tackle_2_pid' THEN 1 WHEN pid_column = 'tackle_assist_1_pid' THEN 1 WHEN pid_column = 'tackle_assist_2_pid' THEN 1 WHEN pid_column = 'tackle_assist_3_pid' THEN 1 ELSE 0 END) AS combined_tackles_from_plays from (select assisted_tackle_1_pid as pid, 'assisted_tackle_1_pid' as pid_column, play_type, seas_type, year from "nfl_plays" where "assisted_tackle_1_pid" is not null union all select assisted_tackle_2_pid as pid, 'assisted_tackle_2_pid' as pid_column, play_type, seas_type, year from "nfl_plays" where "assisted_tackle_2_pid" is not null union all select solo_tackle_1_pid as pid, 'solo_tackle_1_pid' as pid_column, play_type, seas_type, year from "nfl_plays" where "solo_tackle_1_pid" is not null union all select solo_tackle_2_pid as pid, 'solo_tackle_2_pid' as pid_column, play_type, seas_type, year from "nfl_plays" where "solo_tackle_2_pid" is not null union all select solo_tackle_3_pid as pid, 'solo_tackle_3_pid' as pid_column, play_type, seas_type, year from "nfl_plays" where "solo_tackle_3_pid" is not null union all select tackle_assist_1_pid as pid, 'tackle_assist_1_pid' as pid_column, play_type, seas_type, year from "nfl_plays" where "tackle_assist_1_pid" is not null union all select tackle_assist_2_pid as pid, 'tackle_assist_2_pid' as pid_column, play_type, seas_type, year from "nfl_plays" where "tackle_assist_2_pid" is not null union all select tackle_assist_3_pid as pid, 'tackle_assist_3_pid' as pid_column, play_type, seas_type, year from "nfl_plays" where "tackle_assist_3_pid" is not null) as "defensive_plays" where not "play_type" = 'NOPL' and "defensive_plays"."year" in (2023) and "defensive_plays"."seas_type" in ('REG') group by "pid") select "player"."pid", "t545d6f61e3f3d701d190cd7810893e81"."combined_tackles_from_plays" AS "combined_tackles_from_plays_0", "player"."pos" from "player" left join "t545d6f61e3f3d701d190cd7810893e81" on "t545d6f61e3f3d701d190cd7810893e81"."pid" = "player"."pid" group by "t545d6f61e3f3d701d190cd7810893e81"."combined_tackles_from_plays", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(one_week)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('should filter by active rosters', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      prefix_columns: ['player_name', 'player_league_roster_status'],
      columns: [
        'player_receptions_from_plays',
        'player_receiving_yards_from_plays',
        'player_receiving_touchdowns_from_plays',
        'player_targets_from_plays',
        'player_deep_targets_from_plays',
        'player_deep_targets_percentage_from_plays',
        'player_air_yards_per_target_from_plays',
        'player_air_yards_from_plays',
        'player_air_yards_share_from_plays'
      ],
      sort: [
        {
          column_id: 'player_deep_targets_from_plays',
          desc: true
        }
      ],
      where: [
        {
          column_id: 'player_position',
          operator: 'IN',
          value: ['WR']
        },
        {
          column_id: 'player_league_roster_status',
          operator: '=',
          value: 'active_roster'
        }
      ]
    })
    const expected_query = `with "td98f174615a5189ee284dbdaa246b629" as (select COALESCE(trg_pid) as pid, SUM(CASE WHEN comp = true THEN 1 ELSE 0 END) as recs_from_plays, SUM(CASE WHEN comp = true THEN recv_yds ELSE 0 END) as rec_yds_from_plays, SUM(CASE WHEN comp = true AND td = true THEN 1 ELSE 0 END) as rec_tds_from_plays, SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END) as trg_from_plays, SUM(CASE WHEN dot >= 20 THEN 1 ELSE 0 END) as deep_trg_from_plays, CASE WHEN SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN dot >= 20 THEN 1 ELSE 0 END) / SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END), 2) ELSE 0 END as deep_trg_pct_from_plays, CASE WHEN SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END) > 0 THEN CAST(ROUND(SUM(dot)::decimal / SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END), 2) AS decimal) ELSE 0 END as air_yds_per_trg_from_plays, SUM(dot) as air_yds_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" in ('REG') group by COALESCE(trg_pid)), "tf2edbb4d60cbde2082301ca18895bcfc" as (select "pg"."pid", CASE WHEN SUM(nfl_plays.dot) > 0 THEN ROUND(100.0 * SUM(CASE WHEN nfl_plays.trg_pid = pg.pid THEN nfl_plays.dot ELSE 0 END) / NULLIF(SUM(nfl_plays.dot), 0), 2) ELSE 0 END as air_yds_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and ("trg_pid" is not null) and "nfl_plays"."seas_type" in ('REG') group by "pg"."pid") select "player"."pid", player.fname, player.lname, CASE WHEN rosters_players.slot = 13 THEN 'injured_reserve' WHEN rosters_players.slot = 12 THEN 'practice_squad' WHEN rosters_players.slot IS NULL THEN 'free_agent' ELSE 'active_roster' END AS player_league_roster_status, rosters_players.slot, rosters_players.tid, rosters_players.tag, "td98f174615a5189ee284dbdaa246b629"."recs_from_plays" AS "recs_from_plays_0", "td98f174615a5189ee284dbdaa246b629"."rec_yds_from_plays" AS "rec_yds_from_plays_0", "td98f174615a5189ee284dbdaa246b629"."rec_tds_from_plays" AS "rec_tds_from_plays_0", "td98f174615a5189ee284dbdaa246b629"."trg_from_plays" AS "trg_from_plays_0", "td98f174615a5189ee284dbdaa246b629"."deep_trg_from_plays" AS "deep_trg_from_plays_0", "td98f174615a5189ee284dbdaa246b629"."deep_trg_pct_from_plays" AS "deep_trg_pct_from_plays_0", "td98f174615a5189ee284dbdaa246b629"."air_yds_per_trg_from_plays" AS "air_yds_per_trg_from_plays_0", "td98f174615a5189ee284dbdaa246b629"."air_yds_from_plays" AS "air_yds_from_plays_0", "tf2edbb4d60cbde2082301ca18895bcfc"."air_yds_share_from_plays" AS "air_yds_share_from_plays_0", "player"."pos" from "player" left join "rosters_players" on "rosters_players"."pid" = "player"."pid" and "rosters_players"."year" = ${constants.season.year} and "rosters_players"."week" = ${Math.min(constants.season.week, constants.season.finalWeek)} and "rosters_players"."lid" = 1 left join "td98f174615a5189ee284dbdaa246b629" on "td98f174615a5189ee284dbdaa246b629"."pid" = "player"."pid" left join "tf2edbb4d60cbde2082301ca18895bcfc" on "tf2edbb4d60cbde2082301ca18895bcfc"."pid" = "player"."pid" where player.pos IN ('WR') and CASE WHEN rosters_players.slot = 13 THEN 'injured_reserve' WHEN rosters_players.slot = 12 THEN 'practice_squad' WHEN rosters_players.slot IS NULL THEN 'free_agent' ELSE 'active_roster' END = 'active_roster' group by player.fname, player.lname, rosters_players.slot, rosters_players.tid, rosters_players.tag, "td98f174615a5189ee284dbdaa246b629"."recs_from_plays", "td98f174615a5189ee284dbdaa246b629"."rec_yds_from_plays", "td98f174615a5189ee284dbdaa246b629"."rec_tds_from_plays", "td98f174615a5189ee284dbdaa246b629"."trg_from_plays", "td98f174615a5189ee284dbdaa246b629"."deep_trg_from_plays", "td98f174615a5189ee284dbdaa246b629"."deep_trg_pct_from_plays", "td98f174615a5189ee284dbdaa246b629"."air_yds_per_trg_from_plays", "td98f174615a5189ee284dbdaa246b629"."air_yds_from_plays", "tf2edbb4d60cbde2082301ca18895bcfc"."air_yds_share_from_plays", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 12 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(six_hours)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('should generate a query with a team stat column', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      prefix_columns: ['player_name'],
      columns: [
        {
          column_id: 'player_target_share_from_plays',
          params: {
            year: [2023]
          }
        },
        {
          column_id: 'team_pass_yards_from_plays',
          params: {
            year: [2023]
          }
        }
      ],
      sort: [
        {
          column_id: 'player_target_share_from_plays',
          desc: true
        }
      ]
    })
    const expected_query = `with "t5259bf0a7e913913e3e8f7c788f95e56" as (select "pg"."pid", ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / NULLIF(SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END), 0), 2) as trg_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and ("trg_pid" is not null) and "nfl_plays"."year" in (2023) and "nfl_plays"."seas_type" in ('REG') group by "pg"."pid"), "t36bf0474d4db796322b4fe1d9755f770" as (select "nfl_plays"."off" as "nfl_team", SUM(pass_yds) AS team_pass_yds_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."year" in (2023) and "nfl_plays"."seas_type" in ('REG') group by "nfl_plays"."off"), "t36bf0474d4db796322b4fe1d9755f770_team_stats" as (select "t36bf0474d4db796322b4fe1d9755f770"."nfl_team", sum(t36bf0474d4db796322b4fe1d9755f770.team_pass_yds_from_plays) as team_pass_yds_from_plays from "t36bf0474d4db796322b4fe1d9755f770" group by "t36bf0474d4db796322b4fe1d9755f770"."nfl_team") select "player"."pid", player.fname, player.lname, "t5259bf0a7e913913e3e8f7c788f95e56"."trg_share_from_plays" AS "trg_share_from_plays_0", "t36bf0474d4db796322b4fe1d9755f770_team_stats"."team_pass_yds_from_plays" AS "team_pass_yds_from_plays_0", "player"."pos" from "player" left join "t5259bf0a7e913913e3e8f7c788f95e56" on "t5259bf0a7e913913e3e8f7c788f95e56"."pid" = "player"."pid" left join "t36bf0474d4db796322b4fe1d9755f770_team_stats" on "t36bf0474d4db796322b4fe1d9755f770_team_stats"."nfl_team" = "player"."current_nfl_team" group by player.fname, player.lname, "t5259bf0a7e913913e3e8f7c788f95e56"."trg_share_from_plays", "t36bf0474d4db796322b4fe1d9755f770_team_stats"."team_pass_yds_from_plays", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 4 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(one_week)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('should create a keeptradecut query', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      prefix_columns: ['player_name'],
      columns: [
        {
          column_id: 'player_keeptradecut_value'
        },
        {
          column_id: 'player_keeptradecut_value',
          params: {
            date: '2022-01-01'
          }
        },
        {
          column_id: 'player_keeptradecut_overall_rank'
        },
        {
          column_id: 'player_keeptradecut_position_rank'
        },
        {
          column_id: 'player_receiving_yards_from_plays',
          params: {
            career_year: [1, 1]
          }
        }
      ],
      sort: [
        {
          column_id: 'player_keeptradecut_overall_rank',
          desc: true
        }
      ],
      where: [
        {
          column_id: 'player_position',
          operator: 'IN',
          value: ['WR']
        },
        {
          column_id: 'player_keeptradecut_value',
          operator: '>=',
          value: '5000'
        }
      ]
    })
    const expected_query = `with "t47cdb58d80197cc3a9c8099d943ac1d4" as (select COALESCE(trg_pid) as pid, SUM(CASE WHEN comp = true THEN recv_yds ELSE 0 END) as rec_yds_from_plays from "nfl_plays" inner join "player_seasonlogs" on ("nfl_plays"."trg_pid" = "player_seasonlogs"."pid") and "nfl_plays"."year" = "player_seasonlogs"."year" and "nfl_plays"."seas_type" = "player_seasonlogs"."seas_type" where not "play_type" = 'NOPL' and "player_seasonlogs"."career_year" between 1 and 1 and "nfl_plays"."seas_type" in ('REG') group by COALESCE(trg_pid)) select "player"."pid", player.fname, player.lname, "tf2c4b095a714eac7d86ea8780f70ad1a"."v" AS "player_keeptradecut_value_0", "t5128971d425584a36532223c749fcb1c"."v" AS "player_keeptradecut_value_1", "tdee8384ca991f5d264db60e939f8fd95"."v" AS "player_keeptradecut_overall_rank_0", "t8bac4238818693b810f3792a4224a550"."v" AS "player_keeptradecut_position_rank_0", "t47cdb58d80197cc3a9c8099d943ac1d4"."rec_yds_from_plays" AS "rec_yds_from_plays_0", "player"."pos" from "player" inner join "keeptradecut_rankings" as "tf2c4b095a714eac7d86ea8780f70ad1a" on "tf2c4b095a714eac7d86ea8780f70ad1a"."pid" = "player"."pid" and "tf2c4b095a714eac7d86ea8780f70ad1a"."qb" = 2 and "tf2c4b095a714eac7d86ea8780f70ad1a"."type" = 1 and "tf2c4b095a714eac7d86ea8780f70ad1a"."d" = (select MAX(d) from "keeptradecut_rankings" where "pid" = player.pid and "qb" = 2 and "type" = 1) left join "keeptradecut_rankings" as "t5128971d425584a36532223c749fcb1c" on "t5128971d425584a36532223c749fcb1c"."pid" = "player"."pid" and "t5128971d425584a36532223c749fcb1c"."qb" = 2 and "t5128971d425584a36532223c749fcb1c"."type" = 1 and "t5128971d425584a36532223c749fcb1c"."d" = EXTRACT(EPOCH FROM (to_timestamp('2022-01-01', 'YYYY-MM-DD') + interval '0 year') AT TIME ZONE 'UTC')::integer left join "keeptradecut_rankings" as "tdee8384ca991f5d264db60e939f8fd95" on "tdee8384ca991f5d264db60e939f8fd95"."pid" = "player"."pid" and "tdee8384ca991f5d264db60e939f8fd95"."qb" = 2 and "tdee8384ca991f5d264db60e939f8fd95"."type" = 3 and "tdee8384ca991f5d264db60e939f8fd95"."d" = (select MAX(d) from "keeptradecut_rankings" where "pid" = player.pid and "qb" = 2 and "type" = 3) left join "keeptradecut_rankings" as "t8bac4238818693b810f3792a4224a550" on "t8bac4238818693b810f3792a4224a550"."pid" = "player"."pid" and "t8bac4238818693b810f3792a4224a550"."qb" = 2 and "t8bac4238818693b810f3792a4224a550"."type" = 2 and "t8bac4238818693b810f3792a4224a550"."d" = (select MAX(d) from "keeptradecut_rankings" where "pid" = player.pid and "qb" = 2 and "type" = 2) left join "t47cdb58d80197cc3a9c8099d943ac1d4" on "t47cdb58d80197cc3a9c8099d943ac1d4"."pid" = "player"."pid" where player.pos IN ('WR') and tf2c4b095a714eac7d86ea8780f70ad1a.v >= '5000' group by player.fname, player.lname, "tf2c4b095a714eac7d86ea8780f70ad1a"."v", "t5128971d425584a36532223c749fcb1c"."v", "tdee8384ca991f5d264db60e939f8fd95"."v", "t8bac4238818693b810f3792a4224a550"."v", "t47cdb58d80197cc3a9c8099d943ac1d4"."rec_yds_from_plays", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 6 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(six_hours)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('should create a keeptradecut query with splits', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      prefix_columns: ['player_name'],
      columns: [
        {
          column_id: 'player_keeptradecut_value',
          params: {
            year: [2021, 2022, 2023, 2024]
          }
        }
      ],
      sort: [
        {
          column_id: 'player_keeptradecut_value',
          desc: true
        }
      ],
      splits: ['year']
    })
    const expected_query = `with "base_years" as (SELECT unnest(ARRAY[2021,2022,2023,2024]) as year), "player_years" as (SELECT DISTINCT player.pid, base_years.year FROM player CROSS JOIN base_years) select "player"."pid", player.fname, player.lname, "tc78572ffc09a69493a48490142c672da"."v" AS "player_keeptradecut_value_0", "player_years"."year", "player"."pos" from "player_years" inner join "player" on "player"."pid" = "player_years"."pid" left join "opening_days" on "opening_days"."year" = "player_years"."year" left join "keeptradecut_rankings" as "tc78572ffc09a69493a48490142c672da" on "tc78572ffc09a69493a48490142c672da"."pid" = "player"."pid" and "tc78572ffc09a69493a48490142c672da"."qb" = 2 and "tc78572ffc09a69493a48490142c672da"."type" = 1 and "tc78572ffc09a69493a48490142c672da"."d" = EXTRACT(EPOCH FROM (date_trunc('day', opening_days.opening_day) + interval '0 year'))::integer and opening_days.year = (player_years.year) group by player.fname, player.lname, "tc78572ffc09a69493a48490142c672da"."v", "player_years"."year", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 4 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(one_week)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('should create a rushing yards split by week', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      splits: ['year', 'week'],
      prefix_columns: ['player_name'],
      columns: [
        {
          column_id: 'player_rush_yards_from_plays',
          params: { year: [2020, 2021, 2022, 2023] }
        },
        {
          column_id: 'player_week_projected_rush_yds',
          params: { year: [2020, 2021, 2022, 2023] }
        },
        {
          column_id: 'team_rush_yards_from_plays',
          params: { year: [2020, 2021, 2022, 2023] }
        }
      ],
      sort: [
        {
          column_id: 'player_rush_yards_from_plays',
          desc: true
        }
      ]
    })
    const expected_query = `with "base_years" as (SELECT unnest(ARRAY[2020,2021,2022,2023]) as year), "player_years" as (SELECT DISTINCT player.pid, base_years.year FROM player CROSS JOIN base_years), "player_years_weeks" as (SELECT player_years.pid, nfl_year_week_timestamp.year, nfl_year_week_timestamp.week FROM player_years INNER JOIN nfl_year_week_timestamp ON player_years.year = nfl_year_week_timestamp.year), "tc0ee781f18fbe4c151e8557943c287a6" as (select COALESCE(bc_pid) as pid, "nfl_plays"."week", "nfl_plays"."year", SUM(rush_yds) as rush_yds_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."year" in (2020, 2021, 2022, 2023) and "nfl_plays"."seas_type" in ('REG') group by "nfl_plays"."week", "nfl_plays"."year", COALESCE(bc_pid)), "tfb6d1616d9c41cb60691248d604e4dbe" as (select "nfl_plays"."off" as "nfl_team", SUM(rush_yds) AS team_rush_yds_from_plays, "nfl_plays"."year", "nfl_plays"."week" from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."year" in (2020, 2021, 2022, 2023) and "nfl_plays"."seas_type" in ('REG') group by "nfl_plays"."off", "nfl_plays"."year", "nfl_plays"."week"), "tfb6d1616d9c41cb60691248d604e4dbe_team_stats" as (select "tfb6d1616d9c41cb60691248d604e4dbe"."nfl_team", sum(tfb6d1616d9c41cb60691248d604e4dbe.team_rush_yds_from_plays) as team_rush_yds_from_plays, "tfb6d1616d9c41cb60691248d604e4dbe"."year", "tfb6d1616d9c41cb60691248d604e4dbe"."week" from "tfb6d1616d9c41cb60691248d604e4dbe" group by "tfb6d1616d9c41cb60691248d604e4dbe"."nfl_team", "tfb6d1616d9c41cb60691248d604e4dbe"."year", "tfb6d1616d9c41cb60691248d604e4dbe"."week") select "player"."pid", player.fname, player.lname, "tc0ee781f18fbe4c151e8557943c287a6"."rush_yds_from_plays" AS "rush_yds_from_plays_0", "tf0b1e8f00d3f5ec618c9b50a239c6c22"."ry" AS "week_projected_rush_yds_0", "tfb6d1616d9c41cb60691248d604e4dbe_team_stats"."team_rush_yds_from_plays" AS "team_rush_yds_from_plays_0", "player_years"."year", "player_years_weeks"."week", "player"."pos" from "player_years_weeks" inner join "player" on "player"."pid" = "player_years_weeks"."pid" inner join "player_years" on "player_years"."pid" = "player"."pid" and "player_years"."year" = "player_years_weeks"."year" left join "tc0ee781f18fbe4c151e8557943c287a6" on "tc0ee781f18fbe4c151e8557943c287a6"."pid" = "player"."pid" and tc0ee781f18fbe4c151e8557943c287a6.year = player_years_weeks.year and tc0ee781f18fbe4c151e8557943c287a6.year IN (2020,2021,2022,2023) and tc0ee781f18fbe4c151e8557943c287a6.week = player_years_weeks.week left join "projections_index" as "tf0b1e8f00d3f5ec618c9b50a239c6c22" on "tf0b1e8f00d3f5ec618c9b50a239c6c22"."pid" = "player"."pid" and tf0b1e8f00d3f5ec618c9b50a239c6c22.year = player_years_weeks.year and tf0b1e8f00d3f5ec618c9b50a239c6c22.year IN (2020,2021,2022,2023) and tf0b1e8f00d3f5ec618c9b50a239c6c22.week = player_years_weeks.week and "tf0b1e8f00d3f5ec618c9b50a239c6c22"."sourceid" = 18 and "tf0b1e8f00d3f5ec618c9b50a239c6c22"."seas_type" = 'REG' left join "tfb6d1616d9c41cb60691248d604e4dbe_team_stats" on "tfb6d1616d9c41cb60691248d604e4dbe_team_stats"."nfl_team" = "player"."current_nfl_team" and tfb6d1616d9c41cb60691248d604e4dbe_team_stats.year = player_years_weeks.year and tfb6d1616d9c41cb60691248d604e4dbe_team_stats.year IN (2020,2021,2022,2023) and tfb6d1616d9c41cb60691248d604e4dbe_team_stats.week = player_years_weeks.week group by player.fname, player.lname, "tc0ee781f18fbe4c151e8557943c287a6"."rush_yds_from_plays", "tf0b1e8f00d3f5ec618c9b50a239c6c22"."ry", "tfb6d1616d9c41cb60691248d604e4dbe_team_stats"."team_rush_yds_from_plays", "player_years"."year", "player_years_weeks"."week", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 4 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(one_week)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('should create a query with player current age', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      prefix_columns: ['player_name'],
      columns: [
        'player_age',
        {
          column_id: 'player_receiving_yards_from_plays',
          params: {
            year: [2023, 2022, 2021, 2020]
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
    const expected_query = `with "t2eca29502df6a0581aafd411a2f4d49f" as (select COALESCE(trg_pid) as pid, SUM(CASE WHEN comp = true THEN recv_yds ELSE 0 END) as rec_yds_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."year" in (2020, 2021, 2022, 2023) and "nfl_plays"."seas_type" in ('REG') group by COALESCE(trg_pid)) select "player"."pid", player.fname, player.lname, CASE WHEN player.dob IS NULL OR player.dob = '0000-00-00' THEN NULL ELSE ROUND(EXTRACT(YEAR FROM AGE(CURRENT_DATE, TO_DATE(player.dob, 'YYYY-MM-DD'))) + (EXTRACT(MONTH FROM AGE(CURRENT_DATE, TO_DATE(player.dob, 'YYYY-MM-DD'))) / 12.0) + (EXTRACT(DAY FROM AGE(CURRENT_DATE, TO_DATE(player.dob, 'YYYY-MM-DD'))) / 365.25), 2) END as age_0, "t2eca29502df6a0581aafd411a2f4d49f"."rec_yds_from_plays" AS "rec_yds_from_plays_0", "player"."pos" from "player" left join "t2eca29502df6a0581aafd411a2f4d49f" on "t2eca29502df6a0581aafd411a2f4d49f"."pid" = "player"."pid" group by player.fname, player.lname, player.dob, "t2eca29502df6a0581aafd411a2f4d49f"."rec_yds_from_plays", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 5 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(one_week)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('should create a year splits query with player age at time of split', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      sort: [
        {
          column_id: 'player_receiving_yards_from_plays',
          desc: true
        }
      ],
      prefix_columns: ['player_name'],
      columns: [
        {
          column_id: 'player_receiving_yards_from_plays',
          params: {
            year: [2023, 2022, 2021, 2020]
          }
        },
        'player_age'
      ],
      where: [],
      splits: ['year']
    })
    const expected_query = `with "base_years" as (SELECT unnest(ARRAY[2020,2021,2022,2023]) as year), "player_years" as (SELECT DISTINCT player.pid, base_years.year FROM player CROSS JOIN base_years), "t2eca29502df6a0581aafd411a2f4d49f" as (select COALESCE(trg_pid) as pid, "nfl_plays"."year", SUM(CASE WHEN comp = true THEN recv_yds ELSE 0 END) as rec_yds_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."year" in (2020, 2021, 2022, 2023) and "nfl_plays"."seas_type" in ('REG') group by "nfl_plays"."year", COALESCE(trg_pid)) select "player"."pid", player.fname, player.lname, "t2eca29502df6a0581aafd411a2f4d49f"."rec_yds_from_plays" AS "rec_yds_from_plays_0", CASE WHEN player.dob IS NULL OR player.dob = '0000-00-00' THEN NULL ELSE ROUND(EXTRACT(YEAR FROM AGE(opening_days.opening_day, TO_DATE(player.dob, 'YYYY-MM-DD'))) + (EXTRACT(MONTH FROM AGE(opening_days.opening_day, TO_DATE(player.dob, 'YYYY-MM-DD'))) / 12.0) + (EXTRACT(DAY FROM AGE(opening_days.opening_day, TO_DATE(player.dob, 'YYYY-MM-DD'))) / 365.25), 2) END as age_0, "player_years"."year", "player"."pos" from "player_years" inner join "player" on "player"."pid" = "player_years"."pid" left join "t2eca29502df6a0581aafd411a2f4d49f" on "t2eca29502df6a0581aafd411a2f4d49f"."pid" = "player"."pid" and t2eca29502df6a0581aafd411a2f4d49f.year = player_years.year and t2eca29502df6a0581aafd411a2f4d49f.year IN (2020,2021,2022,2023) left join "opening_days" on "opening_days"."year" = "player_years"."year" group by player.fname, player.lname, "t2eca29502df6a0581aafd411a2f4d49f"."rec_yds_from_plays", player.dob, opening_days.opening_day, "player_years"."year", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 4 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(one_week)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('should create a query for player keeptradecut value and fantasy points from plays for wide receivers with year splits', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      columns: [
        'player_keeptradecut_value',
        'player_fantasy_points_from_plays'
      ],
      sort: [
        {
          column_id: 'player_keeptradecut_value',
          desc: true
        }
      ],
      where: [
        {
          column_id: 'player_position',
          operator: 'IN',
          value: ['WR']
        }
      ],
      prefix_columns: ['player_name'],
      splits: ['year']
    })
    const expected_query = `with "base_years" as (SELECT unnest(ARRAY[${all_years}]) as year), "player_years" as (SELECT DISTINCT player.pid, base_years.year FROM player CROSS JOIN base_years), "t0437e04c5f293392ee7470cf251ab7ff" as (select fantasy_points_plays.pid, ROUND(SUM(CASE WHEN pid_type = 'trg' AND comp = true THEN 1 ELSE 0 END + CASE WHEN pid_type IN ('bc', 'trg') THEN COALESCE(rush_yds, 0) + COALESCE(recv_yds, 0) ELSE 0 END * 0.1 + CASE WHEN pid_type = 'psr' THEN COALESCE(pass_yds, 0) ELSE 0 END * 0.04 + CASE WHEN pid_type = 'bc' AND rush_td = true THEN 6 WHEN pid_type = 'trg' AND pass_td = true THEN 6 WHEN pid_type = 'psr' AND pass_td = true THEN 4 ELSE 0 END + CASE WHEN pid_type = 'psr' AND int = true THEN -1 ELSE 0 END + CASE WHEN pid_type = 'fuml' THEN -1 ELSE 0 END), 2) as fantasy_points_from_plays, "fantasy_points_plays"."year" from (select bc_pid as pid, 'bc' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year from "nfl_plays" where "bc_pid" is not null union all select psr_pid as pid, 'psr' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year from "nfl_plays" where "psr_pid" is not null union all select trg_pid as pid, 'trg' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year from "nfl_plays" where "trg_pid" is not null union all select player_fuml_pid as pid, 'fuml' as pid_type, NULL as rush_yds, NULL as recv_yds, NULL as rush_td, NULL as td, NULL as comp, NULL as int, NULL as pass_yds, NULL as pass_td, play_type, seas_type, year from "nfl_plays" where "player_fuml_pid" is not null) as "fantasy_points_plays" where not "play_type" = 'NOPL' and "fantasy_points_plays"."seas_type" in ('REG') group by "fantasy_points_plays"."year", "fantasy_points_plays"."pid") select "player"."pid", player.fname, player.lname, "tf2c4b095a714eac7d86ea8780f70ad1a"."v" AS "player_keeptradecut_value_0", "t0437e04c5f293392ee7470cf251ab7ff"."fantasy_points_from_plays" AS "fantasy_points_from_plays_0", "player_years"."year", "player"."pos" from "player_years" inner join "player" on "player"."pid" = "player_years"."pid" left join "opening_days" on "opening_days"."year" = "player_years"."year" left join "keeptradecut_rankings" as "tf2c4b095a714eac7d86ea8780f70ad1a" on "tf2c4b095a714eac7d86ea8780f70ad1a"."pid" = "player"."pid" and "tf2c4b095a714eac7d86ea8780f70ad1a"."qb" = 2 and "tf2c4b095a714eac7d86ea8780f70ad1a"."type" = 1 and "tf2c4b095a714eac7d86ea8780f70ad1a"."d" = EXTRACT(EPOCH FROM (date_trunc('day', opening_days.opening_day) + interval '0 year'))::integer and opening_days.year = (player_years.year) left join "t0437e04c5f293392ee7470cf251ab7ff" on "t0437e04c5f293392ee7470cf251ab7ff"."pid" = "player"."pid" and t0437e04c5f293392ee7470cf251ab7ff.year = player_years.year where player.pos IN ('WR') group by player.fname, player.lname, "tf2c4b095a714eac7d86ea8780f70ad1a"."v", "t0437e04c5f293392ee7470cf251ab7ff"."fantasy_points_from_plays", "player_years"."year", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 4 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(six_hours)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('week and year split with keeptradecut and fantasypoints from plays with per_game rate_type — should sanitize', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      columns: [
        'player_keeptradecut_value',
        {
          column_id: 'player_fantasy_points_from_plays',
          params: {
            rate_type: ['per_game']
          }
        }
      ],
      sort: [
        {
          column_id: 'player_keeptradecut_value',
          desc: true
        }
      ],
      where: [
        {
          column_id: 'player_position',
          operator: 'IN',
          value: ['WR']
        }
      ],
      prefix_columns: ['player_name'],
      splits: ['year', 'week']
    })
    const expected_query = `with "base_years" as (SELECT unnest(ARRAY[${all_years}]) as year), "player_years" as (SELECT DISTINCT player.pid, base_years.year FROM player CROSS JOIN base_years), "player_years_weeks" as (SELECT player_years.pid, nfl_year_week_timestamp.year, nfl_year_week_timestamp.week FROM player_years INNER JOIN nfl_year_week_timestamp ON player_years.year = nfl_year_week_timestamp.year), "t5c9d05b7fad29279ca31c0a7159f3276" as (select fantasy_points_plays.pid, ROUND(SUM(CASE WHEN pid_type = 'trg' AND comp = true THEN 1 ELSE 0 END + CASE WHEN pid_type IN ('bc', 'trg') THEN COALESCE(rush_yds, 0) + COALESCE(recv_yds, 0) ELSE 0 END * 0.1 + CASE WHEN pid_type = 'psr' THEN COALESCE(pass_yds, 0) ELSE 0 END * 0.04 + CASE WHEN pid_type = 'bc' AND rush_td = true THEN 6 WHEN pid_type = 'trg' AND pass_td = true THEN 6 WHEN pid_type = 'psr' AND pass_td = true THEN 4 ELSE 0 END + CASE WHEN pid_type = 'psr' AND int = true THEN -1 ELSE 0 END + CASE WHEN pid_type = 'fuml' THEN -1 ELSE 0 END), 2) as fantasy_points_from_plays, "fantasy_points_plays"."week", "fantasy_points_plays"."year" from (select bc_pid as pid, 'bc' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year, week from "nfl_plays" where "bc_pid" is not null union all select psr_pid as pid, 'psr' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year, week from "nfl_plays" where "psr_pid" is not null union all select trg_pid as pid, 'trg' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year, week from "nfl_plays" where "trg_pid" is not null union all select player_fuml_pid as pid, 'fuml' as pid_type, NULL as rush_yds, NULL as recv_yds, NULL as rush_td, NULL as td, NULL as comp, NULL as int, NULL as pass_yds, NULL as pass_td, play_type, seas_type, year, week from "nfl_plays" where "player_fuml_pid" is not null) as "fantasy_points_plays" where not "play_type" = 'NOPL' and "fantasy_points_plays"."seas_type" in ('REG') group by "fantasy_points_plays"."week", "fantasy_points_plays"."year", "fantasy_points_plays"."pid") select "player"."pid", player.fname, player.lname, "t8014f8a06d79a892dee5716760861411"."v" AS "player_keeptradecut_value_0", "t5c9d05b7fad29279ca31c0a7159f3276"."fantasy_points_from_plays" AS "fantasy_points_from_plays_0", "player_years"."year", "player_years_weeks"."week", "player"."pos" from "player_years_weeks" inner join "player" on "player"."pid" = "player_years_weeks"."pid" inner join "player_years" on "player_years"."pid" = "player"."pid" and "player_years"."year" = "player_years_weeks"."year" left join "opening_days" on "opening_days"."year" = "player_years"."year" left join "nfl_year_week_timestamp" on "nfl_year_week_timestamp"."year" = "player_years_weeks"."year" and "nfl_year_week_timestamp"."week" = "player_years_weeks"."week" inner join "keeptradecut_rankings" as "t8014f8a06d79a892dee5716760861411" on "t8014f8a06d79a892dee5716760861411"."pid" = "player"."pid" and "t8014f8a06d79a892dee5716760861411"."qb" = 2 and "t8014f8a06d79a892dee5716760861411"."type" = 1 and "t8014f8a06d79a892dee5716760861411"."d" = "nfl_year_week_timestamp"."week_timestamp" left join "t5c9d05b7fad29279ca31c0a7159f3276" on "t5c9d05b7fad29279ca31c0a7159f3276"."pid" = "player"."pid" and t5c9d05b7fad29279ca31c0a7159f3276.year = player_years_weeks.year and t5c9d05b7fad29279ca31c0a7159f3276.week = player_years_weeks.week where player.pos IN ('WR') group by player.fname, player.lname, "t8014f8a06d79a892dee5716760861411"."v", "t5c9d05b7fad29279ca31c0a7159f3276"."fantasy_points_from_plays", "player_years"."year", "player_years_weeks"."week", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 4 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(six_hours)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('should create a query for fantasy points from plays with specific route, weeks, rate type, and player filters', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      columns: [
        {
          column_id: 'player_fantasy_points_from_plays',
          params: {
            route_ngs: ['GO'],
            week: [
              1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
              20, 21
            ],
            rate_type: ['per_game'],
            year: [2023]
          }
        }
      ],
      sort: [],
      where: [
        {
          column_id: 'player_position',
          operator: 'IN',
          value: ['WR']
        },
        {
          column_id: 'player_name',
          operator: '=',
          value: 'Stefon Diggs'
        }
      ],
      prefix_columns: ['player_name'],
      splits: ['year']
    })
    const expected_query = `with "base_years" as (SELECT unnest(ARRAY[2023]) as year), "player_years" as (SELECT DISTINCT player.pid, base_years.year FROM player CROSS JOIN base_years), "tf05c94ab7652228403254cd474a53270" as (select "player_gamelogs"."pid", count(*) as "rate_type_total_count", array_agg(distinct player_gamelogs.tm) as teams, "nfl_games"."year" from "player_gamelogs" left join "nfl_games" on "nfl_games"."esbid" = "player_gamelogs"."esbid" where "nfl_games"."seas_type" in ('REG') and "player_gamelogs"."active" = true and "nfl_games"."year" in (2023) and "nfl_games"."week" in (1, 10, 11, 12, 13, 14, 15, 16, 17, 18, 2, 3, 4, 5, 6, 7, 8, 9) group by "nfl_games"."year", "player_gamelogs"."pid"), "t24f043c759224e17c364ae0a2ee8ae82" as (select fantasy_points_plays.pid, ROUND(SUM(CASE WHEN pid_type = 'trg' AND comp = true THEN 1 ELSE 0 END + CASE WHEN pid_type IN ('bc', 'trg') THEN COALESCE(rush_yds, 0) + COALESCE(recv_yds, 0) ELSE 0 END * 0.1 + CASE WHEN pid_type = 'psr' THEN COALESCE(pass_yds, 0) ELSE 0 END * 0.04 + CASE WHEN pid_type = 'bc' AND rush_td = true THEN 6 WHEN pid_type = 'trg' AND pass_td = true THEN 6 WHEN pid_type = 'psr' AND pass_td = true THEN 4 ELSE 0 END + CASE WHEN pid_type = 'psr' AND int = true THEN -1 ELSE 0 END + CASE WHEN pid_type = 'fuml' THEN -1 ELSE 0 END), 2) as fantasy_points_from_plays, "fantasy_points_plays"."year" from (select bc_pid as pid, 'bc' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year, route_ngs, week from "nfl_plays" where "bc_pid" is not null union all select psr_pid as pid, 'psr' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year, route_ngs, week from "nfl_plays" where "psr_pid" is not null union all select trg_pid as pid, 'trg' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year, route_ngs, week from "nfl_plays" where "trg_pid" is not null union all select player_fuml_pid as pid, 'fuml' as pid_type, NULL as rush_yds, NULL as recv_yds, NULL as rush_td, NULL as td, NULL as comp, NULL as int, NULL as pass_yds, NULL as pass_td, play_type, seas_type, year, route_ngs, week from "nfl_plays" where "player_fuml_pid" is not null) as "fantasy_points_plays" where not "play_type" = 'NOPL' and "fantasy_points_plays"."year" in (2023) and "fantasy_points_plays"."week" in (1, 10, 11, 12, 13, 14, 15, 16, 17, 18, 2, 3, 4, 5, 6, 7, 8, 9) and "fantasy_points_plays"."seas_type" in ('REG') and "fantasy_points_plays"."route_ngs" in ('GO') group by "fantasy_points_plays"."year", "fantasy_points_plays"."pid") select "player"."pid", player.fname, player.lname, CAST(t24f043c759224e17c364ae0a2ee8ae82.fantasy_points_from_plays AS DECIMAL) / NULLIF(CAST(tf05c94ab7652228403254cd474a53270.rate_type_total_count AS DECIMAL), 0) AS "fantasy_points_from_plays_0", "player_years"."year", "player"."pos" from "player_years" inner join "player" on "player"."pid" = "player_years"."pid" left join "tf05c94ab7652228403254cd474a53270" on "tf05c94ab7652228403254cd474a53270"."pid" = "player"."pid" and "tf05c94ab7652228403254cd474a53270"."year" = 2023 left join "t24f043c759224e17c364ae0a2ee8ae82" on "t24f043c759224e17c364ae0a2ee8ae82"."pid" = "player"."pid" and "t24f043c759224e17c364ae0a2ee8ae82"."year" = 2023 where player.pos IN ('WR') AND player.fname || ' ' || player.lname = 'Stefon Diggs' group by player.fname, player.lname, "t24f043c759224e17c364ae0a2ee8ae82"."fantasy_points_from_plays", tf05c94ab7652228403254cd474a53270.rate_type_total_count, "player_years"."year", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(one_week)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('year split query with player age and ktc value, tests the order in which year split tables are joined', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      columns: [
        'player_age',
        {
          column_id: 'player_fantasy_points_per_game_from_seasonlogs',
          params: {
            year: [2023, 2022, 2021, 2020, 2019, 2018, 2017]
          }
        },
        {
          column_id: 'player_weighted_opportunity_rating_from_plays',
          params: {
            year: [2023, 2022, 2021, 2020, 2019, 2018]
          }
        },
        'player_espn_overall_score',
        'player_keeptradecut_value'
      ],
      sort: [
        {
          column_id: 'player_fantasy_points_per_game_from_seasonlogs',
          desc: true,
          column_index: 0
        }
      ],
      where: [
        {
          column_id: 'player_position',
          operator: 'IN',
          value: ['WR']
        }
      ],
      prefix_columns: ['player_name'],
      splits: ['year']
    })
    const expected_query = `with "base_years" as (SELECT unnest(ARRAY[2017,2018,2019,2020,2021,2022,2023]) as year), "player_years" as (SELECT DISTINCT player.pid, base_years.year FROM player CROSS JOIN base_years), "td39c8430c6b71a1d059ec34d508f2710" as (select "pg"."pid", ROUND((1.5 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / NULLIF(SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END), 0)) + (0.7 * SUM(CASE WHEN nfl_plays.trg_pid = pg.pid THEN nfl_plays.dot ELSE 0 END) / NULLIF(SUM(nfl_plays.dot), 0)), 4) as weighted_opp_rating_from_plays, "nfl_plays"."year" from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and ("trg_pid" is not null) and "nfl_plays"."year" in (2018, 2019, 2020, 2021, 2022, 2023) and "nfl_plays"."seas_type" in ('REG') group by "pg"."pid", "nfl_plays"."year") select "player"."pid", player.fname, player.lname, "t8a4a84e735183537b2ba13726efd3e32"."points_per_game" AS "points_per_game_from_seasonlogs_0", "td39c8430c6b71a1d059ec34d508f2710"."weighted_opp_rating_from_plays" AS "weighted_opp_rating_from_plays_0", "player_seasonlogs"."espn_overall_score" AS "espn_overall_score_0", "tf2c4b095a714eac7d86ea8780f70ad1a"."v" AS "player_keeptradecut_value_0", CASE WHEN player.dob IS NULL OR player.dob = '0000-00-00' THEN NULL ELSE ROUND(EXTRACT(YEAR FROM AGE(opening_days.opening_day, TO_DATE(player.dob, 'YYYY-MM-DD'))) + (EXTRACT(MONTH FROM AGE(opening_days.opening_day, TO_DATE(player.dob, 'YYYY-MM-DD'))) / 12.0) + (EXTRACT(DAY FROM AGE(opening_days.opening_day, TO_DATE(player.dob, 'YYYY-MM-DD'))) / 365.25), 2) END as age_0, "player_years"."year", "player"."pos" from "player_years" inner join "player" on "player"."pid" = "player_years"."pid" left join "scoring_format_player_seasonlogs" as "t8a4a84e735183537b2ba13726efd3e32" on "t8a4a84e735183537b2ba13726efd3e32"."pid" = "player"."pid" and t8a4a84e735183537b2ba13726efd3e32.year = player_years.year and t8a4a84e735183537b2ba13726efd3e32.year IN (2023,2022,2021,2020,2019,2018,2017) and t8a4a84e735183537b2ba13726efd3e32.scoring_format_hash = '0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d' left join "td39c8430c6b71a1d059ec34d508f2710" on "td39c8430c6b71a1d059ec34d508f2710"."pid" = "player"."pid" and td39c8430c6b71a1d059ec34d508f2710.year = player_years.year and td39c8430c6b71a1d059ec34d508f2710.year IN (2018,2019,2020,2021,2022,2023) left join "player_seasonlogs" on "player_seasonlogs"."pid" = "player"."pid" and player_seasonlogs.year = player_years.year and "player_seasonlogs"."seas_type" = 'REG' left join "opening_days" on "opening_days"."year" = "player_years"."year" left join "keeptradecut_rankings" as "tf2c4b095a714eac7d86ea8780f70ad1a" on "tf2c4b095a714eac7d86ea8780f70ad1a"."pid" = "player"."pid" and "tf2c4b095a714eac7d86ea8780f70ad1a"."qb" = 2 and "tf2c4b095a714eac7d86ea8780f70ad1a"."type" = 1 and "tf2c4b095a714eac7d86ea8780f70ad1a"."d" = EXTRACT(EPOCH FROM (date_trunc('day', opening_days.opening_day) + interval '0 year'))::integer and opening_days.year = (player_years.year) where player.pos IN ('WR') group by player.fname, player.lname, "t8a4a84e735183537b2ba13726efd3e32"."points_per_game", "td39c8430c6b71a1d059ec34d508f2710"."weighted_opp_rating_from_plays", "player_seasonlogs"."espn_overall_score", "tf2c4b095a714eac7d86ea8780f70ad1a"."v", player.dob, opening_days.opening_day, "player_years"."year", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 4 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(six_hours)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('year splits with sort by age', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      columns: [
        'player_age',
        'player_ngs_draft_grade',
        {
          column_id: 'player_weighted_opportunity_rating_from_plays',
          params: {
            year: [2023, 2022, 2021, 2020, 2019, 2018, 2017]
          }
        },
        'player_espn_overall_score'
      ],
      sort: [
        {
          column_id: 'player_age',
          desc: true
        }
      ],
      where: [
        {
          column_id: 'player_position',
          operator: 'IN',
          value: ['WR']
        }
      ],
      prefix_columns: ['player_name'],
      splits: ['year']
    })
    const expected_query = `with "base_years" as (SELECT unnest(ARRAY[2017,2018,2019,2020,2021,2022,2023]) as year), "player_years" as (SELECT DISTINCT player.pid, base_years.year FROM player CROSS JOIN base_years), "t4530f8545d18b50db01ac75501e7bf42" as (select "pg"."pid", ROUND((1.5 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / NULLIF(SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END), 0)) + (0.7 * SUM(CASE WHEN nfl_plays.trg_pid = pg.pid THEN nfl_plays.dot ELSE 0 END) / NULLIF(SUM(nfl_plays.dot), 0)), 4) as weighted_opp_rating_from_plays, "nfl_plays"."year" from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and ("trg_pid" is not null) and "nfl_plays"."year" in (2017, 2018, 2019, 2020, 2021, 2022, 2023) and "nfl_plays"."seas_type" in ('REG') group by "pg"."pid", "nfl_plays"."year") select "player"."pid", player.fname, player.lname, "player"."ngs_draft_grade" AS "ngs_draft_grade_0", "t4530f8545d18b50db01ac75501e7bf42"."weighted_opp_rating_from_plays" AS "weighted_opp_rating_from_plays_0", "player_seasonlogs"."espn_overall_score" AS "espn_overall_score_0", CASE WHEN player.dob IS NULL OR player.dob = '0000-00-00' THEN NULL ELSE ROUND(EXTRACT(YEAR FROM AGE(opening_days.opening_day, TO_DATE(player.dob, 'YYYY-MM-DD'))) + (EXTRACT(MONTH FROM AGE(opening_days.opening_day, TO_DATE(player.dob, 'YYYY-MM-DD'))) / 12.0) + (EXTRACT(DAY FROM AGE(opening_days.opening_day, TO_DATE(player.dob, 'YYYY-MM-DD'))) / 365.25), 2) END as age_0, "player_years"."year", "player"."pos" from "player_years" inner join "player" on "player"."pid" = "player_years"."pid" left join "t4530f8545d18b50db01ac75501e7bf42" on "t4530f8545d18b50db01ac75501e7bf42"."pid" = "player"."pid" and t4530f8545d18b50db01ac75501e7bf42.year = player_years.year and t4530f8545d18b50db01ac75501e7bf42.year IN (2017,2018,2019,2020,2021,2022,2023) left join "player_seasonlogs" on "player_seasonlogs"."pid" = "player"."pid" and player_seasonlogs.year = player_years.year and "player_seasonlogs"."seas_type" = 'REG' left join "opening_days" on "opening_days"."year" = "player_years"."year" where player.pos IN ('WR') group by player.fname, player.lname, "player"."ngs_draft_grade", "t4530f8545d18b50db01ac75501e7bf42"."weighted_opp_rating_from_plays", "player_seasonlogs"."espn_overall_score", player.dob, opening_days.opening_day, "player_years"."year", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 7 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(six_hours)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('should query WR fantasy stats with year splits and sort by points per game, seasonlogs, careerlogs, plays, and keeptradecut', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      columns: [
        {
          column_id: 'player_fantasy_points_per_game_from_seasonlogs',
          params: {
            year: [2023, 2022, 2021, 2020, 2019, 2018, 2017]
          }
        },
        {
          column_id: 'player_weighted_opportunity_rating_from_plays',
          params: {
            year: [2023, 2022, 2021, 2020, 2019, 2018]
          }
        },
        'player_espn_overall_score',
        {
          column_id: 'player_keeptradecut_value',
          params: {
            year_offset: 1
          }
        }
      ],
      sort: [
        {
          column_id: 'player_fantasy_points_per_game_from_seasonlogs',
          desc: true,
          column_index: 0
        }
      ],
      where: [
        {
          column_id: 'player_position',
          operator: 'IN',
          value: ['WR']
        }
      ],
      prefix_columns: ['player_name'],
      splits: ['year']
    })
    const expected_query = `with "base_years" as (SELECT unnest(ARRAY[2017,2018,2019,2020,2021,2022,2023,2024]) as year), "player_years" as (SELECT DISTINCT player.pid, base_years.year FROM player CROSS JOIN base_years), "t92592427c8681c2f735f98a0e8fd6132" as (select "pg"."pid", ROUND((1.5 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / NULLIF(SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END), 0)) + (0.7 * SUM(CASE WHEN nfl_plays.trg_pid = pg.pid THEN nfl_plays.dot ELSE 0 END) / NULLIF(SUM(nfl_plays.dot), 0)), 4) as weighted_opp_rating_from_plays, "nfl_plays"."year" from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and ("trg_pid" is not null) and "nfl_plays"."year" in (2018, 2019, 2020, 2021, 2022, 2023) and "nfl_plays"."seas_type" in ('REG') group by "pg"."pid", "nfl_plays"."year") select "player"."pid", player.fname, player.lname, "t8a4a84e735183537b2ba13726efd3e32"."points_per_game" AS "points_per_game_from_seasonlogs_0", "t92592427c8681c2f735f98a0e8fd6132"."weighted_opp_rating_from_plays" AS "weighted_opp_rating_from_plays_0", "player_seasonlogs"."espn_overall_score" AS "espn_overall_score_0", "t95d728bf530769e3ed5859fbedf01162"."v" AS "player_keeptradecut_value_0", "player_years"."year", "player"."pos" from "player_years" inner join "player" on "player"."pid" = "player_years"."pid" left join "scoring_format_player_seasonlogs" as "t8a4a84e735183537b2ba13726efd3e32" on "t8a4a84e735183537b2ba13726efd3e32"."pid" = "player"."pid" and t8a4a84e735183537b2ba13726efd3e32.year = player_years.year and t8a4a84e735183537b2ba13726efd3e32.year IN (2023,2022,2021,2020,2019,2018,2017) and t8a4a84e735183537b2ba13726efd3e32.scoring_format_hash = '0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d' left join "t92592427c8681c2f735f98a0e8fd6132" on "t92592427c8681c2f735f98a0e8fd6132"."pid" = "player"."pid" and t92592427c8681c2f735f98a0e8fd6132.year = player_years.year and t92592427c8681c2f735f98a0e8fd6132.year IN (2018,2019,2020,2021,2022,2023) left join "player_seasonlogs" on "player_seasonlogs"."pid" = "player"."pid" and player_seasonlogs.year = player_years.year and "player_seasonlogs"."seas_type" = 'REG' left join "opening_days" on "opening_days"."year" = "player_years"."year" left join "keeptradecut_rankings" as "t95d728bf530769e3ed5859fbedf01162" on "t95d728bf530769e3ed5859fbedf01162"."pid" = "player"."pid" and "t95d728bf530769e3ed5859fbedf01162"."qb" = 2 and "t95d728bf530769e3ed5859fbedf01162"."type" = 1 and "t95d728bf530769e3ed5859fbedf01162"."d" = EXTRACT(EPOCH FROM (date_trunc('day', opening_days.opening_day) + interval '1 year'))::integer and opening_days.year = (player_years.year) where player.pos IN ('WR') group by player.fname, player.lname, "t8a4a84e735183537b2ba13726efd3e32"."points_per_game", "t92592427c8681c2f735f98a0e8fd6132"."weighted_opp_rating_from_plays", "player_seasonlogs"."espn_overall_score", "t95d728bf530769e3ed5859fbedf01162"."v", "player_years"."year", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 4 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(six_hours)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('test condition for scoring_format_hash param, multiple fantasy points from play', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      columns: [
        {
          column_id: 'player_fantasy_points_per_game_from_seasonlogs',
          params: {
            year: [2023],
            scoring_format_hash: [
              'ad64bf40cdfec0a1ebdf66453fa57687832f7556f3870251c044d5d270fc089e'
            ]
          }
        },
        {
          column_id: 'player_fantasy_points_from_plays',
          params: {
            year: [2023],
            rate_type: ['per_game'],
            week: [1, 2, 3, 4, 5, 6, 7, 8],
            scoring_format_hash: [
              'ad64bf40cdfec0a1ebdf66453fa57687832f7556f3870251c044d5d270fc089e'
            ]
          }
        },
        {
          column_id: 'player_fantasy_points_from_plays',
          params: {
            year: [2023],
            rate_type: ['per_game'],
            week: [9, 10, 11, 12, 13, 14, 15, 16, 17],
            scoring_format_hash: [
              'ad64bf40cdfec0a1ebdf66453fa57687832f7556f3870251c044d5d270fc089e'
            ]
          }
        }
      ],
      sort: [
        {
          column_id: 'player_fantasy_points_per_game_from_seasonlogs',
          desc: true,
          column_index: 0
        }
      ],
      where: [
        {
          column_id: 'player_position',
          operator: 'IN',
          value: ['WR']
        },
        {
          column_id: 'player_fantasy_points_per_game_from_seasonlogs',
          operator: '>',
          value: '0',
          params: {
            scoring_format_hash: [
              'ad64bf40cdfec0a1ebdf66453fa57687832f7556f3870251c044d5d270fc089e'
            ]
          }
        }
      ],
      prefix_columns: ['player_name'],
      splits: ['year']
    })
    const expected_query = `with "base_years" as (SELECT unnest(ARRAY[2023]) as year), "player_years" as (SELECT DISTINCT player.pid, base_years.year FROM player CROSS JOIN base_years), "t5b9e70826eb3b3cc895b2fe087437494" as (select "player_gamelogs"."pid", count(*) as "rate_type_total_count", array_agg(distinct player_gamelogs.tm) as teams, "nfl_games"."year" from "player_gamelogs" left join "nfl_games" on "nfl_games"."esbid" = "player_gamelogs"."esbid" where "nfl_games"."seas_type" in ('REG') and "player_gamelogs"."active" = true and "nfl_games"."year" in (2023) and "nfl_games"."week" in (1, 2, 3, 4, 5, 6, 7, 8) group by "nfl_games"."year", "player_gamelogs"."pid"), "t5ef5e41e660b629c50b6d0045057d5a9" as (select "player_gamelogs"."pid", count(*) as "rate_type_total_count", array_agg(distinct player_gamelogs.tm) as teams, "nfl_games"."year" from "player_gamelogs" left join "nfl_games" on "nfl_games"."esbid" = "player_gamelogs"."esbid" where "nfl_games"."seas_type" in ('REG') and "player_gamelogs"."active" = true and "nfl_games"."year" in (2023) and "nfl_games"."week" in (10, 11, 12, 13, 14, 15, 16, 17, 9) group by "nfl_games"."year", "player_gamelogs"."pid"), "tf46bbf00556acbb0154f600a097379a4" as (select fantasy_points_plays.pid, ROUND(SUM(CASE WHEN pid_type = 'trg' AND comp = true THEN 1 ELSE 0 END + CASE WHEN pid_type IN ('bc', 'trg') THEN COALESCE(rush_yds, 0) + COALESCE(recv_yds, 0) ELSE 0 END * 0.1 + CASE WHEN pid_type = 'psr' THEN COALESCE(pass_yds, 0) ELSE 0 END * 0.04 + CASE WHEN pid_type = 'bc' AND rush_td = true THEN 6 WHEN pid_type = 'trg' AND pass_td = true THEN 6 WHEN pid_type = 'psr' AND pass_td = true THEN 4 ELSE 0 END + CASE WHEN pid_type = 'psr' AND int = true THEN -1 ELSE 0 END + CASE WHEN pid_type = 'fuml' THEN -1 ELSE 0 END), 2) as fantasy_points_from_plays, "fantasy_points_plays"."year" from (select bc_pid as pid, 'bc' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year, week from "nfl_plays" where "bc_pid" is not null union all select psr_pid as pid, 'psr' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year, week from "nfl_plays" where "psr_pid" is not null union all select trg_pid as pid, 'trg' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year, week from "nfl_plays" where "trg_pid" is not null union all select player_fuml_pid as pid, 'fuml' as pid_type, NULL as rush_yds, NULL as recv_yds, NULL as rush_td, NULL as td, NULL as comp, NULL as int, NULL as pass_yds, NULL as pass_td, play_type, seas_type, year, week from "nfl_plays" where "player_fuml_pid" is not null) as "fantasy_points_plays" where not "play_type" = 'NOPL' and "fantasy_points_plays"."year" in (2023) and "fantasy_points_plays"."week" in (1, 2, 3, 4, 5, 6, 7, 8) and "fantasy_points_plays"."seas_type" in ('REG') group by "fantasy_points_plays"."year", "fantasy_points_plays"."pid"), "tc34e588907df77df27c440c48f4de6c4" as (select fantasy_points_plays.pid, ROUND(SUM(CASE WHEN pid_type = 'trg' AND comp = true THEN 1 ELSE 0 END + CASE WHEN pid_type IN ('bc', 'trg') THEN COALESCE(rush_yds, 0) + COALESCE(recv_yds, 0) ELSE 0 END * 0.1 + CASE WHEN pid_type = 'psr' THEN COALESCE(pass_yds, 0) ELSE 0 END * 0.04 + CASE WHEN pid_type = 'bc' AND rush_td = true THEN 6 WHEN pid_type = 'trg' AND pass_td = true THEN 6 WHEN pid_type = 'psr' AND pass_td = true THEN 4 ELSE 0 END + CASE WHEN pid_type = 'psr' AND int = true THEN -1 ELSE 0 END + CASE WHEN pid_type = 'fuml' THEN -1 ELSE 0 END), 2) as fantasy_points_from_plays, "fantasy_points_plays"."year" from (select bc_pid as pid, 'bc' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year, week from "nfl_plays" where "bc_pid" is not null union all select psr_pid as pid, 'psr' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year, week from "nfl_plays" where "psr_pid" is not null union all select trg_pid as pid, 'trg' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year, week from "nfl_plays" where "trg_pid" is not null union all select player_fuml_pid as pid, 'fuml' as pid_type, NULL as rush_yds, NULL as recv_yds, NULL as rush_td, NULL as td, NULL as comp, NULL as int, NULL as pass_yds, NULL as pass_td, play_type, seas_type, year, week from "nfl_plays" where "player_fuml_pid" is not null) as "fantasy_points_plays" where not "play_type" = 'NOPL' and "fantasy_points_plays"."year" in (2023) and "fantasy_points_plays"."week" in (10, 11, 12, 13, 14, 15, 16, 17, 9) and "fantasy_points_plays"."seas_type" in ('REG') group by "fantasy_points_plays"."year", "fantasy_points_plays"."pid") select "player"."pid", player.fname, player.lname, "tb9b614943131b9f2cbe8a4753294dfcb"."points_per_game" AS "points_per_game_from_seasonlogs_0", CAST(tf46bbf00556acbb0154f600a097379a4.fantasy_points_from_plays AS DECIMAL) / NULLIF(CAST(t5b9e70826eb3b3cc895b2fe087437494.rate_type_total_count AS DECIMAL), 0) AS "fantasy_points_from_plays_0", CAST(tc34e588907df77df27c440c48f4de6c4.fantasy_points_from_plays AS DECIMAL) / NULLIF(CAST(t5ef5e41e660b629c50b6d0045057d5a9.rate_type_total_count AS DECIMAL), 0) AS "fantasy_points_from_plays_1", "player_years"."year", "player"."pos" from "player_years" inner join "player" on "player"."pid" = "player_years"."pid" left join "t5b9e70826eb3b3cc895b2fe087437494" on "t5b9e70826eb3b3cc895b2fe087437494"."pid" = "player"."pid" and "t5b9e70826eb3b3cc895b2fe087437494"."year" = 2023 left join "t5ef5e41e660b629c50b6d0045057d5a9" on "t5ef5e41e660b629c50b6d0045057d5a9"."pid" = "player"."pid" and "t5ef5e41e660b629c50b6d0045057d5a9"."year" = 2023 inner join "scoring_format_player_seasonlogs" as "t363940a466a7e5e5b4624ffc010a5ebd" on "t363940a466a7e5e5b4624ffc010a5ebd"."pid" = "player"."pid" and t363940a466a7e5e5b4624ffc010a5ebd.year = player_years.year and t363940a466a7e5e5b4624ffc010a5ebd.scoring_format_hash = 'ad64bf40cdfec0a1ebdf66453fa57687832f7556f3870251c044d5d270fc089e' left join "scoring_format_player_seasonlogs" as "tb9b614943131b9f2cbe8a4753294dfcb" on "tb9b614943131b9f2cbe8a4753294dfcb"."pid" = "player"."pid" and "tb9b614943131b9f2cbe8a4753294dfcb"."year" = 2023 and tb9b614943131b9f2cbe8a4753294dfcb.scoring_format_hash = 'ad64bf40cdfec0a1ebdf66453fa57687832f7556f3870251c044d5d270fc089e' left join "tf46bbf00556acbb0154f600a097379a4" on "tf46bbf00556acbb0154f600a097379a4"."pid" = "player"."pid" and "tf46bbf00556acbb0154f600a097379a4"."year" = 2023 left join "tc34e588907df77df27c440c48f4de6c4" on "tc34e588907df77df27c440c48f4de6c4"."pid" = "player"."pid" and "tc34e588907df77df27c440c48f4de6c4"."year" = 2023 where player.pos IN ('WR') and t363940a466a7e5e5b4624ffc010a5ebd.points_per_game > '0' group by player.fname, player.lname, "tb9b614943131b9f2cbe8a4753294dfcb"."points_per_game", "tf46bbf00556acbb0154f600a097379a4"."fantasy_points_from_plays", t5b9e70826eb3b3cc895b2fe087437494.rate_type_total_count, "tc34e588907df77df27c440c48f4de6c4"."fantasy_points_from_plays", t5ef5e41e660b629c50b6d0045057d5a9.rate_type_total_count, "player_years"."year", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 4 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(six_hours)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('year split with multiple rate type with statements', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      columns: [
        'player_fantasy_points_per_game_from_seasonlogs',
        {
          column_id: 'player_fantasy_points_from_plays',
          params: {
            year: [2023, 2022, 2021, 2020],
            rate_type: ['per_game'],
            week: [1, 2, 3, 4, 5, 6, 7, 8]
          }
        },
        {
          column_id: 'player_fantasy_points_from_plays',
          params: {
            year: [2023, 2022, 2021, 2020],
            rate_type: ['per_game'],
            week: [9, 10, 11, 12, 13, 14, 15, 16, 17]
          }
        }
      ],
      sort: [
        {
          column_id: 'player_fantasy_points_per_game_from_seasonlogs',
          desc: true,
          column_index: 0
        }
      ],
      where: [
        {
          column_id: 'player_position',
          operator: 'IN',
          value: ['WR']
        }
      ],
      prefix_columns: ['player_name'],
      splits: ['year']
    })
    const expected_query = `with "base_years" as (SELECT unnest(ARRAY[2020,2021,2022,2023]) as year), "player_years" as (SELECT DISTINCT player.pid, base_years.year FROM player CROSS JOIN base_years), "t5886eb6c74f7edc1dd4c6f28d3b2c9f9" as (select "player_gamelogs"."pid", count(*) as "rate_type_total_count", array_agg(distinct player_gamelogs.tm) as teams, "nfl_games"."year" from "player_gamelogs" left join "nfl_games" on "nfl_games"."esbid" = "player_gamelogs"."esbid" where "nfl_games"."seas_type" in ('REG') and "player_gamelogs"."active" = true and "nfl_games"."year" in (2020, 2021, 2022, 2023) and "nfl_games"."week" in (1, 2, 3, 4, 5, 6, 7, 8) group by "nfl_games"."year", "player_gamelogs"."pid"), "t2bdbf89f6d96494dc3241defe7673e45" as (select "player_gamelogs"."pid", count(*) as "rate_type_total_count", array_agg(distinct player_gamelogs.tm) as teams, "nfl_games"."year" from "player_gamelogs" left join "nfl_games" on "nfl_games"."esbid" = "player_gamelogs"."esbid" where "nfl_games"."seas_type" in ('REG') and "player_gamelogs"."active" = true and "nfl_games"."year" in (2020, 2021, 2022, 2023) and "nfl_games"."week" in (10, 11, 12, 13, 14, 15, 16, 17, 9) group by "nfl_games"."year", "player_gamelogs"."pid"), "t7da43cbc6d28ffa15a646b84bc52969e" as (select fantasy_points_plays.pid, ROUND(SUM(CASE WHEN pid_type = 'trg' AND comp = true THEN 1 ELSE 0 END + CASE WHEN pid_type IN ('bc', 'trg') THEN COALESCE(rush_yds, 0) + COALESCE(recv_yds, 0) ELSE 0 END * 0.1 + CASE WHEN pid_type = 'psr' THEN COALESCE(pass_yds, 0) ELSE 0 END * 0.04 + CASE WHEN pid_type = 'bc' AND rush_td = true THEN 6 WHEN pid_type = 'trg' AND pass_td = true THEN 6 WHEN pid_type = 'psr' AND pass_td = true THEN 4 ELSE 0 END + CASE WHEN pid_type = 'psr' AND int = true THEN -1 ELSE 0 END + CASE WHEN pid_type = 'fuml' THEN -1 ELSE 0 END), 2) as fantasy_points_from_plays, "fantasy_points_plays"."year" from (select bc_pid as pid, 'bc' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year, week from "nfl_plays" where "bc_pid" is not null union all select psr_pid as pid, 'psr' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year, week from "nfl_plays" where "psr_pid" is not null union all select trg_pid as pid, 'trg' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year, week from "nfl_plays" where "trg_pid" is not null union all select player_fuml_pid as pid, 'fuml' as pid_type, NULL as rush_yds, NULL as recv_yds, NULL as rush_td, NULL as td, NULL as comp, NULL as int, NULL as pass_yds, NULL as pass_td, play_type, seas_type, year, week from "nfl_plays" where "player_fuml_pid" is not null) as "fantasy_points_plays" where not "play_type" = 'NOPL' and "fantasy_points_plays"."year" in (2020, 2021, 2022, 2023) and "fantasy_points_plays"."week" in (1, 2, 3, 4, 5, 6, 7, 8) and "fantasy_points_plays"."seas_type" in ('REG') group by "fantasy_points_plays"."year", "fantasy_points_plays"."pid"), "tf51da2d20babfb3b384a6834dcd61381" as (select fantasy_points_plays.pid, ROUND(SUM(CASE WHEN pid_type = 'trg' AND comp = true THEN 1 ELSE 0 END + CASE WHEN pid_type IN ('bc', 'trg') THEN COALESCE(rush_yds, 0) + COALESCE(recv_yds, 0) ELSE 0 END * 0.1 + CASE WHEN pid_type = 'psr' THEN COALESCE(pass_yds, 0) ELSE 0 END * 0.04 + CASE WHEN pid_type = 'bc' AND rush_td = true THEN 6 WHEN pid_type = 'trg' AND pass_td = true THEN 6 WHEN pid_type = 'psr' AND pass_td = true THEN 4 ELSE 0 END + CASE WHEN pid_type = 'psr' AND int = true THEN -1 ELSE 0 END + CASE WHEN pid_type = 'fuml' THEN -1 ELSE 0 END), 2) as fantasy_points_from_plays, "fantasy_points_plays"."year" from (select bc_pid as pid, 'bc' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year, week from "nfl_plays" where "bc_pid" is not null union all select psr_pid as pid, 'psr' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year, week from "nfl_plays" where "psr_pid" is not null union all select trg_pid as pid, 'trg' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year, week from "nfl_plays" where "trg_pid" is not null union all select player_fuml_pid as pid, 'fuml' as pid_type, NULL as rush_yds, NULL as recv_yds, NULL as rush_td, NULL as td, NULL as comp, NULL as int, NULL as pass_yds, NULL as pass_td, play_type, seas_type, year, week from "nfl_plays" where "player_fuml_pid" is not null) as "fantasy_points_plays" where not "play_type" = 'NOPL' and "fantasy_points_plays"."year" in (2020, 2021, 2022, 2023) and "fantasy_points_plays"."week" in (10, 11, 12, 13, 14, 15, 16, 17, 9) and "fantasy_points_plays"."seas_type" in ('REG') group by "fantasy_points_plays"."year", "fantasy_points_plays"."pid") select "player"."pid", player.fname, player.lname, "t154eac9f9dbf17872b2f79e5a75b67cc"."points_per_game" AS "points_per_game_from_seasonlogs_0", CAST(t7da43cbc6d28ffa15a646b84bc52969e.fantasy_points_from_plays AS DECIMAL) / NULLIF(CAST(t5886eb6c74f7edc1dd4c6f28d3b2c9f9.rate_type_total_count AS DECIMAL), 0) AS "fantasy_points_from_plays_0", CAST(tf51da2d20babfb3b384a6834dcd61381.fantasy_points_from_plays AS DECIMAL) / NULLIF(CAST(t2bdbf89f6d96494dc3241defe7673e45.rate_type_total_count AS DECIMAL), 0) AS "fantasy_points_from_plays_1", "player_years"."year", "player"."pos" from "player_years" inner join "player" on "player"."pid" = "player_years"."pid" left join "t5886eb6c74f7edc1dd4c6f28d3b2c9f9" on "t5886eb6c74f7edc1dd4c6f28d3b2c9f9"."pid" = "player"."pid" and "t5886eb6c74f7edc1dd4c6f28d3b2c9f9"."year" = "player_years"."year" left join "t2bdbf89f6d96494dc3241defe7673e45" on "t2bdbf89f6d96494dc3241defe7673e45"."pid" = "player"."pid" and "t2bdbf89f6d96494dc3241defe7673e45"."year" = "player_years"."year" left join "scoring_format_player_seasonlogs" as "t154eac9f9dbf17872b2f79e5a75b67cc" on "t154eac9f9dbf17872b2f79e5a75b67cc"."pid" = "player"."pid" and t154eac9f9dbf17872b2f79e5a75b67cc.year = player_years.year and t154eac9f9dbf17872b2f79e5a75b67cc.scoring_format_hash = '0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d' left join "t7da43cbc6d28ffa15a646b84bc52969e" on "t7da43cbc6d28ffa15a646b84bc52969e"."pid" = "player"."pid" and t7da43cbc6d28ffa15a646b84bc52969e.year = player_years.year and t7da43cbc6d28ffa15a646b84bc52969e.year IN (2020,2021,2022,2023) left join "tf51da2d20babfb3b384a6834dcd61381" on "tf51da2d20babfb3b384a6834dcd61381"."pid" = "player"."pid" and tf51da2d20babfb3b384a6834dcd61381.year = player_years.year and tf51da2d20babfb3b384a6834dcd61381.year IN (2020,2021,2022,2023) where player.pos IN ('WR') group by player.fname, player.lname, "t154eac9f9dbf17872b2f79e5a75b67cc"."points_per_game", "t7da43cbc6d28ffa15a646b84bc52969e"."fantasy_points_from_plays", t5886eb6c74f7edc1dd4c6f28d3b2c9f9.rate_type_total_count, "tf51da2d20babfb3b384a6834dcd61381"."fantasy_points_from_plays", t2bdbf89f6d96494dc3241defe7673e45.rate_type_total_count, "player_years"."year", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 4 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(six_hours)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('keeptradecut and fantasy points from plays with year and week split', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      columns: [
        'player_keeptradecut_value',
        {
          column_id: 'player_fantasy_points_from_plays',
          params: {
            rate_type: ['per_game']
          }
        },
        'player_age'
      ],
      sort: [
        {
          column_id: 'player_keeptradecut_value',
          desc: true
        }
      ],
      where: [
        {
          column_id: 'player_position',
          operator: 'IN',
          value: ['WR']
        }
      ],
      prefix_columns: ['player_name'],
      splits: ['year', 'week']
    })
    const expected_query = `with "base_years" as (SELECT unnest(ARRAY[${all_years}]) as year), "player_years" as (SELECT DISTINCT player.pid, base_years.year FROM player CROSS JOIN base_years), "player_years_weeks" as (SELECT player_years.pid, nfl_year_week_timestamp.year, nfl_year_week_timestamp.week FROM player_years INNER JOIN nfl_year_week_timestamp ON player_years.year = nfl_year_week_timestamp.year), "t5c9d05b7fad29279ca31c0a7159f3276" as (select fantasy_points_plays.pid, ROUND(SUM(CASE WHEN pid_type = 'trg' AND comp = true THEN 1 ELSE 0 END + CASE WHEN pid_type IN ('bc', 'trg') THEN COALESCE(rush_yds, 0) + COALESCE(recv_yds, 0) ELSE 0 END * 0.1 + CASE WHEN pid_type = 'psr' THEN COALESCE(pass_yds, 0) ELSE 0 END * 0.04 + CASE WHEN pid_type = 'bc' AND rush_td = true THEN 6 WHEN pid_type = 'trg' AND pass_td = true THEN 6 WHEN pid_type = 'psr' AND pass_td = true THEN 4 ELSE 0 END + CASE WHEN pid_type = 'psr' AND int = true THEN -1 ELSE 0 END + CASE WHEN pid_type = 'fuml' THEN -1 ELSE 0 END), 2) as fantasy_points_from_plays, "fantasy_points_plays"."week", "fantasy_points_plays"."year" from (select bc_pid as pid, 'bc' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year, week from "nfl_plays" where "bc_pid" is not null union all select psr_pid as pid, 'psr' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year, week from "nfl_plays" where "psr_pid" is not null union all select trg_pid as pid, 'trg' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year, week from "nfl_plays" where "trg_pid" is not null union all select player_fuml_pid as pid, 'fuml' as pid_type, NULL as rush_yds, NULL as recv_yds, NULL as rush_td, NULL as td, NULL as comp, NULL as int, NULL as pass_yds, NULL as pass_td, play_type, seas_type, year, week from "nfl_plays" where "player_fuml_pid" is not null) as "fantasy_points_plays" where not "play_type" = 'NOPL' and "fantasy_points_plays"."seas_type" in ('REG') group by "fantasy_points_plays"."week", "fantasy_points_plays"."year", "fantasy_points_plays"."pid") select "player"."pid", player.fname, player.lname, "t8014f8a06d79a892dee5716760861411"."v" AS "player_keeptradecut_value_0", "t5c9d05b7fad29279ca31c0a7159f3276"."fantasy_points_from_plays" AS "fantasy_points_from_plays_0", CASE WHEN player.dob IS NULL OR player.dob = '0000-00-00' THEN NULL ELSE ROUND(EXTRACT(YEAR FROM AGE(opening_days.opening_day, TO_DATE(player.dob, 'YYYY-MM-DD'))) + (EXTRACT(MONTH FROM AGE(opening_days.opening_day, TO_DATE(player.dob, 'YYYY-MM-DD'))) / 12.0) + (EXTRACT(DAY FROM AGE(opening_days.opening_day, TO_DATE(player.dob, 'YYYY-MM-DD'))) / 365.25), 2) END as age_0, "player_years"."year", "player_years_weeks"."week", "player"."pos" from "player_years_weeks" inner join "player" on "player"."pid" = "player_years_weeks"."pid" inner join "player_years" on "player_years"."pid" = "player"."pid" and "player_years"."year" = "player_years_weeks"."year" left join "opening_days" on "opening_days"."year" = "player_years"."year" left join "nfl_year_week_timestamp" on "nfl_year_week_timestamp"."year" = "player_years_weeks"."year" and "nfl_year_week_timestamp"."week" = "player_years_weeks"."week" inner join "keeptradecut_rankings" as "t8014f8a06d79a892dee5716760861411" on "t8014f8a06d79a892dee5716760861411"."pid" = "player"."pid" and "t8014f8a06d79a892dee5716760861411"."qb" = 2 and "t8014f8a06d79a892dee5716760861411"."type" = 1 and "t8014f8a06d79a892dee5716760861411"."d" = "nfl_year_week_timestamp"."week_timestamp" left join "t5c9d05b7fad29279ca31c0a7159f3276" on "t5c9d05b7fad29279ca31c0a7159f3276"."pid" = "player"."pid" and t5c9d05b7fad29279ca31c0a7159f3276.year = player_years_weeks.year and t5c9d05b7fad29279ca31c0a7159f3276.week = player_years_weeks.week where player.pos IN ('WR') group by player.fname, player.lname, "t8014f8a06d79a892dee5716760861411"."v", "t5c9d05b7fad29279ca31c0a7159f3276"."fantasy_points_from_plays", player.dob, opening_days.opening_day, "player_years"."year", "player_years_weeks"."week", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 4 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(six_hours)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('should adjust specified year params when year_offset is specified', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      columns: [
        {
          column_id: 'player_targets_from_plays',
          params: {
            year: [2023, 2022]
          }
        },
        {
          column_id: 'player_weighted_opportunity_rating_from_plays',
          params: {
            year: [2023, 2022],
            year_offset: -1
          }
        },
        {
          column_id: 'player_weighted_opportunity_rating_from_plays',
          params: {
            year: [2023, 2022],
            year_offset: -1,
            motion: true
          }
        },
        {
          column_id: 'player_weighted_opportunity_rating_from_plays',
          params: {
            year: [2023, 2022],
            year_offset: -1,
            play_action: true
          }
        },
        {
          column_id: 'player_weighted_opportunity_rating_from_plays',
          params: {
            year: [2023, 2022],
            year_offset: -1,
            dwn: [1, 2]
          }
        },
        {
          column_id: 'player_espn_open_score',
          params: {
            year: [2023, 2022]
          }
        }
      ],
      sort: [
        {
          column_id: 'player_targets_from_plays',
          desc: true,
          column_index: 0
        }
      ],
      where: [
        {
          column_id: 'player_position',
          operator: 'IN',
          value: ['WR']
        },
        {
          column_id: 'player_espn_open_score',
          operator: '>',
          value: '0',
          params: {
            year: [2023, 2022]
          }
        }
      ],
      prefix_columns: ['player_name'],
      splits: ['year']
    })
    const expected_query = `with "base_years" as (SELECT unnest(ARRAY[2021,2022,2023]) as year), "player_years" as (SELECT DISTINCT player.pid, base_years.year FROM player CROSS JOIN base_years), "tceaa8fb06891dd60d306661c010a2c75" as (select COALESCE(trg_pid) as pid, "nfl_plays"."year", SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END) as trg_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."year" in (2022, 2023) and "nfl_plays"."seas_type" in ('REG') group by "nfl_plays"."year", COALESCE(trg_pid)), "t3014f563650d123c315bc1f9487d12a0" as (select "pg"."pid", ROUND((1.5 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / NULLIF(SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END), 0)) + (0.7 * SUM(CASE WHEN nfl_plays.trg_pid = pg.pid THEN nfl_plays.dot ELSE 0 END) / NULLIF(SUM(nfl_plays.dot), 0)), 4) as weighted_opp_rating_from_plays, "nfl_plays"."year" from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and ("trg_pid" is not null) and "nfl_plays"."year" in (2022, 2023, 2021) and "nfl_plays"."seas_type" in ('REG') group by "pg"."pid", "nfl_plays"."year"), "t943a62b71bc45cb084f7914f84085b18" as (select "pg"."pid", ROUND((1.5 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / NULLIF(SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END), 0)) + (0.7 * SUM(CASE WHEN nfl_plays.trg_pid = pg.pid THEN nfl_plays.dot ELSE 0 END) / NULLIF(SUM(nfl_plays.dot), 0)), 4) as weighted_opp_rating_from_plays, "nfl_plays"."year" from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and ("trg_pid" is not null) and "nfl_plays"."year" in (2022, 2023, 2021) and "nfl_plays"."seas_type" in ('REG') and "nfl_plays"."motion" = true group by "pg"."pid", "nfl_plays"."year"), "t3096c628ff704dcd962a907f2451dcc9" as (select "pg"."pid", ROUND((1.5 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / NULLIF(SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END), 0)) + (0.7 * SUM(CASE WHEN nfl_plays.trg_pid = pg.pid THEN nfl_plays.dot ELSE 0 END) / NULLIF(SUM(nfl_plays.dot), 0)), 4) as weighted_opp_rating_from_plays, "nfl_plays"."year" from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and ("trg_pid" is not null) and "nfl_plays"."year" in (2022, 2023, 2021) and "nfl_plays"."seas_type" in ('REG') and "nfl_plays"."play_action" = true group by "pg"."pid", "nfl_plays"."year"), "t363c95e733dd796323c22edfd04bae5d" as (select "pg"."pid", ROUND((1.5 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / NULLIF(SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END), 0)) + (0.7 * SUM(CASE WHEN nfl_plays.trg_pid = pg.pid THEN nfl_plays.dot ELSE 0 END) / NULLIF(SUM(nfl_plays.dot), 0)), 4) as weighted_opp_rating_from_plays, "nfl_plays"."year" from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and ("trg_pid" is not null) and "nfl_plays"."year" in (2022, 2023, 2021) and "nfl_plays"."seas_type" in ('REG') and "nfl_plays"."dwn" in (1, 2) group by "pg"."pid", "nfl_plays"."year") select "player"."pid", player.fname, player.lname, "player_seasonlogs"."espn_open_score" AS "espn_open_score_0", "tceaa8fb06891dd60d306661c010a2c75"."trg_from_plays" AS "trg_from_plays_0", "t3014f563650d123c315bc1f9487d12a0"."weighted_opp_rating_from_plays" AS "weighted_opp_rating_from_plays_0", "t943a62b71bc45cb084f7914f84085b18"."weighted_opp_rating_from_plays" AS "weighted_opp_rating_from_plays_1", "t3096c628ff704dcd962a907f2451dcc9"."weighted_opp_rating_from_plays" AS "weighted_opp_rating_from_plays_2", "t363c95e733dd796323c22edfd04bae5d"."weighted_opp_rating_from_plays" AS "weighted_opp_rating_from_plays_3", "player_years"."year", "player"."pos" from "player_years" inner join "player" on "player"."pid" = "player_years"."pid" inner join "player_seasonlogs" on "player_seasonlogs"."pid" = "player"."pid" and player_seasonlogs.year = player_years.year and player_seasonlogs.year IN (2023,2022) and "player_seasonlogs"."seas_type" = 'REG' left join "tceaa8fb06891dd60d306661c010a2c75" on "tceaa8fb06891dd60d306661c010a2c75"."pid" = "player"."pid" and tceaa8fb06891dd60d306661c010a2c75.year = player_years.year and tceaa8fb06891dd60d306661c010a2c75.year IN (2022,2023) left join "t3014f563650d123c315bc1f9487d12a0" on "t3014f563650d123c315bc1f9487d12a0"."pid" = "player"."pid" and t3014f563650d123c315bc1f9487d12a0.year = player_years.year + -1 left join "t943a62b71bc45cb084f7914f84085b18" on "t943a62b71bc45cb084f7914f84085b18"."pid" = "player"."pid" and t943a62b71bc45cb084f7914f84085b18.year = player_years.year + -1 left join "t3096c628ff704dcd962a907f2451dcc9" on "t3096c628ff704dcd962a907f2451dcc9"."pid" = "player"."pid" and t3096c628ff704dcd962a907f2451dcc9.year = player_years.year + -1 left join "t363c95e733dd796323c22edfd04bae5d" on "t363c95e733dd796323c22edfd04bae5d"."pid" = "player"."pid" and t363c95e733dd796323c22edfd04bae5d.year = player_years.year + -1 where player.pos IN ('WR') and player_seasonlogs.espn_open_score > '0' group by player.fname, player.lname, "player_seasonlogs"."espn_open_score", "tceaa8fb06891dd60d306661c010a2c75"."trg_from_plays", "t3014f563650d123c315bc1f9487d12a0"."weighted_opp_rating_from_plays", "t943a62b71bc45cb084f7914f84085b18"."weighted_opp_rating_from_plays", "t3096c628ff704dcd962a907f2451dcc9"."weighted_opp_rating_from_plays", "t363c95e733dd796323c22edfd04bae5d"."weighted_opp_rating_from_plays", "player_years"."year", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 5 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(one_week)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('team pass attempts from plays using dst', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      sort: [
        {
          column_id: 'team_pass_attempts_from_plays',
          desc: true
        }
      ],
      prefix_columns: ['player_name', 'player_league_roster_status'],
      columns: [
        {
          column_id: 'team_pass_attempts_from_plays',
          params: {
            year: [2023]
          }
        }
      ],
      where: [
        {
          column_id: 'player_position',
          operator: 'IN',
          value: ['DST']
        }
      ]
    })
    const expected_query = `with "t36bf0474d4db796322b4fe1d9755f770" as (select "nfl_plays"."off" as "nfl_team", SUM(CASE WHEN psr_pid IS NOT NULL AND (sk IS NULL OR sk = false) THEN 1 ELSE 0 END) AS team_pass_att_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."year" in (2023) and "nfl_plays"."seas_type" in ('REG') group by "nfl_plays"."off"), "t36bf0474d4db796322b4fe1d9755f770_team_stats" as (select "t36bf0474d4db796322b4fe1d9755f770"."nfl_team", sum(t36bf0474d4db796322b4fe1d9755f770.team_pass_att_from_plays) as team_pass_att_from_plays from "t36bf0474d4db796322b4fe1d9755f770" group by "t36bf0474d4db796322b4fe1d9755f770"."nfl_team") select "player"."pid", player.fname, player.lname, CASE WHEN rosters_players.slot = 13 THEN 'injured_reserve' WHEN rosters_players.slot = 12 THEN 'practice_squad' WHEN rosters_players.slot IS NULL THEN 'free_agent' ELSE 'active_roster' END AS player_league_roster_status, rosters_players.slot, rosters_players.tid, rosters_players.tag, "t36bf0474d4db796322b4fe1d9755f770_team_stats"."team_pass_att_from_plays" AS "team_pass_att_from_plays_0", "player"."pos" from "player" left join "rosters_players" on "rosters_players"."pid" = "player"."pid" and "rosters_players"."year" = ${constants.season.year} and "rosters_players"."week" = ${Math.min(constants.season.week, constants.season.finalWeek)} and "rosters_players"."lid" = 1 left join "t36bf0474d4db796322b4fe1d9755f770_team_stats" on "t36bf0474d4db796322b4fe1d9755f770_team_stats"."nfl_team" = "player"."current_nfl_team" where player.pos IN ('DST') group by player.fname, player.lname, rosters_players.slot, rosters_players.tid, rosters_players.tag, "t36bf0474d4db796322b4fe1d9755f770_team_stats"."team_pass_att_from_plays", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 8 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(twelve_hours)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('fantasy points query with career_year param and per_game rate type', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      columns: [
        'player_starting_nfl_year',
        'player_draft_position',
        'player_ngs_draft_grade',
        'player_ngs_production_score',
        'player_ngs_athleticism_score',
        'player_ngs_size_score',
        'player_height',
        'player_fantasy_top_3_seasons_from_careerlogs',
        'player_fantasy_top_12_seasons_from_careerlogs',
        'player_fantasy_top_24_seasons_from_careerlogs',
        'player_fantasy_top_3_seasons_from_careerlogs',
        'player_fantasy_top_12_seasons_from_careerlogs',
        'player_fantasy_top_24_seasons_from_careerlogs',
        {
          column_id: 'player_fantasy_points_from_plays',
          params: {
            career_year: [1, 3],
            rate_type: ['per_game']
          }
        }
      ],
      sort: [
        {
          column_id: 'player_fantasy_top_24_seasons_from_careerlogs',
          desc: true,
          column_index: 0
        },
        {
          column_id: 'player_fantasy_top_12_seasons_from_careerlogs',
          desc: true,
          column_index: 0
        },
        {
          column_id: 'player_fantasy_top_3_seasons_from_careerlogs',
          desc: true,
          column_index: 0
        }
      ],
      where: [
        {
          column_id: 'player_starting_nfl_year',
          operator: '>=',
          value: '2015'
        },
        {
          column_id: 'player_position',
          operator: 'IN',
          value: ['WR']
        },
        {
          column_id: 'player_height',
          params: {},
          value: '71',
          operator: '<='
        }
      ],
      prefix_columns: ['player_name', 'player_league_roster_status'],
      splits: []
    })
    const expected_query = `with "t11480a4a21f5c9c4c3e08e798a963c66" as (select "player_gamelogs"."pid", count(*) as "rate_type_total_count", array_agg(distinct player_gamelogs.tm) as teams from "player_gamelogs" left join "nfl_games" on "nfl_games"."esbid" = "player_gamelogs"."esbid" left join "player_seasonlogs" on "player_seasonlogs"."pid" = "player_gamelogs"."pid" and "player_seasonlogs"."year" = "nfl_games"."year" and "player_seasonlogs"."seas_type" = "nfl_games"."seas_type" where "nfl_games"."seas_type" in ('REG') and "player_gamelogs"."active" = true and "player_seasonlogs"."career_year" between 1 and 3 group by "player_gamelogs"."pid"), "t4f52b9e49e88a8b1c74847efaec99a50" as (select fantasy_points_plays.pid, ROUND(SUM(CASE WHEN pid_type = 'trg' AND comp = true THEN 1 ELSE 0 END + CASE WHEN pid_type IN ('bc', 'trg') THEN COALESCE(rush_yds, 0) + COALESCE(recv_yds, 0) ELSE 0 END * 0.1 + CASE WHEN pid_type = 'psr' THEN COALESCE(pass_yds, 0) ELSE 0 END * 0.04 + CASE WHEN pid_type = 'bc' AND rush_td = true THEN 6 WHEN pid_type = 'trg' AND pass_td = true THEN 6 WHEN pid_type = 'psr' AND pass_td = true THEN 4 ELSE 0 END + CASE WHEN pid_type = 'psr' AND int = true THEN -1 ELSE 0 END + CASE WHEN pid_type = 'fuml' THEN -1 ELSE 0 END), 2) as fantasy_points_from_plays from (select bc_pid as pid, 'bc' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year from "nfl_plays" where "bc_pid" is not null union all select psr_pid as pid, 'psr' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year from "nfl_plays" where "psr_pid" is not null union all select trg_pid as pid, 'trg' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year from "nfl_plays" where "trg_pid" is not null union all select player_fuml_pid as pid, 'fuml' as pid_type, NULL as rush_yds, NULL as recv_yds, NULL as rush_td, NULL as td, NULL as comp, NULL as int, NULL as pass_yds, NULL as pass_td, play_type, seas_type, year from "nfl_plays" where "player_fuml_pid" is not null) as "fantasy_points_plays" inner join "player_seasonlogs" on "fantasy_points_plays"."pid" = "player_seasonlogs"."pid" and "fantasy_points_plays"."year" = "player_seasonlogs"."year" and "fantasy_points_plays"."seas_type" = "player_seasonlogs"."seas_type" where not "play_type" = 'NOPL' and "player_seasonlogs"."career_year" between 1 and 3 and "fantasy_points_plays"."seas_type" in ('REG') group by "fantasy_points_plays"."pid") select "player"."pid", player.fname, player.lname, "player"."start" AS "start_0", "player"."dpos" AS "dpos_0", "player"."ngs_draft_grade" AS "ngs_draft_grade_0", "player"."ngs_production_score" AS "ngs_production_score_0", "player"."ngs_athleticism_score" AS "ngs_athleticism_score_0", "player"."ngs_size_score" AS "ngs_size_score_0", "player"."height" AS "height_0", CASE WHEN rosters_players.slot = 13 THEN 'injured_reserve' WHEN rosters_players.slot = 12 THEN 'practice_squad' WHEN rosters_players.slot IS NULL THEN 'free_agent' ELSE 'active_roster' END AS player_league_roster_status, rosters_players.slot, rosters_players.tid, rosters_players.tag, "t0984699909800a4c1372fbe19abf07af"."top_3" AS "top_3_from_careerlogs_0", "t0984699909800a4c1372fbe19abf07af"."top_12" AS "top_12_from_careerlogs_0", "t0984699909800a4c1372fbe19abf07af"."top_24" AS "top_24_from_careerlogs_0", "t0984699909800a4c1372fbe19abf07af"."top_3" AS "top_3_from_careerlogs_1", "t0984699909800a4c1372fbe19abf07af"."top_12" AS "top_12_from_careerlogs_1", "t0984699909800a4c1372fbe19abf07af"."top_24" AS "top_24_from_careerlogs_1", CAST(t4f52b9e49e88a8b1c74847efaec99a50.fantasy_points_from_plays AS DECIMAL) / NULLIF(CAST(t11480a4a21f5c9c4c3e08e798a963c66.rate_type_total_count AS DECIMAL), 0) AS "fantasy_points_from_plays_0", "player"."pos" from "player" left join "t11480a4a21f5c9c4c3e08e798a963c66" on "t11480a4a21f5c9c4c3e08e798a963c66"."pid" = "player"."pid" left join "rosters_players" on "rosters_players"."pid" = "player"."pid" and "rosters_players"."year" = ${constants.season.year} and "rosters_players"."week" = ${Math.min(constants.season.week, constants.season.finalWeek)} and "rosters_players"."lid" = 1 left join "scoring_format_player_careerlogs" as "t0984699909800a4c1372fbe19abf07af" on "t0984699909800a4c1372fbe19abf07af"."pid" = "player"."pid" and t0984699909800a4c1372fbe19abf07af.scoring_format_hash = '0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d' left join "t4f52b9e49e88a8b1c74847efaec99a50" on "t4f52b9e49e88a8b1c74847efaec99a50"."pid" = "player"."pid" where player.start >= '2015' AND player.pos IN ('WR') AND player.height <= '71' group by player.fname, player.lname, "player"."start", "player"."dpos", "player"."ngs_draft_grade", "player"."ngs_production_score", "player"."ngs_athleticism_score", "player"."ngs_size_score", "player"."height", rosters_players.slot, rosters_players.tid, rosters_players.tag, "t0984699909800a4c1372fbe19abf07af"."top_3", "t0984699909800a4c1372fbe19abf07af"."top_12", "t0984699909800a4c1372fbe19abf07af"."top_24", "t0984699909800a4c1372fbe19abf07af"."top_3", "t0984699909800a4c1372fbe19abf07af"."top_12", "t0984699909800a4c1372fbe19abf07af"."top_24", "t4f52b9e49e88a8b1c74847efaec99a50"."fantasy_points_from_plays", t11480a4a21f5c9c4c3e08e798a963c66.rate_type_total_count, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 17 DESC NULLS LAST, 16 DESC NULLS LAST, 15 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(six_hours)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('year_offset range with where filters', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      sort: [
        {
          column_id: 'player_fantasy_points_from_plays',
          desc: true
        }
      ],
      prefix_columns: ['player_name'],
      columns: [
        {
          column_id: 'player_fantasy_points_from_plays',
          params: {
            year: [2018, 2019, 2020, 2021]
          }
        },
        {
          column_id: 'player_fantasy_points_from_plays',
          params: {
            year: [2018, 2019, 2020, 2021],
            year_offset: [1, 3]
          }
        },
        {
          column_id: 'player_pass_completion_percentage_from_plays',
          params: {
            year: [2018, 2019, 2020, 2021]
          }
        },
        {
          column_id: 'player_pass_completion_percentage_from_plays',
          params: {
            year: [2018, 2019, 2020, 2021],
            year_offset: [1, 3]
          }
        }
      ],
      splits: ['year'],
      where: [
        {
          column_id: 'player_position',
          operator: 'IN',
          value: ['QB']
        },
        {
          column_id: 'player_fantasy_points_from_plays',
          operator: '>=',
          value: 100,
          params: {
            year: [2018, 2019, 2020, 2021]
          }
        },
        {
          column_id: 'player_fantasy_points_from_plays',
          column_index: 1,
          operator: '>=',
          value: 300,
          params: {
            year: [2018, 2019, 2020, 2021],
            year_offset: [1, 3]
          }
        }
      ]
    })
    const expected_query = `with "base_years" as (SELECT unnest(ARRAY[2018,2019,2020,2021,2022,2023,2024]) as year), "player_years" as (SELECT DISTINCT player.pid, base_years.year FROM player CROSS JOIN base_years), "t2512ecab97b9c0084127013456b14f64" as (select fantasy_points_plays.pid, ROUND(SUM(CASE WHEN pid_type = 'trg' AND comp = true THEN 1 ELSE 0 END + CASE WHEN pid_type IN ('bc', 'trg') THEN COALESCE(rush_yds, 0) + COALESCE(recv_yds, 0) ELSE 0 END * 0.1 + CASE WHEN pid_type = 'psr' THEN COALESCE(pass_yds, 0) ELSE 0 END * 0.04 + CASE WHEN pid_type = 'bc' AND rush_td = true THEN 6 WHEN pid_type = 'trg' AND pass_td = true THEN 6 WHEN pid_type = 'psr' AND pass_td = true THEN 4 ELSE 0 END + CASE WHEN pid_type = 'psr' AND int = true THEN -1 ELSE 0 END + CASE WHEN pid_type = 'fuml' THEN -1 ELSE 0 END), 2) as fantasy_points_from_plays, "fantasy_points_plays"."year" from (select bc_pid as pid, 'bc' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year from "nfl_plays" where "bc_pid" is not null union all select psr_pid as pid, 'psr' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year from "nfl_plays" where "psr_pid" is not null union all select trg_pid as pid, 'trg' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year from "nfl_plays" where "trg_pid" is not null union all select player_fuml_pid as pid, 'fuml' as pid_type, NULL as rush_yds, NULL as recv_yds, NULL as rush_td, NULL as td, NULL as comp, NULL as int, NULL as pass_yds, NULL as pass_td, play_type, seas_type, year from "nfl_plays" where "player_fuml_pid" is not null) as "fantasy_points_plays" where not "play_type" = 'NOPL' and "fantasy_points_plays"."year" in (2018, 2019, 2020, 2021) and "fantasy_points_plays"."seas_type" in ('REG') group by "fantasy_points_plays"."year", "fantasy_points_plays"."pid" having ROUND(SUM(CASE WHEN pid_type = 'trg' AND comp = true THEN 1 ELSE 0 END + CASE WHEN pid_type IN ('bc', 'trg') THEN COALESCE(rush_yds, 0) + COALESCE(recv_yds, 0) ELSE 0 END * 0.1 + CASE WHEN pid_type = 'psr' THEN COALESCE(pass_yds, 0) ELSE 0 END * 0.04 + CASE WHEN pid_type = 'bc' AND rush_td = true THEN 6 WHEN pid_type = 'trg' AND pass_td = true THEN 6 WHEN pid_type = 'psr' AND pass_td = true THEN 4 ELSE 0 END + CASE WHEN pid_type = 'psr' AND int = true THEN -1 ELSE 0 END + CASE WHEN pid_type = 'fuml' THEN -1 ELSE 0 END), 2) >= '100'), "t7a2fd1c791feebb5859679ba05472f03" as (select fantasy_points_plays.pid, ROUND(SUM(CASE WHEN pid_type = 'trg' AND comp = true THEN 1 ELSE 0 END + CASE WHEN pid_type IN ('bc', 'trg') THEN COALESCE(rush_yds, 0) + COALESCE(recv_yds, 0) ELSE 0 END * 0.1 + CASE WHEN pid_type = 'psr' THEN COALESCE(pass_yds, 0) ELSE 0 END * 0.04 + CASE WHEN pid_type = 'bc' AND rush_td = true THEN 6 WHEN pid_type = 'trg' AND pass_td = true THEN 6 WHEN pid_type = 'psr' AND pass_td = true THEN 4 ELSE 0 END + CASE WHEN pid_type = 'psr' AND int = true THEN -1 ELSE 0 END + CASE WHEN pid_type = 'fuml' THEN -1 ELSE 0 END), 2) as fantasy_points_from_plays, "fantasy_points_plays"."year" from (select bc_pid as pid, 'bc' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year from "nfl_plays" where "bc_pid" is not null union all select psr_pid as pid, 'psr' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year from "nfl_plays" where "psr_pid" is not null union all select trg_pid as pid, 'trg' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year from "nfl_plays" where "trg_pid" is not null union all select player_fuml_pid as pid, 'fuml' as pid_type, NULL as rush_yds, NULL as recv_yds, NULL as rush_td, NULL as td, NULL as comp, NULL as int, NULL as pass_yds, NULL as pass_td, play_type, seas_type, year from "nfl_plays" where "player_fuml_pid" is not null) as "fantasy_points_plays" where not "play_type" = 'NOPL' and "fantasy_points_plays"."year" in (2018, 2019, 2020, 2021, 2022, 2023, 2024) and "fantasy_points_plays"."seas_type" in ('REG') group by "fantasy_points_plays"."year", "fantasy_points_plays"."pid"), "t64d292bf2b358aeff61cb2bf9f3368f3" as (select COALESCE(psr_pid) as pid, "nfl_plays"."year", CASE WHEN SUM(CASE WHEN sk is null or sk = false THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN comp = true THEN 1 ELSE 0 END) / SUM(CASE WHEN sk is null or sk = false THEN 1 ELSE 0 END), 2) ELSE 0 END as pass_comp_pct_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."year" in (2018, 2019, 2020, 2021) and "nfl_plays"."seas_type" in ('REG') group by "nfl_plays"."year", COALESCE(psr_pid)), "t56b5b7f3fe3afadcb763ba2dbe73d1d0" as (select COALESCE(psr_pid) as pid, "nfl_plays"."year", SUM(CASE WHEN comp = true THEN 1 ELSE 0 END) as pass_comp_pct_from_plays_numerator, SUM(CASE WHEN sk is null or sk = false THEN 1 ELSE 0 END) as pass_comp_pct_from_plays_denominator from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."year" in (2018, 2019, 2020, 2021, 2022, 2023, 2024) and "nfl_plays"."seas_type" in ('REG') group by "nfl_plays"."year", COALESCE(psr_pid)) select "player"."pid", player.fname, player.lname, "t2512ecab97b9c0084127013456b14f64"."fantasy_points_from_plays" AS "fantasy_points_from_plays_0", (SELECT SUM(t7a2fd1c791feebb5859679ba05472f03.fantasy_points_from_plays) FROM t7a2fd1c791feebb5859679ba05472f03 WHERE t7a2fd1c791feebb5859679ba05472f03.pid = player.pid AND t7a2fd1c791feebb5859679ba05472f03.year BETWEEN player_years.year + 1 AND player_years.year + 3) AS "fantasy_points_from_plays_1", "t64d292bf2b358aeff61cb2bf9f3368f3"."pass_comp_pct_from_plays" AS "pass_comp_pct_from_plays_0", (SELECT SUM(t56b5b7f3fe3afadcb763ba2dbe73d1d0.pass_comp_pct_from_plays_numerator) / NULLIF(SUM(t56b5b7f3fe3afadcb763ba2dbe73d1d0.pass_comp_pct_from_plays_denominator), 0) FROM t56b5b7f3fe3afadcb763ba2dbe73d1d0 WHERE t56b5b7f3fe3afadcb763ba2dbe73d1d0.pid = player.pid AND t56b5b7f3fe3afadcb763ba2dbe73d1d0.year BETWEEN player_years.year + 1 AND player_years.year + 3) AS "pass_comp_pct_from_plays_1", "player_years"."year", "player"."pos" from "player_years" inner join "player" on "player"."pid" = "player_years"."pid" inner join "t2512ecab97b9c0084127013456b14f64" on "t2512ecab97b9c0084127013456b14f64"."pid" = "player"."pid" and t2512ecab97b9c0084127013456b14f64.year = player_years.year and t2512ecab97b9c0084127013456b14f64.year IN (2018,2019,2020,2021) inner join "t7a2fd1c791feebb5859679ba05472f03" on "t7a2fd1c791feebb5859679ba05472f03"."pid" = "player"."pid" and t7a2fd1c791feebb5859679ba05472f03.year BETWEEN player_years.year + 1 AND player_years.year + 3 left join "t64d292bf2b358aeff61cb2bf9f3368f3" on "t64d292bf2b358aeff61cb2bf9f3368f3"."pid" = "player"."pid" and t64d292bf2b358aeff61cb2bf9f3368f3.year = player_years.year and t64d292bf2b358aeff61cb2bf9f3368f3.year IN (2018,2019,2020,2021) left join "t56b5b7f3fe3afadcb763ba2dbe73d1d0" on "t56b5b7f3fe3afadcb763ba2dbe73d1d0"."pid" = "player"."pid" and t56b5b7f3fe3afadcb763ba2dbe73d1d0.year BETWEEN player_years.year + 1 AND player_years.year + 3 where player.pos IN ('QB') group by player.fname, player.lname, "t2512ecab97b9c0084127013456b14f64"."fantasy_points_from_plays", t7a2fd1c791feebb5859679ba05472f03.fantasy_points_from_plays, "t64d292bf2b358aeff61cb2bf9f3368f3"."pass_comp_pct_from_plays", "player_years"."year", "player"."pid", "player"."lname", "player"."fname", "player"."pos" having SUM(t7a2fd1c791feebb5859679ba05472f03.fantasy_points_from_plays) >= '300' order by 4 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(one_week)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('player_rush_yards_after_contact_per_attempt_from_plays year_offset range', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      prefix_columns: ['player_name'],
      columns: [
        {
          column_id: 'player_weighted_opportunity_rating_from_plays',
          params: {
            year: [2018, 2019, 2020, 2021]
          }
        },
        {
          column_id: 'player_weighted_opportunity_rating_from_plays',
          params: {
            year: [2018, 2019, 2020, 2021],
            year_offset: [1, 3]
          }
        }
      ],
      sort: [
        {
          column_id: 'player_weighted_opportunity_rating_from_plays',
          column_index: 0,
          desc: true
        }
      ],
      splits: ['year'],
      where: [
        {
          column_id: 'player_position',
          operator: 'IN',
          value: ['WR']
        }
      ]
    })
    const expected_query = `with "base_years" as (SELECT unnest(ARRAY[2018,2019,2020,2021,2022,2023,2024]) as year), "player_years" as (SELECT DISTINCT player.pid, base_years.year FROM player CROSS JOIN base_years), "t867305ec5a3ef4721b0c91598bc8a671" as (select "pg"."pid", ROUND((1.5 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / NULLIF(SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END), 0)) + (0.7 * SUM(CASE WHEN nfl_plays.trg_pid = pg.pid THEN nfl_plays.dot ELSE 0 END) / NULLIF(SUM(nfl_plays.dot), 0)), 4) as weighted_opp_rating_from_plays, "nfl_plays"."year" from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and ("trg_pid" is not null) and "nfl_plays"."year" in (2018, 2019, 2020, 2021) and "nfl_plays"."seas_type" in ('REG') group by "pg"."pid", "nfl_plays"."year"), "tf8fa31850a7d000643c0af01da14e670" as (select "pg"."pid", COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) as player_targets, SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END) as team_targets, SUM(CASE WHEN nfl_plays.trg_pid = pg.pid THEN nfl_plays.dot ELSE 0 END) as player_air_yards, SUM(nfl_plays.dot) as team_air_yards, "nfl_plays"."year" from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and ("trg_pid" is not null) and "nfl_plays"."year" in (2018, 2019, 2020, 2021, 2022, 2023, 2024) and "nfl_plays"."seas_type" in ('REG') group by "pg"."pid", "nfl_plays"."year") select "player"."pid", player.fname, player.lname, "t867305ec5a3ef4721b0c91598bc8a671"."weighted_opp_rating_from_plays" AS "weighted_opp_rating_from_plays_0", (SELECT ROUND((1.5 * SUM(tf8fa31850a7d000643c0af01da14e670.player_targets) / NULLIF(SUM(tf8fa31850a7d000643c0af01da14e670.team_targets), 0)) + (0.7 * SUM(tf8fa31850a7d000643c0af01da14e670.player_air_yards) / NULLIF(SUM(tf8fa31850a7d000643c0af01da14e670.team_air_yards), 0)), 4) FROM tf8fa31850a7d000643c0af01da14e670 WHERE tf8fa31850a7d000643c0af01da14e670.pid = player.pid AND tf8fa31850a7d000643c0af01da14e670.year BETWEEN player_years.year + 1 AND player_years.year + 3) AS "weighted_opp_rating_from_plays_1", "player_years"."year", "player"."pos" from "player_years" inner join "player" on "player"."pid" = "player_years"."pid" left join "t867305ec5a3ef4721b0c91598bc8a671" on "t867305ec5a3ef4721b0c91598bc8a671"."pid" = "player"."pid" and t867305ec5a3ef4721b0c91598bc8a671.year = player_years.year and t867305ec5a3ef4721b0c91598bc8a671.year IN (2018,2019,2020,2021) left join "tf8fa31850a7d000643c0af01da14e670" on "tf8fa31850a7d000643c0af01da14e670"."pid" = "player"."pid" and tf8fa31850a7d000643c0af01da14e670.year BETWEEN player_years.year + 1 AND player_years.year + 3 where player.pos IN ('WR') group by player.fname, player.lname, "t867305ec5a3ef4721b0c91598bc8a671"."weighted_opp_rating_from_plays", "player_years"."year", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 4 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(one_week)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('year_offset range with rate_type and where filter', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      sort: [
        {
          column_id: 'player_fantasy_points_from_plays',
          desc: true
        }
      ],
      prefix_columns: ['player_name'],
      columns: [
        {
          column_id: 'player_fantasy_points_from_plays',
          params: {
            year: [2018, 2019, 2020, 2021]
          }
        },
        {
          column_id: 'player_fantasy_points_from_plays',
          params: {
            year: [2018, 2019, 2020, 2021],
            year_offset: [1, 3],
            rate_type: ['per_game']
          }
        },
        {
          column_id: 'player_pass_completion_percentage_from_plays',
          params: {
            year: [2018, 2019, 2020, 2021]
          }
        }
      ],
      splits: ['year'],
      where: [
        {
          column_id: 'player_position',
          operator: 'IN',
          value: ['QB']
        },
        {
          column_id: 'player_fantasy_points_from_plays',
          operator: '>=',
          value: 100,
          params: {
            year: [2018, 2019, 2020, 2021]
          }
        },
        {
          column_id: 'player_fantasy_points_from_plays',
          column_index: 1,
          operator: '>=',
          value: 300,
          params: {
            year: [2018, 2019, 2020, 2021],
            year_offset: [1, 3]
          }
        }
      ]
    })
    const expected_query = `with "base_years" as (SELECT unnest(ARRAY[2018,2019,2020,2021,2022,2023,2024]) as year), "player_years" as (SELECT DISTINCT player.pid, base_years.year FROM player CROSS JOIN base_years), "t61b60bd6a2448924ee237c49e7b086db" as (select "player_gamelogs"."pid", count(*) as "rate_type_total_count", array_agg(distinct player_gamelogs.tm) as teams, "nfl_games"."year" from "player_gamelogs" left join "nfl_games" on "nfl_games"."esbid" = "player_gamelogs"."esbid" where "nfl_games"."seas_type" in ('REG') and "player_gamelogs"."active" = true and "nfl_games"."year" in (2018, 2019, 2020, 2021, 2022, 2023, 2024) group by "nfl_games"."year", "player_gamelogs"."pid"), "t2512ecab97b9c0084127013456b14f64" as (select fantasy_points_plays.pid, ROUND(SUM(CASE WHEN pid_type = 'trg' AND comp = true THEN 1 ELSE 0 END + CASE WHEN pid_type IN ('bc', 'trg') THEN COALESCE(rush_yds, 0) + COALESCE(recv_yds, 0) ELSE 0 END * 0.1 + CASE WHEN pid_type = 'psr' THEN COALESCE(pass_yds, 0) ELSE 0 END * 0.04 + CASE WHEN pid_type = 'bc' AND rush_td = true THEN 6 WHEN pid_type = 'trg' AND pass_td = true THEN 6 WHEN pid_type = 'psr' AND pass_td = true THEN 4 ELSE 0 END + CASE WHEN pid_type = 'psr' AND int = true THEN -1 ELSE 0 END + CASE WHEN pid_type = 'fuml' THEN -1 ELSE 0 END), 2) as fantasy_points_from_plays, "fantasy_points_plays"."year" from (select bc_pid as pid, 'bc' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year from "nfl_plays" where "bc_pid" is not null union all select psr_pid as pid, 'psr' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year from "nfl_plays" where "psr_pid" is not null union all select trg_pid as pid, 'trg' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year from "nfl_plays" where "trg_pid" is not null union all select player_fuml_pid as pid, 'fuml' as pid_type, NULL as rush_yds, NULL as recv_yds, NULL as rush_td, NULL as td, NULL as comp, NULL as int, NULL as pass_yds, NULL as pass_td, play_type, seas_type, year from "nfl_plays" where "player_fuml_pid" is not null) as "fantasy_points_plays" where not "play_type" = 'NOPL' and "fantasy_points_plays"."year" in (2018, 2019, 2020, 2021) and "fantasy_points_plays"."seas_type" in ('REG') group by "fantasy_points_plays"."year", "fantasy_points_plays"."pid" having ROUND(SUM(CASE WHEN pid_type = 'trg' AND comp = true THEN 1 ELSE 0 END + CASE WHEN pid_type IN ('bc', 'trg') THEN COALESCE(rush_yds, 0) + COALESCE(recv_yds, 0) ELSE 0 END * 0.1 + CASE WHEN pid_type = 'psr' THEN COALESCE(pass_yds, 0) ELSE 0 END * 0.04 + CASE WHEN pid_type = 'bc' AND rush_td = true THEN 6 WHEN pid_type = 'trg' AND pass_td = true THEN 6 WHEN pid_type = 'psr' AND pass_td = true THEN 4 ELSE 0 END + CASE WHEN pid_type = 'psr' AND int = true THEN -1 ELSE 0 END + CASE WHEN pid_type = 'fuml' THEN -1 ELSE 0 END), 2) >= '100'), "t7a2fd1c791feebb5859679ba05472f03" as (select fantasy_points_plays.pid, ROUND(SUM(CASE WHEN pid_type = 'trg' AND comp = true THEN 1 ELSE 0 END + CASE WHEN pid_type IN ('bc', 'trg') THEN COALESCE(rush_yds, 0) + COALESCE(recv_yds, 0) ELSE 0 END * 0.1 + CASE WHEN pid_type = 'psr' THEN COALESCE(pass_yds, 0) ELSE 0 END * 0.04 + CASE WHEN pid_type = 'bc' AND rush_td = true THEN 6 WHEN pid_type = 'trg' AND pass_td = true THEN 6 WHEN pid_type = 'psr' AND pass_td = true THEN 4 ELSE 0 END + CASE WHEN pid_type = 'psr' AND int = true THEN -1 ELSE 0 END + CASE WHEN pid_type = 'fuml' THEN -1 ELSE 0 END), 2) as fantasy_points_from_plays, "fantasy_points_plays"."year" from (select bc_pid as pid, 'bc' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year from "nfl_plays" where "bc_pid" is not null union all select psr_pid as pid, 'psr' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year from "nfl_plays" where "psr_pid" is not null union all select trg_pid as pid, 'trg' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year from "nfl_plays" where "trg_pid" is not null union all select player_fuml_pid as pid, 'fuml' as pid_type, NULL as rush_yds, NULL as recv_yds, NULL as rush_td, NULL as td, NULL as comp, NULL as int, NULL as pass_yds, NULL as pass_td, play_type, seas_type, year from "nfl_plays" where "player_fuml_pid" is not null) as "fantasy_points_plays" where not "play_type" = 'NOPL' and "fantasy_points_plays"."year" in (2018, 2019, 2020, 2021, 2022, 2023, 2024) and "fantasy_points_plays"."seas_type" in ('REG') group by "fantasy_points_plays"."year", "fantasy_points_plays"."pid"), "t64d292bf2b358aeff61cb2bf9f3368f3" as (select COALESCE(psr_pid) as pid, "nfl_plays"."year", CASE WHEN SUM(CASE WHEN sk is null or sk = false THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN comp = true THEN 1 ELSE 0 END) / SUM(CASE WHEN sk is null or sk = false THEN 1 ELSE 0 END), 2) ELSE 0 END as pass_comp_pct_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."year" in (2018, 2019, 2020, 2021) and "nfl_plays"."seas_type" in ('REG') group by "nfl_plays"."year", COALESCE(psr_pid)) select "player"."pid", player.fname, player.lname, "t2512ecab97b9c0084127013456b14f64"."fantasy_points_from_plays" AS "fantasy_points_from_plays_0", (SELECT SUM(t7a2fd1c791feebb5859679ba05472f03.fantasy_points_from_plays) FROM t7a2fd1c791feebb5859679ba05472f03 WHERE t7a2fd1c791feebb5859679ba05472f03.pid = player.pid AND t7a2fd1c791feebb5859679ba05472f03.year BETWEEN player_years.year + 1 AND player_years.year + 3) / NULLIF((SELECT CAST(SUM(t61b60bd6a2448924ee237c49e7b086db.rate_type_total_count) AS DECIMAL) FROM t61b60bd6a2448924ee237c49e7b086db WHERE t61b60bd6a2448924ee237c49e7b086db.pid = player.pid AND t61b60bd6a2448924ee237c49e7b086db.year BETWEEN player_years.year + 1 AND player_years.year + 3), 0) AS "fantasy_points_from_plays_1", "t64d292bf2b358aeff61cb2bf9f3368f3"."pass_comp_pct_from_plays" AS "pass_comp_pct_from_plays_0", "player_years"."year", "player"."pos" from "player_years" inner join "player" on "player"."pid" = "player_years"."pid" left join "t61b60bd6a2448924ee237c49e7b086db" on "t61b60bd6a2448924ee237c49e7b086db"."pid" = "player"."pid" and t61b60bd6a2448924ee237c49e7b086db.year BETWEEN player_years.year + 1 AND player_years.year + 3 inner join "t2512ecab97b9c0084127013456b14f64" on "t2512ecab97b9c0084127013456b14f64"."pid" = "player"."pid" and t2512ecab97b9c0084127013456b14f64.year = player_years.year and t2512ecab97b9c0084127013456b14f64.year IN (2018,2019,2020,2021) inner join "t7a2fd1c791feebb5859679ba05472f03" on "t7a2fd1c791feebb5859679ba05472f03"."pid" = "player"."pid" and t7a2fd1c791feebb5859679ba05472f03.year BETWEEN player_years.year + 1 AND player_years.year + 3 left join "t64d292bf2b358aeff61cb2bf9f3368f3" on "t64d292bf2b358aeff61cb2bf9f3368f3"."pid" = "player"."pid" and t64d292bf2b358aeff61cb2bf9f3368f3.year = player_years.year and t64d292bf2b358aeff61cb2bf9f3368f3.year IN (2018,2019,2020,2021) where player.pos IN ('QB') group by player.fname, player.lname, "t2512ecab97b9c0084127013456b14f64"."fantasy_points_from_plays", t7a2fd1c791feebb5859679ba05472f03.fantasy_points_from_plays, "t64d292bf2b358aeff61cb2bf9f3368f3"."pass_comp_pct_from_plays", "player_years"."year", "player"."pid", "player"."lname", "player"."fname", "player"."pos" having SUM(t7a2fd1c791feebb5859679ba05472f03.fantasy_points_from_plays) >= '300' order by 4 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(one_week)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('single year_offset with rate_type', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      columns: [
        {
          column_id: 'player_keeptradecut_value',
          params: {
            year: [2023, 2022, 2021, 2020]
          }
        },
        {
          column_id: 'player_weighted_opportunity_from_plays',
          params: {
            rate_type: ['per_game'],
            year: [2023, 2022, 2021, 2020]
          }
        },
        {
          column_id: 'player_fantasy_points_from_plays',
          params: {
            rate_type: ['per_game'],
            year: [2023, 2022, 2021, 2020]
          }
        },
        {
          column_id: 'player_weighted_opportunity_from_plays',
          params: {
            rate_type: ['per_game'],
            year: [2023, 2022, 2021, 2020],
            year_offset: 1
          }
        },
        {
          column_id: 'player_fantasy_points_from_plays',
          params: {
            rate_type: ['per_game'],
            year: [2023, 2022, 2021, 2020],
            year_offset: 1
          }
        }
      ],
      sort: [
        {
          column_id: 'player_fantasy_points_from_plays',
          desc: true,
          column_index: 1
        }
      ],
      where: [
        {
          column_id: 'player_position',
          operator: 'IN',
          value: ['RB']
        }
      ],
      prefix_columns: ['player_name', 'player_league_roster_status'],
      splits: ['year']
    })
    const expected_query = `with "base_years" as (SELECT unnest(ARRAY[2020,2021,2022,2023,2024]) as year), "player_years" as (SELECT DISTINCT player.pid, base_years.year FROM player CROSS JOIN base_years), "t1dbf22c1937bec7c71654579572c42ca" as (select "player_gamelogs"."pid", count(*) as "rate_type_total_count", array_agg(distinct player_gamelogs.tm) as teams, "nfl_games"."year" from "player_gamelogs" left join "nfl_games" on "nfl_games"."esbid" = "player_gamelogs"."esbid" where "nfl_games"."seas_type" in ('REG') and "player_gamelogs"."active" = true and "nfl_games"."year" in (2020, 2021, 2022, 2023) group by "nfl_games"."year", "player_gamelogs"."pid"), "t73744802b0ac3caa4590c0b0bf651d15" as (select "player_gamelogs"."pid", count(*) as "rate_type_total_count", array_agg(distinct player_gamelogs.tm) as teams, "nfl_games"."year" from "player_gamelogs" left join "nfl_games" on "nfl_games"."esbid" = "player_gamelogs"."esbid" where "nfl_games"."seas_type" in ('REG') and "player_gamelogs"."active" = true and "nfl_games"."year" in (2020, 2021, 2022, 2023, 2024) group by "nfl_games"."year", "player_gamelogs"."pid"), "teb1a3a3f8fba95b1c24f7de5791bf1c8" as (select COALESCE(bc_pid, trg_pid) as pid, "nfl_plays"."year", ROUND(SUM(CASE WHEN nfl_plays.ydl_100 <= 20 AND bc_pid IS NOT NULL THEN 1.30 WHEN nfl_plays.ydl_100 <= 20 AND trg_pid IS NOT NULL THEN 2.25 WHEN nfl_plays.ydl_100 > 20 AND bc_pid IS NOT NULL THEN 0.48 WHEN nfl_plays.ydl_100 > 20 AND trg_pid IS NOT NULL THEN 1.43 ELSE 0 END), 2) as weighted_opportunity_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."year" in (2020, 2021, 2022, 2023) and "nfl_plays"."seas_type" in ('REG') group by "nfl_plays"."year", COALESCE(bc_pid, trg_pid)), "t35e2b83a964bf6fb14c995f79eb0c911" as (select fantasy_points_plays.pid, ROUND(SUM(CASE WHEN pid_type = 'trg' AND comp = true THEN 1 ELSE 0 END + CASE WHEN pid_type IN ('bc', 'trg') THEN COALESCE(rush_yds, 0) + COALESCE(recv_yds, 0) ELSE 0 END * 0.1 + CASE WHEN pid_type = 'psr' THEN COALESCE(pass_yds, 0) ELSE 0 END * 0.04 + CASE WHEN pid_type = 'bc' AND rush_td = true THEN 6 WHEN pid_type = 'trg' AND pass_td = true THEN 6 WHEN pid_type = 'psr' AND pass_td = true THEN 4 ELSE 0 END + CASE WHEN pid_type = 'psr' AND int = true THEN -1 ELSE 0 END + CASE WHEN pid_type = 'fuml' THEN -1 ELSE 0 END), 2) as fantasy_points_from_plays, "fantasy_points_plays"."year" from (select bc_pid as pid, 'bc' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year from "nfl_plays" where "bc_pid" is not null union all select psr_pid as pid, 'psr' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year from "nfl_plays" where "psr_pid" is not null union all select trg_pid as pid, 'trg' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year from "nfl_plays" where "trg_pid" is not null union all select player_fuml_pid as pid, 'fuml' as pid_type, NULL as rush_yds, NULL as recv_yds, NULL as rush_td, NULL as td, NULL as comp, NULL as int, NULL as pass_yds, NULL as pass_td, play_type, seas_type, year from "nfl_plays" where "player_fuml_pid" is not null) as "fantasy_points_plays" where not "play_type" = 'NOPL' and "fantasy_points_plays"."year" in (2020, 2021, 2022, 2023) and "fantasy_points_plays"."seas_type" in ('REG') group by "fantasy_points_plays"."year", "fantasy_points_plays"."pid"), "t0c7bc1a8d2cb95b34c757cbb4f98810e" as (select COALESCE(bc_pid, trg_pid) as pid, "nfl_plays"."year", ROUND(SUM(CASE WHEN nfl_plays.ydl_100 <= 20 AND bc_pid IS NOT NULL THEN 1.30 WHEN nfl_plays.ydl_100 <= 20 AND trg_pid IS NOT NULL THEN 2.25 WHEN nfl_plays.ydl_100 > 20 AND bc_pid IS NOT NULL THEN 0.48 WHEN nfl_plays.ydl_100 > 20 AND trg_pid IS NOT NULL THEN 1.43 ELSE 0 END), 2) as weighted_opportunity_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."year" in (2020, 2021, 2022, 2023, 2024) and "nfl_plays"."seas_type" in ('REG') group by "nfl_plays"."year", COALESCE(bc_pid, trg_pid)), "tdc2df159a562cbbc806616f329a24ef6" as (select fantasy_points_plays.pid, ROUND(SUM(CASE WHEN pid_type = 'trg' AND comp = true THEN 1 ELSE 0 END + CASE WHEN pid_type IN ('bc', 'trg') THEN COALESCE(rush_yds, 0) + COALESCE(recv_yds, 0) ELSE 0 END * 0.1 + CASE WHEN pid_type = 'psr' THEN COALESCE(pass_yds, 0) ELSE 0 END * 0.04 + CASE WHEN pid_type = 'bc' AND rush_td = true THEN 6 WHEN pid_type = 'trg' AND pass_td = true THEN 6 WHEN pid_type = 'psr' AND pass_td = true THEN 4 ELSE 0 END + CASE WHEN pid_type = 'psr' AND int = true THEN -1 ELSE 0 END + CASE WHEN pid_type = 'fuml' THEN -1 ELSE 0 END), 2) as fantasy_points_from_plays, "fantasy_points_plays"."year" from (select bc_pid as pid, 'bc' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year from "nfl_plays" where "bc_pid" is not null union all select psr_pid as pid, 'psr' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year from "nfl_plays" where "psr_pid" is not null union all select trg_pid as pid, 'trg' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year from "nfl_plays" where "trg_pid" is not null union all select player_fuml_pid as pid, 'fuml' as pid_type, NULL as rush_yds, NULL as recv_yds, NULL as rush_td, NULL as td, NULL as comp, NULL as int, NULL as pass_yds, NULL as pass_td, play_type, seas_type, year from "nfl_plays" where "player_fuml_pid" is not null) as "fantasy_points_plays" where not "play_type" = 'NOPL' and "fantasy_points_plays"."year" in (2020, 2021, 2022, 2023, 2024) and "fantasy_points_plays"."seas_type" in ('REG') group by "fantasy_points_plays"."year", "fantasy_points_plays"."pid") select "player"."pid", player.fname, player.lname, CASE WHEN rosters_players.slot = 13 THEN 'injured_reserve' WHEN rosters_players.slot = 12 THEN 'practice_squad' WHEN rosters_players.slot IS NULL THEN 'free_agent' ELSE 'active_roster' END AS player_league_roster_status, rosters_players.slot, rosters_players.tid, rosters_players.tag, "te70f12f316e28f29e682d081b42501b8"."v" AS "player_keeptradecut_value_0", CAST(teb1a3a3f8fba95b1c24f7de5791bf1c8.weighted_opportunity_from_plays AS DECIMAL) / NULLIF(CAST(t1dbf22c1937bec7c71654579572c42ca.rate_type_total_count AS DECIMAL), 0) AS "weighted_opportunity_from_plays_0", CAST(t35e2b83a964bf6fb14c995f79eb0c911.fantasy_points_from_plays AS DECIMAL) / NULLIF(CAST(t1dbf22c1937bec7c71654579572c42ca.rate_type_total_count AS DECIMAL), 0) AS "fantasy_points_from_plays_0", CAST(t0c7bc1a8d2cb95b34c757cbb4f98810e.weighted_opportunity_from_plays AS DECIMAL) / NULLIF(CAST(t73744802b0ac3caa4590c0b0bf651d15.rate_type_total_count AS DECIMAL), 0) AS "weighted_opportunity_from_plays_1", CAST(tdc2df159a562cbbc806616f329a24ef6.fantasy_points_from_plays AS DECIMAL) / NULLIF(CAST(t73744802b0ac3caa4590c0b0bf651d15.rate_type_total_count AS DECIMAL), 0) AS "fantasy_points_from_plays_1", "player_years"."year", "player"."pos" from "player_years" inner join "player" on "player"."pid" = "player_years"."pid" left join "t1dbf22c1937bec7c71654579572c42ca" on "t1dbf22c1937bec7c71654579572c42ca"."pid" = "player"."pid" and "t1dbf22c1937bec7c71654579572c42ca"."year" = "player_years"."year" left join "t73744802b0ac3caa4590c0b0bf651d15" on "t73744802b0ac3caa4590c0b0bf651d15"."pid" = "player"."pid" and t73744802b0ac3caa4590c0b0bf651d15.year = player_years.year + 1 left join "rosters_players" on "rosters_players"."pid" = "player"."pid" and "rosters_players"."year" = ${constants.season.year} and "rosters_players"."week" = ${Math.min(constants.season.week, constants.season.finalWeek)} and "rosters_players"."lid" = 1 left join "opening_days" on "opening_days"."year" = "player_years"."year" left join "keeptradecut_rankings" as "te70f12f316e28f29e682d081b42501b8" on "te70f12f316e28f29e682d081b42501b8"."pid" = "player"."pid" and "te70f12f316e28f29e682d081b42501b8"."qb" = 2 and "te70f12f316e28f29e682d081b42501b8"."type" = 1 and "te70f12f316e28f29e682d081b42501b8"."d" = EXTRACT(EPOCH FROM (date_trunc('day', opening_days.opening_day) + interval '0 year'))::integer and opening_days.year = (player_years.year) left join "teb1a3a3f8fba95b1c24f7de5791bf1c8" on "teb1a3a3f8fba95b1c24f7de5791bf1c8"."pid" = "player"."pid" and teb1a3a3f8fba95b1c24f7de5791bf1c8.year = player_years.year and teb1a3a3f8fba95b1c24f7de5791bf1c8.year IN (2020,2021,2022,2023) left join "t35e2b83a964bf6fb14c995f79eb0c911" on "t35e2b83a964bf6fb14c995f79eb0c911"."pid" = "player"."pid" and t35e2b83a964bf6fb14c995f79eb0c911.year = player_years.year and t35e2b83a964bf6fb14c995f79eb0c911.year IN (2020,2021,2022,2023) left join "t0c7bc1a8d2cb95b34c757cbb4f98810e" on "t0c7bc1a8d2cb95b34c757cbb4f98810e"."pid" = "player"."pid" and t0c7bc1a8d2cb95b34c757cbb4f98810e.year = player_years.year + 1 left join "tdc2df159a562cbbc806616f329a24ef6" on "tdc2df159a562cbbc806616f329a24ef6"."pid" = "player"."pid" and tdc2df159a562cbbc806616f329a24ef6.year = player_years.year + 1 where player.pos IN ('RB') group by player.fname, player.lname, rosters_players.slot, rosters_players.tid, rosters_players.tag, "te70f12f316e28f29e682d081b42501b8"."v", "teb1a3a3f8fba95b1c24f7de5791bf1c8"."weighted_opportunity_from_plays", t1dbf22c1937bec7c71654579572c42ca.rate_type_total_count, "t35e2b83a964bf6fb14c995f79eb0c911"."fantasy_points_from_plays", t1dbf22c1937bec7c71654579572c42ca.rate_type_total_count, "t0c7bc1a8d2cb95b34c757cbb4f98810e"."weighted_opportunity_from_plays", t73744802b0ac3caa4590c0b0bf651d15.rate_type_total_count, "tdc2df159a562cbbc806616f329a24ef6"."fantasy_points_from_plays", t73744802b0ac3caa4590c0b0bf651d15.rate_type_total_count, "player_years"."year", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 12 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(twelve_hours)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('year splits with a column set to a specific year', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      view_id: '3db1cf6f-3f14-44a1-9a80-60ca32ed32d7',
      columns: [
        {
          column_id: 'team_expected_points_added_from_plays',
          params: {
            rate_type: ['per_game'],
            year: [
              2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013,
              2012, 2011, 2010, 2009, 2008, 2007, 2006, 2005, 2004, 2003, 2002,
              2001, 2000
            ],
            wp: [0.2, 0.8]
          }
        },
        {
          column_id: 'team_expected_points_added_from_plays',
          params: {
            rate_type: ['per_game'],
            year: [2023],
            wp: [0.2, 0.8]
          }
        }
      ],
      sort: [
        {
          column_id: 'team_expected_points_added_from_plays',
          desc: true
        }
      ],
      where: [
        {
          column_id: 'player_position',
          operator: 'IN',
          value: ['DST']
        }
      ],
      prefix_columns: ['player_name'],
      splits: ['year']
    })
    const expected_query = `with "base_years" as (SELECT unnest(ARRAY[2000,2001,2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023]) as year), "player_years" as (SELECT DISTINCT player.pid, base_years.year FROM player CROSS JOIN base_years), "t8358670d7f39fd42f703146a993469e2" as (select "nfl_plays"."off" as "team", count(distinct "nfl_plays"."esbid") as "rate_type_total_count", "nfl_plays"."year" from "nfl_plays" where "nfl_plays"."seas_type" in ('REG') and "nfl_plays"."year" in (2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023) group by "nfl_plays"."off", "nfl_plays"."year"), "t050484cbf058a2325074f348c791f92f" as (select "nfl_plays"."off" as "team", count(distinct "nfl_plays"."esbid") as "rate_type_total_count", "nfl_plays"."year" from "nfl_plays" where "nfl_plays"."seas_type" in ('REG') and "nfl_plays"."year" in (2023) group by "nfl_plays"."off", "nfl_plays"."year"), "t5d6ae237eb47cabf2bcec6fe0c74099c" as (select "nfl_plays"."off" as "nfl_team", SUM(epa) AS team_ep_added_from_plays, "nfl_plays"."year" from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."year" in (2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023) and "nfl_plays"."seas_type" in ('REG') and "nfl_plays"."wp" between 0.2 and 0.8 group by "nfl_plays"."off", "nfl_plays"."year"), "t5d6ae237eb47cabf2bcec6fe0c74099c_team_stats" as (select "t5d6ae237eb47cabf2bcec6fe0c74099c"."nfl_team", sum(t5d6ae237eb47cabf2bcec6fe0c74099c.team_ep_added_from_plays) as team_ep_added_from_plays, "t5d6ae237eb47cabf2bcec6fe0c74099c"."year" from "t5d6ae237eb47cabf2bcec6fe0c74099c" group by "t5d6ae237eb47cabf2bcec6fe0c74099c"."nfl_team", "t5d6ae237eb47cabf2bcec6fe0c74099c"."year"), "t7abd1b805b538192838894ed9d0723f5" as (select "nfl_plays"."off" as "nfl_team", SUM(epa) AS team_ep_added_from_plays, "nfl_plays"."year" from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."year" in (2023) and "nfl_plays"."seas_type" in ('REG') and "nfl_plays"."wp" between 0.2 and 0.8 group by "nfl_plays"."off", "nfl_plays"."year"), "t7abd1b805b538192838894ed9d0723f5_team_stats" as (select "t7abd1b805b538192838894ed9d0723f5"."nfl_team", sum(t7abd1b805b538192838894ed9d0723f5.team_ep_added_from_plays) as team_ep_added_from_plays, "t7abd1b805b538192838894ed9d0723f5"."year" from "t7abd1b805b538192838894ed9d0723f5" group by "t7abd1b805b538192838894ed9d0723f5"."nfl_team", "t7abd1b805b538192838894ed9d0723f5"."year") select "player"."pid", player.fname, player.lname, CAST(t5d6ae237eb47cabf2bcec6fe0c74099c_team_stats.team_ep_added_from_plays AS DECIMAL) / NULLIF(CAST(t8358670d7f39fd42f703146a993469e2.rate_type_total_count AS DECIMAL), 0) AS "team_ep_added_from_plays_0", CAST(t7abd1b805b538192838894ed9d0723f5_team_stats.team_ep_added_from_plays AS DECIMAL) / NULLIF(CAST(t050484cbf058a2325074f348c791f92f.rate_type_total_count AS DECIMAL), 0) AS "team_ep_added_from_plays_1", "player_years"."year", "player"."pos" from "player_years" inner join "player" on "player"."pid" = "player_years"."pid" left join "t8358670d7f39fd42f703146a993469e2" on "t8358670d7f39fd42f703146a993469e2"."team" = "player"."current_nfl_team" and "t8358670d7f39fd42f703146a993469e2"."year" = "player_years"."year" left join "t050484cbf058a2325074f348c791f92f" on "t050484cbf058a2325074f348c791f92f"."team" = "player"."current_nfl_team" and "t050484cbf058a2325074f348c791f92f"."year" = 2023 left join "t5d6ae237eb47cabf2bcec6fe0c74099c_team_stats" on "t5d6ae237eb47cabf2bcec6fe0c74099c_team_stats"."nfl_team" = "player"."current_nfl_team" and t5d6ae237eb47cabf2bcec6fe0c74099c_team_stats.year = player_years.year and t5d6ae237eb47cabf2bcec6fe0c74099c_team_stats.year IN (2000,2001,2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023) left join "t7abd1b805b538192838894ed9d0723f5_team_stats" on "t7abd1b805b538192838894ed9d0723f5_team_stats"."nfl_team" = "player"."current_nfl_team" and "t7abd1b805b538192838894ed9d0723f5_team_stats"."year" = 2023 where player.pos IN ('DST') group by player.fname, player.lname, "t5d6ae237eb47cabf2bcec6fe0c74099c_team_stats"."team_ep_added_from_plays", t8358670d7f39fd42f703146a993469e2.rate_type_total_count, "t7abd1b805b538192838894ed9d0723f5_team_stats"."team_ep_added_from_plays", t050484cbf058a2325074f348c791f92f.rate_type_total_count, "player_years"."year", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 4 DESC NULLS LAST, "player"."pid" asc limit 500`

    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(one_week)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('dynamic year param', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      sort: [
        {
          column_id: 'player_receiving_yards_from_plays',
          desc: true
        }
      ],
      prefix_columns: ['player_name'],
      columns: [
        {
          column_id: 'player_receiving_yards_from_plays',
          params: {
            year: [
              2023,
              {
                dynamic_type: 'last_n_years',
                value: 3
              }
            ]
          }
        }
      ],
      where: []
    })
    const years = []
    for (let i = constants.season.year - 2; i <= constants.season.year; i++) {
      years.push(i)
    }
    const expected_query = `with "taebf6a446d8236a599cb596c9bcc380b" as (select COALESCE(trg_pid) as pid, SUM(CASE WHEN comp = true THEN recv_yds ELSE 0 END) as rec_yds_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."year" in (${years.join(', ')}) and "nfl_plays"."seas_type" in ('REG') group by COALESCE(trg_pid)) select "player"."pid", player.fname, player.lname, "taebf6a446d8236a599cb596c9bcc380b"."rec_yds_from_plays" AS "rec_yds_from_plays_0", "player"."pos" from "player" left join "taebf6a446d8236a599cb596c9bcc380b" on "taebf6a446d8236a599cb596c9bcc380b"."pid" = "player"."pid" group by player.fname, player.lname, "taebf6a446d8236a599cb596c9bcc380b"."rec_yds_from_plays", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 4 DESC NULLS LAST, "player"."pid" asc limit 500`

    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(six_hours)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('games played', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      columns: [
        {
          column_id: 'player_games_played',
          params: {
            year: [2023]
          }
        }
      ],
      sort: [
        {
          column_id: 'player_games_played',
          desc: true
        }
      ]
    })
    const expected_query = `with "tb972f2cc9e2375df01dce515be38a32b" as (select "player_gamelogs"."pid", count(*) as "rate_type_total_count", array_agg(distinct player_gamelogs.tm) as teams from "player_gamelogs" left join "nfl_games" on "nfl_games"."esbid" = "player_gamelogs"."esbid" where "nfl_games"."seas_type" in ('REG') and "player_gamelogs"."active" = true and "nfl_games"."year" in (2023) group by "player_gamelogs"."pid") select "player"."pid", tb972f2cc9e2375df01dce515be38a32b.rate_type_total_count as games_played_0, "player"."pos" from "player" left join "tb972f2cc9e2375df01dce515be38a32b" on "tb972f2cc9e2375df01dce515be38a32b"."pid" = "player"."pid" group by tb972f2cc9e2375df01dce515be38a32b.rate_type_total_count, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(one_week)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('games played with multiple rate types', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      columns: [
        {
          column_id: 'player_games_played',
          params: {
            year: [2023]
          }
        },
        {
          column_id: 'player_receiving_yards_from_plays',
          params: {
            year: [2023],
            rate_type: ['per_game']
          }
        },
        {
          column_id: 'player_receiving_yards_from_plays',
          params: {
            year: [2023],
            week: [1, 2, 3],
            rate_type: ['per_game']
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
    const expected_query = `with "tb972f2cc9e2375df01dce515be38a32b" as (select "player_gamelogs"."pid", count(*) as "rate_type_total_count", array_agg(distinct player_gamelogs.tm) as teams from "player_gamelogs" left join "nfl_games" on "nfl_games"."esbid" = "player_gamelogs"."esbid" where "nfl_games"."seas_type" in ('REG') and "player_gamelogs"."active" = true and "nfl_games"."year" in (2023) group by "player_gamelogs"."pid"), "tca76bf03f2ed7fae455863d4191db6c0" as (select "player_gamelogs"."pid", count(*) as "rate_type_total_count", array_agg(distinct player_gamelogs.tm) as teams from "player_gamelogs" left join "nfl_games" on "nfl_games"."esbid" = "player_gamelogs"."esbid" where "nfl_games"."seas_type" in ('REG') and "player_gamelogs"."active" = true and "nfl_games"."year" in (2023) and "nfl_games"."week" in (1, 2, 3) group by "player_gamelogs"."pid"), "t9ae806c649624fe7332a653f6ce4f501" as (select COALESCE(trg_pid) as pid, SUM(CASE WHEN comp = true THEN recv_yds ELSE 0 END) as rec_yds_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."year" in (2023) and "nfl_plays"."seas_type" in ('REG') group by COALESCE(trg_pid)), "t5e61b2d9043b4d71c1311549f79d5fbd" as (select COALESCE(trg_pid) as pid, SUM(CASE WHEN comp = true THEN recv_yds ELSE 0 END) as rec_yds_from_plays from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."year" in (2023) and "nfl_plays"."week" in (1, 2, 3) and "nfl_plays"."seas_type" in ('REG') group by COALESCE(trg_pid)) select "player"."pid", tb972f2cc9e2375df01dce515be38a32b.rate_type_total_count as games_played_0, CAST(t9ae806c649624fe7332a653f6ce4f501.rec_yds_from_plays AS DECIMAL) / NULLIF(CAST(tb972f2cc9e2375df01dce515be38a32b.rate_type_total_count AS DECIMAL), 0) AS "rec_yds_from_plays_0", CAST(t5e61b2d9043b4d71c1311549f79d5fbd.rec_yds_from_plays AS DECIMAL) / NULLIF(CAST(tca76bf03f2ed7fae455863d4191db6c0.rate_type_total_count AS DECIMAL), 0) AS "rec_yds_from_plays_1", "player"."pos" from "player" left join "tb972f2cc9e2375df01dce515be38a32b" on "tb972f2cc9e2375df01dce515be38a32b"."pid" = "player"."pid" left join "tca76bf03f2ed7fae455863d4191db6c0" on "tca76bf03f2ed7fae455863d4191db6c0"."pid" = "player"."pid" left join "t9ae806c649624fe7332a653f6ce4f501" on "t9ae806c649624fe7332a653f6ce4f501"."pid" = "player"."pid" left join "t5e61b2d9043b4d71c1311549f79d5fbd" on "t5e61b2d9043b4d71c1311549f79d5fbd"."pid" = "player"."pid" group by tb972f2cc9e2375df01dce515be38a32b.rate_type_total_count, "t9ae806c649624fe7332a653f6ce4f501"."rec_yds_from_plays", tb972f2cc9e2375df01dce515be38a32b.rate_type_total_count, "t5e61b2d9043b4d71c1311549f79d5fbd"."rec_yds_from_plays", tca76bf03f2ed7fae455863d4191db6c0.rate_type_total_count, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 3 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(one_week)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  it('team success rate from plays', async () => {
    const { query, data_view_metadata } = await get_data_view_results_query({
      columns: [
        {
          column_id: 'team_success_rate_from_plays',
          params: {
            year: [2023]
          }
        }
      ],
      where: [
        {
          column_id: 'team_success_rate_from_plays',
          operator: '>',
          value: 0.4,
          params: {
            year: [2023]
          }
        }
      ],
      sort: [
        {
          column_id: 'team_success_rate_from_plays',
          desc: true
        }
      ]
    })
    const expected_query = `with "t36bf0474d4db796322b4fe1d9755f770" as (select "nfl_plays"."off" as "nfl_team", SUM(CASE WHEN successful_play = true THEN 1 ELSE 0 END) as team_success_rate_from_plays_numerator, COUNT(*) as team_success_rate_from_plays_denominator from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."year" in (2023) and "nfl_plays"."seas_type" in ('REG') group by "nfl_plays"."off"), "t36bf0474d4db796322b4fe1d9755f770_team_stats" as (select "t36bf0474d4db796322b4fe1d9755f770"."nfl_team", sum(t36bf0474d4db796322b4fe1d9755f770.team_success_rate_from_plays_numerator) / sum(t36bf0474d4db796322b4fe1d9755f770.team_success_rate_from_plays_denominator) as team_success_rate_from_plays from "t36bf0474d4db796322b4fe1d9755f770" group by "t36bf0474d4db796322b4fe1d9755f770"."nfl_team" having sum(t36bf0474d4db796322b4fe1d9755f770.team_success_rate_from_plays_numerator) / NULLIF(sum(t36bf0474d4db796322b4fe1d9755f770.team_success_rate_from_plays_denominator), 0) > '0.4') select "player"."pid", "t36bf0474d4db796322b4fe1d9755f770_team_stats"."team_success_rate_from_plays" AS "team_success_rate_from_plays_0", "player"."pos" from "player" inner join "t36bf0474d4db796322b4fe1d9755f770_team_stats" on "t36bf0474d4db796322b4fe1d9755f770_team_stats"."nfl_team" = "player"."current_nfl_team" group by "t36bf0474d4db796322b4fe1d9755f770_team_stats"."team_success_rate_from_plays", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
    expect(data_view_metadata.cache_ttl).to.equal(one_week)
    expect(data_view_metadata.cache_expire_at).to.equal(null)
  })

  describe('errors', () => {
    it('should throw an error if where value is missing', async () => {
      try {
        await get_data_view_results_query({
          prefix_columns: ['player_name'],
          columns: [
            {
              column_id: 'player_weighted_opportunity_rating_from_plays',
              params: {
                year: [2023]
              }
            },
            {
              column_id: 'player_bench_press'
            }
          ],
          where: [
            {
              column_id: 'player_position',
              operator: 'IN',
              value: ['WR']
            },
            {
              column_id: 'player_draft_position',
              operator: '=',
              value: ''
            }
          ],
          sort: [
            {
              column_id: 'player_weighted_opportunity_rating_from_plays',
              desc: true
            }
          ]
        })
      } catch (error) {
        expect(error.message).to.equal(
          "The 'where[1].value' field must be an alphanumeric string. (player_draft_position, =, )\nThe 'where[1].value' field must be a number. (player_draft_position, =, )\nThe 'where[1].value' field must be an array. (player_draft_position, =, )\nThe 'where[1].value' field must be an array. (player_draft_position, =, )"
        )
      }
    })
  })
})
