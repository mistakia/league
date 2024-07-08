/* global describe it */

import chai from 'chai'

import { get_players_table_view_results } from '#libs-server'
import { bookmaker_constants } from '#libs-shared'

const { expect } = chai

describe('LIBS SERVER get_players_table_view_results', () => {
  it('should return a query', () => {
    const query = get_players_table_view_results()
    const expected_query =
      'select "player"."pid", "player"."pos" from "player" group by "player"."pid", "player"."lname", "player"."fname", "player"."pos" limit 500'
    expect(query.toString()).to.equal(expected_query)
  })

  it('should handle player_target_share_from_plays', () => {
    const query = get_players_table_view_results({
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
    const expected_query = `with "t23df61ed52f89340704aeb465d8ca24d" as (select "pg"."pid", ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) as trg_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "trg_pid" is not null and "nfl_plays"."year" in (2023) group by "pg"."pid" having ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) >= '25') select "player"."pid", "t23df61ed52f89340704aeb465d8ca24d"."trg_share_from_plays" AS "trg_share_from_plays_0", player.fname, player.lname, "player"."pos" from "player" inner join "t23df61ed52f89340704aeb465d8ca24d" on "t23df61ed52f89340704aeb465d8ca24d"."pid" = "player"."pid" group by "t23df61ed52f89340704aeb465d8ca24d"."trg_share_from_plays", player.fname, player.lname, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST limit 500`
    expect(query.toString()).to.equal(expected_query)
  })

  it('should handle player_target_share_from_plays — duplicates', () => {
    const query = get_players_table_view_results({
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
    const expected_query = `with "t23df61ed52f89340704aeb465d8ca24d" as (select "pg"."pid", ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) as trg_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "trg_pid" is not null and "nfl_plays"."year" in (2023) group by "pg"."pid" having ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) >= '25') select "player"."pid", "t23df61ed52f89340704aeb465d8ca24d"."trg_share_from_plays" AS "trg_share_from_plays_0", "t23df61ed52f89340704aeb465d8ca24d"."trg_share_from_plays" AS "trg_share_from_plays_1", player.fname, player.lname, "player"."pos" from "player" inner join "t23df61ed52f89340704aeb465d8ca24d" on "t23df61ed52f89340704aeb465d8ca24d"."pid" = "player"."pid" group by "t23df61ed52f89340704aeb465d8ca24d"."trg_share_from_plays", "t23df61ed52f89340704aeb465d8ca24d"."trg_share_from_plays", player.fname, player.lname, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST limit 500`
    expect(query.toString()).to.equal(expected_query)
  })

  it('should handle player_target_share_from_plays - different params', () => {
    const query = get_players_table_view_results({
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
    const expected_query = `with "t23df61ed52f89340704aeb465d8ca24d" as (select "pg"."pid", ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) as trg_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "trg_pid" is not null and "nfl_plays"."year" in (2023) group by "pg"."pid" having ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) >= '25'), "t472de281ab34bb418078596ee8778b6e" as (select "pg"."pid", ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) as trg_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "trg_pid" is not null and "nfl_plays"."week" in (1, 2, 3) and "nfl_plays"."year" in (2022) group by "pg"."pid") select "player"."pid", "t23df61ed52f89340704aeb465d8ca24d"."trg_share_from_plays" AS "trg_share_from_plays_0", player.fname, player.lname, "t472de281ab34bb418078596ee8778b6e"."trg_share_from_plays" AS "trg_share_from_plays_1", "player"."pos" from "player" inner join "t23df61ed52f89340704aeb465d8ca24d" on "t23df61ed52f89340704aeb465d8ca24d"."pid" = "player"."pid" left join "t472de281ab34bb418078596ee8778b6e" on "t472de281ab34bb418078596ee8778b6e"."pid" = "player"."pid" group by "t23df61ed52f89340704aeb465d8ca24d"."trg_share_from_plays", player.fname, player.lname, "t472de281ab34bb418078596ee8778b6e"."trg_share_from_plays", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST limit 500`
    expect(query.toString()).to.equal(expected_query)
  })

  it('should handle player_air_yards_share_from_plays', () => {
    const query = get_players_table_view_results({
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
    const expected_query = `with "t95d58a7c19292047eb044a7569c8d3b7" as (select "pg"."pid", ROUND(100.0 * SUM(CASE WHEN nfl_plays.trg_pid = pg.pid THEN nfl_plays.dot ELSE 0 END) / SUM(nfl_plays.dot), 2) as air_yds_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "trg_pid" is not null and "nfl_plays"."year" in (2023) group by "pg"."pid" having ROUND(100.0 * SUM(CASE WHEN nfl_plays.trg_pid = pg.pid THEN nfl_plays.dot ELSE 0 END) / SUM(nfl_plays.dot), 2) >= '25') select "player"."pid", "t95d58a7c19292047eb044a7569c8d3b7"."air_yds_share_from_plays" AS "air_yds_share_from_plays_0", player.fname, player.lname, "player"."pos" from "player" inner join "t95d58a7c19292047eb044a7569c8d3b7" on "t95d58a7c19292047eb044a7569c8d3b7"."pid" = "player"."pid" group by "t95d58a7c19292047eb044a7569c8d3b7"."air_yds_share_from_plays", player.fname, player.lname, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST limit 500`
    expect(query.toString()).to.equal(expected_query)
  })

  it('should handle player_target_share_from_plays with a where clause', () => {
    const query = get_players_table_view_results({
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
    const expected_query = `with "tbd40f2a14d409cd91fbc0a18b45b71ee" as (select "trg_pid", COUNT(*) as trg_from_plays_0 from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."dwn" in (3) and "nfl_plays"."year" in (2023) group by "trg_pid" having COUNT(*) >= '15'), "t2c12493accfeb8c0534ed13322d31e5d" as (select "pg"."pid", ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) as trg_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "trg_pid" is not null and "nfl_plays"."dwn" in (3) and "nfl_plays"."year" in (2023) group by "pg"."pid"), "t2a71396eceddfeb38d87fdc5db6602dc" as (select "pg"."pid", ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) as trg_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "trg_pid" is not null and "nfl_plays"."qtr" in (1, 2) and "nfl_plays"."year" in (2023) group by "pg"."pid") select "player"."pid", "tbd40f2a14d409cd91fbc0a18b45b71ee"."trg_from_plays_0" as "trg_from_plays_0", player.fname, player.lname, "t2c12493accfeb8c0534ed13322d31e5d"."trg_share_from_plays" AS "trg_share_from_plays_0", "t2a71396eceddfeb38d87fdc5db6602dc"."trg_share_from_plays" AS "trg_share_from_plays_1", "player"."pos" from "player" inner join "tbd40f2a14d409cd91fbc0a18b45b71ee" on "tbd40f2a14d409cd91fbc0a18b45b71ee"."trg_pid" = "player"."pid" left join "t2c12493accfeb8c0534ed13322d31e5d" on "t2c12493accfeb8c0534ed13322d31e5d"."pid" = "player"."pid" left join "t2a71396eceddfeb38d87fdc5db6602dc" on "t2a71396eceddfeb38d87fdc5db6602dc"."pid" = "player"."pid" group by "tbd40f2a14d409cd91fbc0a18b45b71ee"."trg_from_plays_0", player.fname, player.lname, "t2c12493accfeb8c0534ed13322d31e5d"."trg_share_from_plays", "t2a71396eceddfeb38d87fdc5db6602dc"."trg_share_from_plays", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 5 DESC NULLS LAST limit 500`
    expect(query.toString()).to.equal(expected_query)
  })

  it('should create a split query — year', () => {
    const query = get_players_table_view_results({
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
    const expected_query = `with "te897328ba807f7e58ca6ce73498e6728" as (select "bc_pid", "nfl_plays"."year", SUM(rush_yds) as rush_yds_from_plays_0 from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."year" in (2020, 2021, 2022, 2023) group by "bc_pid", "nfl_plays"."year") select "player"."pid", player.fname, player.lname, "te897328ba807f7e58ca6ce73498e6728"."rush_yds_from_plays_0" as "rush_yds_from_plays_0", COALESCE(te897328ba807f7e58ca6ce73498e6728.year) AS year, "player"."pos" from "player" left join "te897328ba807f7e58ca6ce73498e6728" on "te897328ba807f7e58ca6ce73498e6728"."bc_pid" = "player"."pid" group by player.fname, player.lname, "te897328ba807f7e58ca6ce73498e6728"."rush_yds_from_plays_0", COALESCE(te897328ba807f7e58ca6ce73498e6728.year), "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 4 DESC NULLS LAST limit 500`
    expect(query.toString()).to.equal(expected_query)
  })

  it('should create a splits query — year', () => {
    const query = get_players_table_view_results({
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
    const expected_query = `with "te897328ba807f7e58ca6ce73498e6728" as (select "bc_pid", "nfl_plays"."year", SUM(rush_yds) as rush_yds_from_plays_0 from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."year" in (2020, 2021, 2022, 2023) group by "bc_pid", "nfl_plays"."year"), "t36eb8036eb7f23e3984aed70c6a18562" as (select "bc_pid", "nfl_plays"."year", CASE WHEN COUNT(*) > 0 THEN CAST(ROUND(SUM(rush_yds)::decimal / COUNT(*), 2) AS decimal) ELSE 0 END as rush_yds_per_att_from_plays_0 from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."year" in (2023) and "nfl_plays"."xpass_prob" between 0 and 0.4 group by "bc_pid", "nfl_plays"."year"), "tad1d4d985d9d01361b722f9a25bec4e2" as (select "bc_pid", "nfl_plays"."year", SUM(rush_yds) as rush_yds_from_plays_0 from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."dwn" in (1, 2) and "nfl_plays"."year" in (2020, 2021, 2022, 2023) group by "bc_pid", "nfl_plays"."year") select "player"."pid", player.fname, player.lname, "te897328ba807f7e58ca6ce73498e6728"."rush_yds_from_plays_0" as "rush_yds_from_plays_0", "t36eb8036eb7f23e3984aed70c6a18562"."rush_yds_per_att_from_plays_0" as "rush_yds_per_att_from_plays_0", "tad1d4d985d9d01361b722f9a25bec4e2"."rush_yds_from_plays_0" as "rush_yds_from_plays_1", COALESCE(te897328ba807f7e58ca6ce73498e6728.year, t36eb8036eb7f23e3984aed70c6a18562.year, tad1d4d985d9d01361b722f9a25bec4e2.year) AS year, "player"."pos" from "player" left join "te897328ba807f7e58ca6ce73498e6728" on "te897328ba807f7e58ca6ce73498e6728"."bc_pid" = "player"."pid" left join "t36eb8036eb7f23e3984aed70c6a18562" on "t36eb8036eb7f23e3984aed70c6a18562"."bc_pid" = "player"."pid" and "t36eb8036eb7f23e3984aed70c6a18562"."year" = "te897328ba807f7e58ca6ce73498e6728"."year" left join "tad1d4d985d9d01361b722f9a25bec4e2" on "tad1d4d985d9d01361b722f9a25bec4e2"."bc_pid" = "player"."pid" and "tad1d4d985d9d01361b722f9a25bec4e2"."year" = "t36eb8036eb7f23e3984aed70c6a18562"."year" group by player.fname, player.lname, "te897328ba807f7e58ca6ce73498e6728"."rush_yds_from_plays_0", "t36eb8036eb7f23e3984aed70c6a18562"."rush_yds_per_att_from_plays_0", "tad1d4d985d9d01361b722f9a25bec4e2"."rush_yds_from_plays_0", COALESCE(te897328ba807f7e58ca6ce73498e6728.year, t36eb8036eb7f23e3984aed70c6a18562.year, tad1d4d985d9d01361b722f9a25bec4e2.year), "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 4 DESC NULLS LAST limit 500`
    expect(query.toString()).to.equal(expected_query)
  })

  it('should create a splits query - year', () => {
    const query = get_players_table_view_results({
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
    const expected_query = `with "t5df8d6c0b0c39e921720ebff9566012e" as (select "pg"."pid", ROUND((1.5 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / NULLIF(COUNT(*), 0)) + (0.7 * SUM(CASE WHEN nfl_plays.trg_pid = pg.pid THEN nfl_plays.dot ELSE 0 END) / NULLIF(SUM(nfl_plays.dot), 0)), 4) as weighted_opp_rating_from_plays, "nfl_plays"."year" from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "trg_pid" is not null and "nfl_plays"."year" in (2022, 2023) and "nfl_plays"."xpass_prob" between 0.7 and 1 group by "pg"."pid", "nfl_plays"."year"), "t3cfa5b8e788e8297cd6165ce39934f53" as (select "trg_pid", "nfl_plays"."year", COUNT(*) as trg_from_plays_0 from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."year" in (2022, 2023) and "nfl_plays"."xpass_prob" between 0.7 and 1 group by "trg_pid", "nfl_plays"."year") select "player"."pid", player.fname, player.lname, "player"."pos" AS "pos_0", "t5df8d6c0b0c39e921720ebff9566012e"."weighted_opp_rating_from_plays" AS "weighted_opp_rating_from_plays_0", "t3cfa5b8e788e8297cd6165ce39934f53"."trg_from_plays_0" as "trg_from_plays_0", COALESCE(t5df8d6c0b0c39e921720ebff9566012e.year, t3cfa5b8e788e8297cd6165ce39934f53.year) AS year, "player"."pos" from "player" left join "t5df8d6c0b0c39e921720ebff9566012e" on "t5df8d6c0b0c39e921720ebff9566012e"."pid" = "player"."pid" left join "t3cfa5b8e788e8297cd6165ce39934f53" on "t3cfa5b8e788e8297cd6165ce39934f53"."trg_pid" = "player"."pid" and "t3cfa5b8e788e8297cd6165ce39934f53"."year" = "t5df8d6c0b0c39e921720ebff9566012e"."year" where player.pos IN ('WR') group by player.fname, player.lname, "player"."pos", "t5df8d6c0b0c39e921720ebff9566012e"."weighted_opp_rating_from_plays", "t3cfa5b8e788e8297cd6165ce39934f53"."trg_from_plays_0", COALESCE(t5df8d6c0b0c39e921720ebff9566012e.year, t3cfa5b8e788e8297cd6165ce39934f53.year), "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 5 DESC NULLS LAST limit 500`
    expect(query.toString()).to.equal(expected_query)
  })

  it('should create a splits query with espn open scores', () => {
    const query = get_players_table_view_results({
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
    const expected_query = `with "t4b837758849a7367667bddf72c2f4731" as (select "pg"."pid", ROUND((1.5 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / NULLIF(COUNT(*), 0)) + (0.7 * SUM(CASE WHEN nfl_plays.trg_pid = pg.pid THEN nfl_plays.dot ELSE 0 END) / NULLIF(SUM(nfl_plays.dot), 0)), 4) as weighted_opp_rating_from_plays, "nfl_plays"."year" from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "trg_pid" is not null group by "pg"."pid", "nfl_plays"."year") select "player"."pid", player.fname, player.lname, "player_seasonlogs"."espn_open_score" AS "espn_open_score_0", "t4b837758849a7367667bddf72c2f4731"."weighted_opp_rating_from_plays" AS "weighted_opp_rating_from_plays_0", COALESCE(player_seasonlogs.year, t4b837758849a7367667bddf72c2f4731.year) AS year, "player"."pos" from "player" left join "player_seasonlogs" on "player_seasonlogs"."pid" = "player"."pid" left join "t4b837758849a7367667bddf72c2f4731" on "t4b837758849a7367667bddf72c2f4731"."pid" = "player"."pid" and "t4b837758849a7367667bddf72c2f4731"."year" = "player_seasonlogs"."year" group by player.fname, player.lname, "player_seasonlogs"."espn_open_score", "t4b837758849a7367667bddf72c2f4731"."weighted_opp_rating_from_plays", COALESCE(player_seasonlogs.year, t4b837758849a7367667bddf72c2f4731.year), "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 4 DESC NULLS LAST limit 500`
    expect(query.toString()).to.equal(expected_query)
  })

  it('should create a query with fantasy points from seasonlogs', () => {
    const query = get_players_table_view_results({
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
    const expected_query = `select "player"."pid", player.fname, player.lname, "t2dc419c5ac00a6f3a1433df75f943988"."points" AS "points_from_seasonlogs_0", "t2dc419c5ac00a6f3a1433df75f943988"."points_per_game" AS "points_per_game_from_seasonlogs_0", "t2dc419c5ac00a6f3a1433df75f943988"."points_rnk" AS "points_rnk_from_seasonlogs_0", "t2dc419c5ac00a6f3a1433df75f943988"."points_pos_rnk" AS "points_pos_rnk_from_seasonlogs_0", "player"."pos" from "player" left join "scoring_format_player_seasonlogs" as "t2dc419c5ac00a6f3a1433df75f943988" on "t2dc419c5ac00a6f3a1433df75f943988"."pid" = "player"."pid" and t2dc419c5ac00a6f3a1433df75f943988.scoring_format_hash = '0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d' group by player.fname, player.lname, "t2dc419c5ac00a6f3a1433df75f943988"."points", "t2dc419c5ac00a6f3a1433df75f943988"."points_per_game", "t2dc419c5ac00a6f3a1433df75f943988"."points_rnk", "t2dc419c5ac00a6f3a1433df75f943988"."points_pos_rnk", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 4 DESC NULLS LAST limit 500`
    expect(query.toString()).to.equal(expected_query)
  })

  it('should create a query with fantasy points from careerlogs', () => {
    const query = get_players_table_view_results({
      prefix_columns: ['player_name'],
      columns: [
        'player_fantasy_points_from_careerlogs',
        'player_fantasy_points_per_game_from_careerlogs',
        'player_fantasy_games_played_from_careerlogs',
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
    const expected_query = `select "player"."pid", player.fname, player.lname, "t0984699909800a4c1372fbe19abf07af"."points" AS "points_from_careerlogs_0", "t0984699909800a4c1372fbe19abf07af"."points_per_game" AS "points_per_game_from_careerlogs_0", "t0984699909800a4c1372fbe19abf07af"."games" AS "games_from_careerlogs_0", "t0984699909800a4c1372fbe19abf07af"."top_3" AS "top_3_from_careerlogs_0", "t0984699909800a4c1372fbe19abf07af"."top_6" AS "top_6_from_careerlogs_0", "t0984699909800a4c1372fbe19abf07af"."top_12" AS "top_12_from_careerlogs_0", "t0984699909800a4c1372fbe19abf07af"."top_24" AS "top_24_from_careerlogs_0", "t0984699909800a4c1372fbe19abf07af"."top_36" AS "top_36_from_careerlogs_0", "player"."pos" from "player" left join "scoring_format_player_careerlogs" as "t0984699909800a4c1372fbe19abf07af" on "t0984699909800a4c1372fbe19abf07af"."pid" = "player"."pid" and t0984699909800a4c1372fbe19abf07af.scoring_format_hash = '0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d' group by player.fname, player.lname, "t0984699909800a4c1372fbe19abf07af"."points", "t0984699909800a4c1372fbe19abf07af"."points_per_game", "t0984699909800a4c1372fbe19abf07af"."games", "t0984699909800a4c1372fbe19abf07af"."top_3", "t0984699909800a4c1372fbe19abf07af"."top_6", "t0984699909800a4c1372fbe19abf07af"."top_12", "t0984699909800a4c1372fbe19abf07af"."top_24", "t0984699909800a4c1372fbe19abf07af"."top_36", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 4 DESC NULLS LAST limit 500`
    expect(query.toString()).to.equal(expected_query)
  })

  it('should create a query with fields from league format seasonlogs and careerlogs', () => {
    const query = get_players_table_view_results({
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
    const expected_query = `select "player"."pid", player.fname, player.lname, "tbf494cbb4bcb89adaa6d672c8bfb17c2"."startable_games" AS "startable_games_from_seasonlogs_0", "tbf494cbb4bcb89adaa6d672c8bfb17c2"."points_added" AS "points_added_from_seasonlogs_0", "tbf494cbb4bcb89adaa6d672c8bfb17c2"."points_added_per_game" AS "points_added_per_game_from_seasonlogs_0", "tbf494cbb4bcb89adaa6d672c8bfb17c2"."points_added_rnk" AS "points_added_rnk_from_seasonlogs_0", "tbf494cbb4bcb89adaa6d672c8bfb17c2"."points_added_pos_rnk" AS "points_added_pos_rnk_from_seasonlogs_0", "t2c88ab25d4acbc66daf6137b64987326"."startable_games" AS "startable_games_from_careerlogs_0", "t2c88ab25d4acbc66daf6137b64987326"."points_added" AS "points_added_from_careerlogs_0", "t2c88ab25d4acbc66daf6137b64987326"."points_added_per_game" AS "points_added_per_game_from_careerlogs_0", "t2c88ab25d4acbc66daf6137b64987326"."best_season_points_added_per_game" AS "best_season_points_added_per_game_from_careerlogs_0", "t2c88ab25d4acbc66daf6137b64987326"."points_added_first_three_seas" AS "points_added_first_three_seas_from_careerlogs_0", "t2c88ab25d4acbc66daf6137b64987326"."points_added_first_four_seas" AS "points_added_first_four_seas_from_careerlogs_0", "t2c88ab25d4acbc66daf6137b64987326"."points_added_first_five_seas" AS "points_added_first_five_seas_from_careerlogs_0", "t2c88ab25d4acbc66daf6137b64987326"."points_added_first_seas" AS "points_added_first_seas_from_careerlogs_0", "t2c88ab25d4acbc66daf6137b64987326"."points_added_second_seas" AS "points_added_second_seas_from_careerlogs_0", "t2c88ab25d4acbc66daf6137b64987326"."points_added_third_seas" AS "points_added_third_seas_from_careerlogs_0", "t2c88ab25d4acbc66daf6137b64987326"."draft_rank" AS "draft_rank_from_careerlogs_0", "player"."pos" from "player" left join "league_format_player_seasonlogs" as "tbf494cbb4bcb89adaa6d672c8bfb17c2" on "tbf494cbb4bcb89adaa6d672c8bfb17c2"."pid" = "player"."pid" and tbf494cbb4bcb89adaa6d672c8bfb17c2.league_format_hash = '1985e1968b75707ebcab9da620176a0b218c5c1bd28d00cbbc4d1744a1631d0b' left join "league_format_player_careerlogs" as "t2c88ab25d4acbc66daf6137b64987326" on "t2c88ab25d4acbc66daf6137b64987326"."pid" = "player"."pid" and t2c88ab25d4acbc66daf6137b64987326.league_format_hash = '1985e1968b75707ebcab9da620176a0b218c5c1bd28d00cbbc4d1744a1631d0b' group by player.fname, player.lname, "tbf494cbb4bcb89adaa6d672c8bfb17c2"."startable_games", "tbf494cbb4bcb89adaa6d672c8bfb17c2"."points_added", "tbf494cbb4bcb89adaa6d672c8bfb17c2"."points_added_per_game", "tbf494cbb4bcb89adaa6d672c8bfb17c2"."points_added_rnk", "tbf494cbb4bcb89adaa6d672c8bfb17c2"."points_added_pos_rnk", "t2c88ab25d4acbc66daf6137b64987326"."startable_games", "t2c88ab25d4acbc66daf6137b64987326"."points_added", "t2c88ab25d4acbc66daf6137b64987326"."points_added_per_game", "t2c88ab25d4acbc66daf6137b64987326"."best_season_points_added_per_game", "t2c88ab25d4acbc66daf6137b64987326"."points_added_first_three_seas", "t2c88ab25d4acbc66daf6137b64987326"."points_added_first_four_seas", "t2c88ab25d4acbc66daf6137b64987326"."points_added_first_five_seas", "t2c88ab25d4acbc66daf6137b64987326"."points_added_first_seas", "t2c88ab25d4acbc66daf6137b64987326"."points_added_second_seas", "t2c88ab25d4acbc66daf6137b64987326"."points_added_third_seas", "t2c88ab25d4acbc66daf6137b64987326"."draft_rank", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 11 DESC NULLS LAST limit 500`
    expect(query.toString()).to.equal(expected_query)
  })

  it('should create a query with fields from season prop betting markets', () => {
    const query = get_players_table_view_results({
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
    const expected_query = `with "t90ccccbf252ed1f0c385dcf7a959d737_markets" as (select "source_id", "source_market_id", "time_type" from "prop_markets_index" where "market_type" = 'SEASON_PASSING_YARDS' and "time_type" = 'CLOSE' and "prop_markets_index"."year" = 2024 and "source_id" = 'FANDUEL'), "t90ccccbf252ed1f0c385dcf7a959d737" as (select "pms"."selection_pid", "pms"."selection_metric_line" from "t90ccccbf252ed1f0c385dcf7a959d737_markets" as "m" inner join "prop_market_selections_index" as "pms" on "pms"."source_id" = "m"."source_id" and "pms"."source_market_id" = "m"."source_market_id" and "pms"."time_type" = "m"."time_type"), "t61d004f21f7442a9de38c5af1116adcf_markets" as (select "source_id", "source_market_id", "time_type" from "prop_markets_index" where "market_type" = 'SEASON_RECEIVING_YARDS' and "time_type" = 'CLOSE' and "prop_markets_index"."year" = 2024 and "source_id" = 'FANDUEL'), "t61d004f21f7442a9de38c5af1116adcf" as (select "pms"."selection_pid", "pms"."selection_metric_line" from "t61d004f21f7442a9de38c5af1116adcf_markets" as "m" inner join "prop_market_selections_index" as "pms" on "pms"."source_id" = "m"."source_id" and "pms"."source_market_id" = "m"."source_market_id" and "pms"."time_type" = "m"."time_type"), "td32ee11d651efc0763da30d1d379bee0_markets" as (select "source_id", "source_market_id", "time_type" from "prop_markets_index" where "market_type" = 'SEASON_RUSHING_YARDS' and "time_type" = 'CLOSE' and "prop_markets_index"."year" = 2024 and "source_id" = 'FANDUEL'), "td32ee11d651efc0763da30d1d379bee0" as (select "pms"."selection_pid", "pms"."selection_metric_line" from "td32ee11d651efc0763da30d1d379bee0_markets" as "m" inner join "prop_market_selections_index" as "pms" on "pms"."source_id" = "m"."source_id" and "pms"."source_market_id" = "m"."source_market_id" and "pms"."time_type" = "m"."time_type") select "player"."pid", player.fname, player.lname, "t90ccccbf252ed1f0c385dcf7a959d737"."selection_metric_line" AS "season_prop_line_betting_market_0", "t61d004f21f7442a9de38c5af1116adcf"."selection_metric_line" AS "season_prop_line_betting_market_1", "td32ee11d651efc0763da30d1d379bee0"."selection_metric_line" AS "season_prop_line_betting_market_2", "player"."pos" from "player" left join "t90ccccbf252ed1f0c385dcf7a959d737" on "t90ccccbf252ed1f0c385dcf7a959d737"."selection_pid" = "player"."pid" left join "t61d004f21f7442a9de38c5af1116adcf" on "t61d004f21f7442a9de38c5af1116adcf"."selection_pid" = "player"."pid" left join "td32ee11d651efc0763da30d1d379bee0" on "td32ee11d651efc0763da30d1d379bee0"."selection_pid" = "player"."pid" group by player.fname, player.lname, "t90ccccbf252ed1f0c385dcf7a959d737"."selection_metric_line", "t61d004f21f7442a9de38c5af1116adcf"."selection_metric_line", "td32ee11d651efc0763da30d1d379bee0"."selection_metric_line", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 5 DESC NULLS LAST limit 500`
    expect(query.toString()).to.equal(expected_query)
  })

  it('should create a query with field from player game prop betting markets', () => {
    const query = get_players_table_view_results({
      prefix_columns: ['player_name'],
      columns: [
        {
          column_id: 'player_game_prop_line_from_betting_markets',
          params: {
            market_type:
              bookmaker_constants.player_prop_types.GAME_PASSING_YARDS,
            year: 2023,
            week: 1
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
    const expected_query = `with "t8ccbf7bf339257f09417974c12388ba0_markets" as (select "source_id", "source_market_id", "time_type" from "prop_markets_index" inner join "nfl_games" on "nfl_games"."esbid" = "prop_markets_index"."esbid" and "nfl_games"."year" = "prop_markets_index"."year" and "nfl_games"."week" = 1 where "market_type" = 'GAME_PASSING_YARDS' and "time_type" = 'CLOSE' and "prop_markets_index"."year" = 2023 and "source_id" = 'FANDUEL'), "t8ccbf7bf339257f09417974c12388ba0" as (select "pms"."selection_pid", "pms"."selection_metric_line" from "t8ccbf7bf339257f09417974c12388ba0_markets" as "m" inner join "prop_market_selections_index" as "pms" on "pms"."source_id" = "m"."source_id" and "pms"."source_market_id" = "m"."source_market_id" and "pms"."time_type" = "m"."time_type") select "player"."pid", player.fname, player.lname, "t8ccbf7bf339257f09417974c12388ba0"."selection_metric_line" AS "game_prop_line_betting_market_0", "player"."pos" from "player" left join "t8ccbf7bf339257f09417974c12388ba0" on "t8ccbf7bf339257f09417974c12388ba0"."selection_pid" = "player"."pid" group by player.fname, player.lname, "t8ccbf7bf339257f09417974c12388ba0"."selection_metric_line", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 4 DESC NULLS LAST limit 500`
    expect(query.toString()).to.equal(expected_query)
  })

  it('should create a query showing career gamelogs with a where filter on first game receiving yards', () => {
    const query = get_players_table_view_results({
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
    const expected_query = `with "t32dfac7daca0c49dec9d886ff17738a0" as (select "pg"."pid", ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) as trg_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "trg_pid" is not null and "pg"."career_game" between 1 and 1 group by "pg"."pid" having ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) >= '15') select "player"."pid", "t32dfac7daca0c49dec9d886ff17738a0"."trg_share_from_plays" AS "trg_share_from_plays_0", player.fname, player.lname, "t0984699909800a4c1372fbe19abf07af"."top_1" AS "top_1_from_careerlogs_0", "t0984699909800a4c1372fbe19abf07af"."top_3" AS "top_3_from_careerlogs_0", "t0984699909800a4c1372fbe19abf07af"."top_6" AS "top_6_from_careerlogs_0", "t0984699909800a4c1372fbe19abf07af"."top_12" AS "top_12_from_careerlogs_0", "player"."pos" from "player" inner join "t32dfac7daca0c49dec9d886ff17738a0" on "t32dfac7daca0c49dec9d886ff17738a0"."pid" = "player"."pid" left join "scoring_format_player_careerlogs" as "t0984699909800a4c1372fbe19abf07af" on "t0984699909800a4c1372fbe19abf07af"."pid" = "player"."pid" and t0984699909800a4c1372fbe19abf07af.scoring_format_hash = '0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d' group by "t32dfac7daca0c49dec9d886ff17738a0"."trg_share_from_plays", player.fname, player.lname, "t0984699909800a4c1372fbe19abf07af"."top_1", "t0984699909800a4c1372fbe19abf07af"."top_3", "t0984699909800a4c1372fbe19abf07af"."top_6", "t0984699909800a4c1372fbe19abf07af"."top_12", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 5 DESC NULLS LAST limit 500`
    expect(query.toString()).to.equal(expected_query)
  })

  it('should create a query for season projected stats', () => {
    const query = get_players_table_view_results({
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
    const expected_query = `select "player"."pid", player.fname, player.lname, CASE WHEN rosters_players.slot = 13 THEN 'injured_reserve' WHEN rosters_players.slot = 12 THEN 'practice_squad' WHEN rosters_players.slot IS NULL THEN 'free_agent' ELSE 'active_roster' END AS player_league_roster_status, rosters_players.slot, rosters_players.tid, rosters_players.tag, "t26d9d9efaab14f81317e0aab19bb619c"."pts_added" AS "season_projected_points_added_0", "t0dfe1f40a872fb6aad6963492077913c"."total" AS "season_projected_points_0", "t06adaa2b44f8b40e476affee9748a3c5"."py" AS "season_projected_pass_yds_0", "t06adaa2b44f8b40e476affee9748a3c5"."tdp" AS "season_projected_pass_tds_0", "t06adaa2b44f8b40e476affee9748a3c5"."ints" AS "season_projected_pass_ints_0", "t06adaa2b44f8b40e476affee9748a3c5"."ra" AS "season_projected_rush_atts_0", "t06adaa2b44f8b40e476affee9748a3c5"."ry" AS "season_projected_rush_yds_0", "t06adaa2b44f8b40e476affee9748a3c5"."tdr" AS "season_projected_rush_tds_0", "t06adaa2b44f8b40e476affee9748a3c5"."fuml" AS "season_projected_fumbles_lost_0", "t06adaa2b44f8b40e476affee9748a3c5"."trg" AS "season_projected_targets_0", "t06adaa2b44f8b40e476affee9748a3c5"."rec" AS "season_projected_recs_0", "t06adaa2b44f8b40e476affee9748a3c5"."recy" AS "season_projected_rec_yds_0", "t06adaa2b44f8b40e476affee9748a3c5"."tdrec" AS "season_projected_rec_tds_0", "player"."pos" from "player" left join "rosters_players" on "rosters_players"."pid" = "player"."pid" and "rosters_players"."year" = 2024 and "rosters_players"."week" = 0 and "rosters_players"."lid" = 1 left join "league_format_player_projection_values" as "t26d9d9efaab14f81317e0aab19bb619c" on "t26d9d9efaab14f81317e0aab19bb619c"."pid" = "player"."pid" and "t26d9d9efaab14f81317e0aab19bb619c"."league_format_hash" = '1985e1968b75707ebcab9da620176a0b218c5c1bd28d00cbbc4d1744a1631d0b' and "t26d9d9efaab14f81317e0aab19bb619c"."year" = 2023 and "t26d9d9efaab14f81317e0aab19bb619c"."week" = '0' left join "scoring_format_player_projection_points" as "t0dfe1f40a872fb6aad6963492077913c" on "t0dfe1f40a872fb6aad6963492077913c"."pid" = "player"."pid" and "t0dfe1f40a872fb6aad6963492077913c"."scoring_format_hash" = '0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d' and "t0dfe1f40a872fb6aad6963492077913c"."year" = 2023 and "t0dfe1f40a872fb6aad6963492077913c"."week" = '0' left join "projections_index" as "t06adaa2b44f8b40e476affee9748a3c5" on "t06adaa2b44f8b40e476affee9748a3c5"."pid" = "player"."pid" and "t06adaa2b44f8b40e476affee9748a3c5"."sourceid" = 18 and "t06adaa2b44f8b40e476affee9748a3c5"."year" = 2023 and "t06adaa2b44f8b40e476affee9748a3c5"."week" = 0 group by player.fname, player.lname, rosters_players.slot, rosters_players.tid, rosters_players.tag, "t26d9d9efaab14f81317e0aab19bb619c"."pts_added", "t0dfe1f40a872fb6aad6963492077913c"."total", "t06adaa2b44f8b40e476affee9748a3c5"."py", "t06adaa2b44f8b40e476affee9748a3c5"."tdp", "t06adaa2b44f8b40e476affee9748a3c5"."ints", "t06adaa2b44f8b40e476affee9748a3c5"."ra", "t06adaa2b44f8b40e476affee9748a3c5"."ry", "t06adaa2b44f8b40e476affee9748a3c5"."tdr", "t06adaa2b44f8b40e476affee9748a3c5"."fuml", "t06adaa2b44f8b40e476affee9748a3c5"."trg", "t06adaa2b44f8b40e476affee9748a3c5"."rec", "t06adaa2b44f8b40e476affee9748a3c5"."recy", "t06adaa2b44f8b40e476affee9748a3c5"."tdrec", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 8 DESC NULLS LAST limit 500`
    expect(query.toString()).to.equal(expected_query)
  })

  it('should create a query for week projected stats', () => {
    const query = get_players_table_view_results({
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
    const expected_query = `select "player"."pid", player.fname, player.lname, CASE WHEN rosters_players.slot = 13 THEN 'injured_reserve' WHEN rosters_players.slot = 12 THEN 'practice_squad' WHEN rosters_players.slot IS NULL THEN 'free_agent' ELSE 'active_roster' END AS player_league_roster_status, rosters_players.slot, rosters_players.tid, rosters_players.tag, "tdaa3548559fc3de994ece727a3d03fa9"."py" AS "week_projected_pass_yds_0", "player"."pos" from "player" left join "rosters_players" on "rosters_players"."pid" = "player"."pid" and "rosters_players"."year" = 2024 and "rosters_players"."week" = 0 and "rosters_players"."lid" = 1 left join "projections_index" as "tdaa3548559fc3de994ece727a3d03fa9" on "tdaa3548559fc3de994ece727a3d03fa9"."pid" = "player"."pid" and "tdaa3548559fc3de994ece727a3d03fa9"."sourceid" = 18 and "tdaa3548559fc3de994ece727a3d03fa9"."year" = 2023 and "tdaa3548559fc3de994ece727a3d03fa9"."week" = 2 group by player.fname, player.lname, rosters_players.slot, rosters_players.tid, rosters_players.tag, "tdaa3548559fc3de994ece727a3d03fa9"."py", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 8 DESC NULLS LAST limit 500`
    expect(query.toString()).to.equal(expected_query)
  })

  it('should craete a query for season projected stats - split', () => {
    const query = get_players_table_view_results({
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
    const expected_query = `with "tc20e537e9f5c1e2b620a9a893f4363c5" as (select "bc_pid", "nfl_plays"."year", COUNT(*) as rush_atts_from_plays_0 from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' group by "bc_pid", "nfl_plays"."year") select "player"."pid", player.fname, player.lname, "player"."pos" AS "pos_0", "t06adaa2b44f8b40e476affee9748a3c5"."ra" AS "season_projected_rush_atts_0", "t6f54c05eac6ba296f8748f9026c2d01f"."ry" AS "season_projected_rush_yds_0", "tc20e537e9f5c1e2b620a9a893f4363c5"."rush_atts_from_plays_0" as "rush_atts_from_plays_0", COALESCE(t06adaa2b44f8b40e476affee9748a3c5.year, t6f54c05eac6ba296f8748f9026c2d01f.year, tc20e537e9f5c1e2b620a9a893f4363c5.year) AS year, "player"."pos" from "player" left join "projections_index" as "t06adaa2b44f8b40e476affee9748a3c5" on "t06adaa2b44f8b40e476affee9748a3c5"."pid" = "player"."pid" and "t06adaa2b44f8b40e476affee9748a3c5"."sourceid" = 18 and t06adaa2b44f8b40e476affee9748a3c5.year IN (2023,2022,2021,2020) and "t06adaa2b44f8b40e476affee9748a3c5"."week" = 0 left join "projections_index" as "t6f54c05eac6ba296f8748f9026c2d01f" on "t6f54c05eac6ba296f8748f9026c2d01f"."pid" = "player"."pid" and "t6f54c05eac6ba296f8748f9026c2d01f"."sourceid" = 18 and "t6f54c05eac6ba296f8748f9026c2d01f"."year" = "t06adaa2b44f8b40e476affee9748a3c5"."year" and "t6f54c05eac6ba296f8748f9026c2d01f"."week" = 0 left join "tc20e537e9f5c1e2b620a9a893f4363c5" on "tc20e537e9f5c1e2b620a9a893f4363c5"."bc_pid" = "player"."pid" and "tc20e537e9f5c1e2b620a9a893f4363c5"."year" = "t6f54c05eac6ba296f8748f9026c2d01f"."year" where player.pos IN ('RB') group by player.fname, player.lname, "player"."pos", "t06adaa2b44f8b40e476affee9748a3c5"."ra", "t6f54c05eac6ba296f8748f9026c2d01f"."ry", "tc20e537e9f5c1e2b620a9a893f4363c5"."rush_atts_from_plays_0", COALESCE(t06adaa2b44f8b40e476affee9748a3c5.year, t6f54c05eac6ba296f8748f9026c2d01f.year, tc20e537e9f5c1e2b620a9a893f4363c5.year), "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 5 DESC NULLS LAST limit 500`
    expect(query.toString()).to.equal(expected_query)
  })

  it('should create a query with an N+1 column', () => {
    const query = get_players_table_view_results({
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
          column_id: 'player_fantasy_games_played_from_seasonlogs',
          operator: '>=',
          value: '6'
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
    const expected_query = `with "ta63d8ed2b36aa7991f012f824b1ea3c7" as (select "trg_pid", "nfl_plays"."year", SUM(CASE WHEN comp = true THEN recv_yds ELSE 0 END) as rec_yds_from_plays_0, COUNT(*) as trg_from_plays_0 from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' group by "trg_pid", "nfl_plays"."year" having COUNT(*) >= '55'), "t143e1334643ade4e0ed9c4eb25ce3272" as (select "pg"."pid", ROUND(100.0 * SUM(CASE WHEN nfl_plays.trg_pid = pg.pid THEN CASE WHEN nfl_plays.fd THEN 1 ELSE 0 END ELSE 0 END) / NULLIF(SUM(CASE WHEN nfl_plays.fd THEN 1 ELSE 0 END), 0), 2) as recv_first_down_share_from_plays, "nfl_plays"."year" from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "trg_pid" is not null and "nfl_plays"."year" in (2017, 2018, 2019, 2020, 2021, 2022, 2023) group by "pg"."pid", "nfl_plays"."year"), "tc20e537e9f5c1e2b620a9a893f4363c5" as (select "bc_pid", "nfl_plays"."year", SUM(rush_yds) as rush_yds_from_plays_0 from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' group by "bc_pid", "nfl_plays"."year") select "player"."pid", player.fname, player.lname, "player"."pos" AS "pos_0", "ta63d8ed2b36aa7991f012f824b1ea3c7"."rec_yds_from_plays_0" as "rec_yds_from_plays_0", "t154eac9f9dbf17872b2f79e5a75b67cc"."games" AS "games_from_seasonlogs_0", "player_seasonlogs"."espn_overall_score" AS "espn_overall_score_0", "t143e1334643ade4e0ed9c4eb25ce3272"."recv_first_down_share_from_plays" AS "recv_first_down_share_from_plays_0", "t8a4a84e735183537b2ba13726efd3e32"."points_per_game" AS "points_per_game_from_seasonlogs_0", "t43dad6b6c946e7f3d08b4cb24334c705"."points_per_game" AS "points_per_game_from_seasonlogs_1", "tc20e537e9f5c1e2b620a9a893f4363c5"."rush_yds_from_plays_0" as "rush_yds_from_plays_0", COALESCE(ta63d8ed2b36aa7991f012f824b1ea3c7.year, t154eac9f9dbf17872b2f79e5a75b67cc.year, player_seasonlogs.year, t143e1334643ade4e0ed9c4eb25ce3272.year, t8a4a84e735183537b2ba13726efd3e32.year, t43dad6b6c946e7f3d08b4cb24334c705.year, tc20e537e9f5c1e2b620a9a893f4363c5.year) AS year, "player"."pos" from "player" inner join "ta63d8ed2b36aa7991f012f824b1ea3c7" on "ta63d8ed2b36aa7991f012f824b1ea3c7"."trg_pid" = "player"."pid" inner join "scoring_format_player_seasonlogs" as "t154eac9f9dbf17872b2f79e5a75b67cc" on "t154eac9f9dbf17872b2f79e5a75b67cc"."pid" = "player"."pid" and t154eac9f9dbf17872b2f79e5a75b67cc.scoring_format_hash = '0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d' and "t154eac9f9dbf17872b2f79e5a75b67cc"."year" = "ta63d8ed2b36aa7991f012f824b1ea3c7"."year" inner join "player_seasonlogs" on "player_seasonlogs"."pid" = "player"."pid" and "player_seasonlogs"."year" = "t154eac9f9dbf17872b2f79e5a75b67cc"."year" left join "t143e1334643ade4e0ed9c4eb25ce3272" on "t143e1334643ade4e0ed9c4eb25ce3272"."pid" = "player"."pid" and "t143e1334643ade4e0ed9c4eb25ce3272"."year" = "player_seasonlogs"."year" left join "scoring_format_player_seasonlogs" as "t8a4a84e735183537b2ba13726efd3e32" on "t8a4a84e735183537b2ba13726efd3e32"."pid" = "player"."pid" and t8a4a84e735183537b2ba13726efd3e32.scoring_format_hash = '0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d' and "t8a4a84e735183537b2ba13726efd3e32"."year" = "t143e1334643ade4e0ed9c4eb25ce3272"."year" left join "scoring_format_player_seasonlogs" as "t43dad6b6c946e7f3d08b4cb24334c705" on "t43dad6b6c946e7f3d08b4cb24334c705"."pid" = "player"."pid" and t43dad6b6c946e7f3d08b4cb24334c705.scoring_format_hash = '0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d' and t43dad6b6c946e7f3d08b4cb24334c705.year = t8a4a84e735183537b2ba13726efd3e32.year + -3 left join "tc20e537e9f5c1e2b620a9a893f4363c5" on "tc20e537e9f5c1e2b620a9a893f4363c5"."bc_pid" = "player"."pid" and "tc20e537e9f5c1e2b620a9a893f4363c5"."year" = "t43dad6b6c946e7f3d08b4cb24334c705"."year" where player.pos IN ('WR') and t154eac9f9dbf17872b2f79e5a75b67cc.games >= '6' and player_seasonlogs.espn_overall_score > '0' group by player.fname, player.lname, "player"."pos", "ta63d8ed2b36aa7991f012f824b1ea3c7"."rec_yds_from_plays_0", "t154eac9f9dbf17872b2f79e5a75b67cc"."games", "player_seasonlogs"."espn_overall_score", "t143e1334643ade4e0ed9c4eb25ce3272"."recv_first_down_share_from_plays", "t8a4a84e735183537b2ba13726efd3e32"."points_per_game", "t43dad6b6c946e7f3d08b4cb24334c705"."points_per_game", "tc20e537e9f5c1e2b620a9a893f4363c5"."rush_yds_from_plays_0", COALESCE(ta63d8ed2b36aa7991f012f824b1ea3c7.year, t154eac9f9dbf17872b2f79e5a75b67cc.year, player_seasonlogs.year, t143e1334643ade4e0ed9c4eb25ce3272.year, t8a4a84e735183537b2ba13726efd3e32.year, t43dad6b6c946e7f3d08b4cb24334c705.year, tc20e537e9f5c1e2b620a9a893f4363c5.year), "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 9 DESC NULLS LAST limit 500`
    expect(query.toString()).to.equal(expected_query)
  })

  describe('errors', () => {
    it('should throw an error if where value is missing', () => {
      try {
        get_players_table_view_results({
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
