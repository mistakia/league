/* global describe it */

import chai from 'chai'

import { get_players_table_view_results } from '#libs-server'
import { bookmaker_constants } from '#libs-shared'

const { expect } = chai

describe('LIBS SERVER get_players_table_view_results', () => {
  it('should return a query', () => {
    const query = get_players_table_view_results()
    const expected_query =
      'select "player"."pid", "player"."pos" from "player" group by "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by "player"."pid" asc limit 500'
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
    const expected_query = `with "t7ce618d9efd1bad910446e01527397b9" as (select "pg"."pid", ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) as trg_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and ("trg_pid" is not null) and "nfl_plays"."year" in (2023) group by "pg"."pid" having ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) >= '25') select "player"."pid", "t7ce618d9efd1bad910446e01527397b9"."trg_share_from_plays" AS "trg_share_from_plays_0", player.fname, player.lname, "player"."pos" from "player" inner join "t7ce618d9efd1bad910446e01527397b9" on "t7ce618d9efd1bad910446e01527397b9"."pid" = "player"."pid" group by "t7ce618d9efd1bad910446e01527397b9"."trg_share_from_plays", player.fname, player.lname, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
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
    const expected_query = `with "t7ce618d9efd1bad910446e01527397b9" as (select "pg"."pid", ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) as trg_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and ("trg_pid" is not null) and "nfl_plays"."year" in (2023) group by "pg"."pid" having ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) >= '25') select "player"."pid", "t7ce618d9efd1bad910446e01527397b9"."trg_share_from_plays" AS "trg_share_from_plays_0", "t7ce618d9efd1bad910446e01527397b9"."trg_share_from_plays" AS "trg_share_from_plays_1", player.fname, player.lname, "player"."pos" from "player" inner join "t7ce618d9efd1bad910446e01527397b9" on "t7ce618d9efd1bad910446e01527397b9"."pid" = "player"."pid" group by "t7ce618d9efd1bad910446e01527397b9"."trg_share_from_plays", "t7ce618d9efd1bad910446e01527397b9"."trg_share_from_plays", player.fname, player.lname, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
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
    const expected_query = `with "t7ce618d9efd1bad910446e01527397b9" as (select "pg"."pid", ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) as trg_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and ("trg_pid" is not null) and "nfl_plays"."year" in (2023) group by "pg"."pid" having ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) >= '25'), "t95e5e341c30f353b76060180385ad042" as (select "pg"."pid", ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) as trg_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and ("trg_pid" is not null) and "nfl_plays"."week" in (1, 2, 3) and "nfl_plays"."year" in (2022) group by "pg"."pid") select "player"."pid", "t7ce618d9efd1bad910446e01527397b9"."trg_share_from_plays" AS "trg_share_from_plays_0", player.fname, player.lname, "t95e5e341c30f353b76060180385ad042"."trg_share_from_plays" AS "trg_share_from_plays_1", "player"."pos" from "player" inner join "t7ce618d9efd1bad910446e01527397b9" on "t7ce618d9efd1bad910446e01527397b9"."pid" = "player"."pid" left join "t95e5e341c30f353b76060180385ad042" on "t95e5e341c30f353b76060180385ad042"."pid" = "player"."pid" group by "t7ce618d9efd1bad910446e01527397b9"."trg_share_from_plays", player.fname, player.lname, "t95e5e341c30f353b76060180385ad042"."trg_share_from_plays", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
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
    const expected_query = `with "t61f07858920fb67f1c3e476f1ce4a5a0" as (select "pg"."pid", ROUND(100.0 * SUM(CASE WHEN nfl_plays.trg_pid = pg.pid THEN nfl_plays.dot ELSE 0 END) / SUM(nfl_plays.dot), 2) as air_yds_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and ("trg_pid" is not null) and "nfl_plays"."year" in (2023) group by "pg"."pid" having ROUND(100.0 * SUM(CASE WHEN nfl_plays.trg_pid = pg.pid THEN nfl_plays.dot ELSE 0 END) / SUM(nfl_plays.dot), 2) >= '25') select "player"."pid", "t61f07858920fb67f1c3e476f1ce4a5a0"."air_yds_share_from_plays" AS "air_yds_share_from_plays_0", player.fname, player.lname, "player"."pos" from "player" inner join "t61f07858920fb67f1c3e476f1ce4a5a0" on "t61f07858920fb67f1c3e476f1ce4a5a0"."pid" = "player"."pid" group by "t61f07858920fb67f1c3e476f1ce4a5a0"."air_yds_share_from_plays", player.fname, player.lname, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
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
    const expected_query = `with "taf7522e61863b27a607cb3c7e490775e" as (select COALESCE(trg_pid) as pid, COUNT(*) as trg_from_plays_0 from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."dwn" in (3) and "nfl_plays"."year" in (2023) group by COALESCE(trg_pid) having COUNT(*) >= '15'), "t17f0f625c0b0a696155eecd0f0e246f3" as (select "pg"."pid", ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) as trg_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and ("trg_pid" is not null) and "nfl_plays"."dwn" in (3) and "nfl_plays"."year" in (2023) group by "pg"."pid"), "t2228378f5572b89e906a7f814d54b339" as (select "pg"."pid", ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) as trg_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and ("trg_pid" is not null) and "nfl_plays"."qtr" in (1, 2) and "nfl_plays"."year" in (2023) group by "pg"."pid") select "player"."pid", "taf7522e61863b27a607cb3c7e490775e"."trg_from_plays_0" as "trg_from_plays_0", player.fname, player.lname, "t17f0f625c0b0a696155eecd0f0e246f3"."trg_share_from_plays" AS "trg_share_from_plays_0", "t2228378f5572b89e906a7f814d54b339"."trg_share_from_plays" AS "trg_share_from_plays_1", "player"."pos" from "player" inner join "taf7522e61863b27a607cb3c7e490775e" on "taf7522e61863b27a607cb3c7e490775e"."pid" = "player"."pid" left join "t17f0f625c0b0a696155eecd0f0e246f3" on "t17f0f625c0b0a696155eecd0f0e246f3"."pid" = "player"."pid" left join "t2228378f5572b89e906a7f814d54b339" on "t2228378f5572b89e906a7f814d54b339"."pid" = "player"."pid" group by "taf7522e61863b27a607cb3c7e490775e"."trg_from_plays_0", player.fname, player.lname, "t17f0f625c0b0a696155eecd0f0e246f3"."trg_share_from_plays", "t2228378f5572b89e906a7f814d54b339"."trg_share_from_plays", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 5 DESC NULLS LAST, "player"."pid" asc limit 500`
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
    const expected_query = `with "t75ffb93b4d49b2fdda73e643ce2c32ed" as (select COALESCE(bc_pid) as pid, "nfl_plays"."year", SUM(rush_yds) as rush_yds_from_plays_0 from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."year" in (2020, 2021, 2022, 2023) group by "nfl_plays"."year", COALESCE(bc_pid)) select "player"."pid", player.fname, player.lname, "t75ffb93b4d49b2fdda73e643ce2c32ed"."rush_yds_from_plays_0" as "rush_yds_from_plays_0", COALESCE(t75ffb93b4d49b2fdda73e643ce2c32ed.year) AS year, "player"."pos" from "player" left join "t75ffb93b4d49b2fdda73e643ce2c32ed" on "t75ffb93b4d49b2fdda73e643ce2c32ed"."pid" = "player"."pid" and t75ffb93b4d49b2fdda73e643ce2c32ed.year IN (2020,2021,2022,2023) group by player.fname, player.lname, "t75ffb93b4d49b2fdda73e643ce2c32ed"."rush_yds_from_plays_0", COALESCE(t75ffb93b4d49b2fdda73e643ce2c32ed.year), "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 4 DESC NULLS LAST, "player"."pid" asc limit 500`
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
    const expected_query = `with "t75ffb93b4d49b2fdda73e643ce2c32ed" as (select COALESCE(bc_pid) as pid, "nfl_plays"."year", SUM(rush_yds) as rush_yds_from_plays_0 from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."year" in (2020, 2021, 2022, 2023) group by "nfl_plays"."year", COALESCE(bc_pid)), "tae9601943a3083aad2b7dff171c1154b" as (select COALESCE(bc_pid) as pid, "nfl_plays"."year", CASE WHEN COUNT(*) > 0 THEN CAST(ROUND(SUM(rush_yds)::decimal / COUNT(*), 2) AS decimal) ELSE 0 END as rush_yds_per_att_from_plays_0 from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."year" in (2023) and "nfl_plays"."xpass_prob" between 0 and 0.4 group by "nfl_plays"."year", COALESCE(bc_pid)), "t28085aea69cc3e5865f0ef79d42fe83c" as (select COALESCE(bc_pid) as pid, "nfl_plays"."year", SUM(rush_yds) as rush_yds_from_plays_0 from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."dwn" in (1, 2) and "nfl_plays"."year" in (2020, 2021, 2022, 2023) group by "nfl_plays"."year", COALESCE(bc_pid)) select "player"."pid", player.fname, player.lname, "t75ffb93b4d49b2fdda73e643ce2c32ed"."rush_yds_from_plays_0" as "rush_yds_from_plays_0", "tae9601943a3083aad2b7dff171c1154b"."rush_yds_per_att_from_plays_0" as "rush_yds_per_att_from_plays_0", "t28085aea69cc3e5865f0ef79d42fe83c"."rush_yds_from_plays_0" as "rush_yds_from_plays_1", COALESCE(t75ffb93b4d49b2fdda73e643ce2c32ed.year, tae9601943a3083aad2b7dff171c1154b.year, t28085aea69cc3e5865f0ef79d42fe83c.year) AS year, "player"."pos" from "player" left join "t75ffb93b4d49b2fdda73e643ce2c32ed" on "t75ffb93b4d49b2fdda73e643ce2c32ed"."pid" = "player"."pid" and t75ffb93b4d49b2fdda73e643ce2c32ed.year IN (2020,2021,2022,2023) left join "tae9601943a3083aad2b7dff171c1154b" on "tae9601943a3083aad2b7dff171c1154b"."pid" = "player"."pid" and "tae9601943a3083aad2b7dff171c1154b"."year" = "t75ffb93b4d49b2fdda73e643ce2c32ed"."year" left join "t28085aea69cc3e5865f0ef79d42fe83c" on "t28085aea69cc3e5865f0ef79d42fe83c"."pid" = "player"."pid" and "t28085aea69cc3e5865f0ef79d42fe83c"."year" = "tae9601943a3083aad2b7dff171c1154b"."year" group by player.fname, player.lname, "t75ffb93b4d49b2fdda73e643ce2c32ed"."rush_yds_from_plays_0", "tae9601943a3083aad2b7dff171c1154b"."rush_yds_per_att_from_plays_0", "t28085aea69cc3e5865f0ef79d42fe83c"."rush_yds_from_plays_0", COALESCE(t75ffb93b4d49b2fdda73e643ce2c32ed.year, tae9601943a3083aad2b7dff171c1154b.year, t28085aea69cc3e5865f0ef79d42fe83c.year), "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 4 DESC NULLS LAST, "player"."pid" asc limit 500`
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
    const expected_query = `with "tbb9e9d64d851fb84a199f483e7e1eea0" as (select "pg"."pid", ROUND((1.5 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / NULLIF(COUNT(*), 0)) + (0.7 * SUM(CASE WHEN nfl_plays.trg_pid = pg.pid THEN nfl_plays.dot ELSE 0 END) / NULLIF(SUM(nfl_plays.dot), 0)), 4) as weighted_opp_rating_from_plays, "nfl_plays"."year" from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and ("trg_pid" is not null) and "nfl_plays"."year" in (2022, 2023) and "nfl_plays"."xpass_prob" between 0.7 and 1 group by "pg"."pid", "nfl_plays"."year"), "t3979141e89cfef0917bc8603971b2349" as (select COALESCE(trg_pid) as pid, "nfl_plays"."year", COUNT(*) as trg_from_plays_0 from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."year" in (2022, 2023) and "nfl_plays"."xpass_prob" between 0.7 and 1 group by "nfl_plays"."year", COALESCE(trg_pid)) select "player"."pid", player.fname, player.lname, "tbb9e9d64d851fb84a199f483e7e1eea0"."weighted_opp_rating_from_plays" AS "weighted_opp_rating_from_plays_0", "t3979141e89cfef0917bc8603971b2349"."trg_from_plays_0" as "trg_from_plays_0", COALESCE(tbb9e9d64d851fb84a199f483e7e1eea0.year, t3979141e89cfef0917bc8603971b2349.year) AS year, "player"."pos" from "player" left join "tbb9e9d64d851fb84a199f483e7e1eea0" on "tbb9e9d64d851fb84a199f483e7e1eea0"."pid" = "player"."pid" left join "t3979141e89cfef0917bc8603971b2349" on "t3979141e89cfef0917bc8603971b2349"."pid" = "player"."pid" and "t3979141e89cfef0917bc8603971b2349"."year" = "tbb9e9d64d851fb84a199f483e7e1eea0"."year" where player.pos IN ('WR') group by player.fname, player.lname, "tbb9e9d64d851fb84a199f483e7e1eea0"."weighted_opp_rating_from_plays", "t3979141e89cfef0917bc8603971b2349"."trg_from_plays_0", COALESCE(tbb9e9d64d851fb84a199f483e7e1eea0.year, t3979141e89cfef0917bc8603971b2349.year), "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 4 DESC NULLS LAST, "player"."pid" asc limit 500`
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
    const expected_query = `with "t0d31bb13a5dc7fd801599711a85716b8" as (select "pg"."pid", ROUND((1.5 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / NULLIF(COUNT(*), 0)) + (0.7 * SUM(CASE WHEN nfl_plays.trg_pid = pg.pid THEN nfl_plays.dot ELSE 0 END) / NULLIF(SUM(nfl_plays.dot), 0)), 4) as weighted_opp_rating_from_plays, "nfl_plays"."year" from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and ("trg_pid" is not null) group by "pg"."pid", "nfl_plays"."year") select "player"."pid", player.fname, player.lname, "player_seasonlogs"."espn_open_score" AS "espn_open_score_0", "t0d31bb13a5dc7fd801599711a85716b8"."weighted_opp_rating_from_plays" AS "weighted_opp_rating_from_plays_0", COALESCE(player_seasonlogs.year, t0d31bb13a5dc7fd801599711a85716b8.year) AS year, "player"."pos" from "player" left join "player_seasonlogs" on "player_seasonlogs"."pid" = "player"."pid" and "player_seasonlogs"."seas_type" = 'REG' left join "t0d31bb13a5dc7fd801599711a85716b8" on "t0d31bb13a5dc7fd801599711a85716b8"."pid" = "player"."pid" and "t0d31bb13a5dc7fd801599711a85716b8"."year" = "player_seasonlogs"."year" group by player.fname, player.lname, "player_seasonlogs"."espn_open_score", "t0d31bb13a5dc7fd801599711a85716b8"."weighted_opp_rating_from_plays", COALESCE(player_seasonlogs.year, t0d31bb13a5dc7fd801599711a85716b8.year), "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 4 DESC NULLS LAST, "player"."pid" asc limit 500`
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
    const expected_query = `select "player"."pid", player.fname, player.lname, "t2dc419c5ac00a6f3a1433df75f943988"."points" AS "points_from_seasonlogs_0", "t2dc419c5ac00a6f3a1433df75f943988"."points_per_game" AS "points_per_game_from_seasonlogs_0", "t2dc419c5ac00a6f3a1433df75f943988"."points_rnk" AS "points_rnk_from_seasonlogs_0", "t2dc419c5ac00a6f3a1433df75f943988"."points_pos_rnk" AS "points_pos_rnk_from_seasonlogs_0", "player"."pos" from "player" left join "scoring_format_player_seasonlogs" as "t2dc419c5ac00a6f3a1433df75f943988" on "t2dc419c5ac00a6f3a1433df75f943988"."pid" = "player"."pid" and t2dc419c5ac00a6f3a1433df75f943988.scoring_format_hash = '0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d' and t2dc419c5ac00a6f3a1433df75f943988.year IN (2022) group by player.fname, player.lname, "t2dc419c5ac00a6f3a1433df75f943988"."points", "t2dc419c5ac00a6f3a1433df75f943988"."points_per_game", "t2dc419c5ac00a6f3a1433df75f943988"."points_rnk", "t2dc419c5ac00a6f3a1433df75f943988"."points_pos_rnk", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 4 DESC NULLS LAST, "player"."pid" asc limit 500`
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
    const expected_query = `select "player"."pid", player.fname, player.lname, "t0984699909800a4c1372fbe19abf07af"."points" AS "points_from_careerlogs_0", "t0984699909800a4c1372fbe19abf07af"."points_per_game" AS "points_per_game_from_careerlogs_0", "t0984699909800a4c1372fbe19abf07af"."games" AS "games_from_careerlogs_0", "t0984699909800a4c1372fbe19abf07af"."top_3" AS "top_3_from_careerlogs_0", "t0984699909800a4c1372fbe19abf07af"."top_6" AS "top_6_from_careerlogs_0", "t0984699909800a4c1372fbe19abf07af"."top_12" AS "top_12_from_careerlogs_0", "t0984699909800a4c1372fbe19abf07af"."top_24" AS "top_24_from_careerlogs_0", "t0984699909800a4c1372fbe19abf07af"."top_36" AS "top_36_from_careerlogs_0", "player"."pos" from "player" left join "scoring_format_player_careerlogs" as "t0984699909800a4c1372fbe19abf07af" on "t0984699909800a4c1372fbe19abf07af"."pid" = "player"."pid" and t0984699909800a4c1372fbe19abf07af.scoring_format_hash = '0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d' group by player.fname, player.lname, "t0984699909800a4c1372fbe19abf07af"."points", "t0984699909800a4c1372fbe19abf07af"."points_per_game", "t0984699909800a4c1372fbe19abf07af"."games", "t0984699909800a4c1372fbe19abf07af"."top_3", "t0984699909800a4c1372fbe19abf07af"."top_6", "t0984699909800a4c1372fbe19abf07af"."top_12", "t0984699909800a4c1372fbe19abf07af"."top_24", "t0984699909800a4c1372fbe19abf07af"."top_36", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 4 DESC NULLS LAST, "player"."pid" asc limit 500`
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
    const expected_query = `select "player"."pid", player.fname, player.lname, "tbf494cbb4bcb89adaa6d672c8bfb17c2"."startable_games" AS "startable_games_from_seasonlogs_0", "tbf494cbb4bcb89adaa6d672c8bfb17c2"."points_added" AS "points_added_from_seasonlogs_0", "tbf494cbb4bcb89adaa6d672c8bfb17c2"."points_added_per_game" AS "points_added_per_game_from_seasonlogs_0", "tbf494cbb4bcb89adaa6d672c8bfb17c2"."points_added_rnk" AS "points_added_rnk_from_seasonlogs_0", "tbf494cbb4bcb89adaa6d672c8bfb17c2"."points_added_pos_rnk" AS "points_added_pos_rnk_from_seasonlogs_0", "t2c88ab25d4acbc66daf6137b64987326"."startable_games" AS "startable_games_from_careerlogs_0", "t2c88ab25d4acbc66daf6137b64987326"."points_added" AS "points_added_from_careerlogs_0", "t2c88ab25d4acbc66daf6137b64987326"."points_added_per_game" AS "points_added_per_game_from_careerlogs_0", "t2c88ab25d4acbc66daf6137b64987326"."best_season_points_added_per_game" AS "best_season_points_added_per_game_from_careerlogs_0", "t2c88ab25d4acbc66daf6137b64987326"."points_added_first_three_seas" AS "points_added_first_three_seas_from_careerlogs_0", "t2c88ab25d4acbc66daf6137b64987326"."points_added_first_four_seas" AS "points_added_first_four_seas_from_careerlogs_0", "t2c88ab25d4acbc66daf6137b64987326"."points_added_first_five_seas" AS "points_added_first_five_seas_from_careerlogs_0", "t2c88ab25d4acbc66daf6137b64987326"."points_added_first_seas" AS "points_added_first_seas_from_careerlogs_0", "t2c88ab25d4acbc66daf6137b64987326"."points_added_second_seas" AS "points_added_second_seas_from_careerlogs_0", "t2c88ab25d4acbc66daf6137b64987326"."points_added_third_seas" AS "points_added_third_seas_from_careerlogs_0", "t2c88ab25d4acbc66daf6137b64987326"."draft_rank" AS "draft_rank_from_careerlogs_0", "player"."pos" from "player" left join "league_format_player_seasonlogs" as "tbf494cbb4bcb89adaa6d672c8bfb17c2" on "tbf494cbb4bcb89adaa6d672c8bfb17c2"."pid" = "player"."pid" and tbf494cbb4bcb89adaa6d672c8bfb17c2.league_format_hash = '1985e1968b75707ebcab9da620176a0b218c5c1bd28d00cbbc4d1744a1631d0b' and tbf494cbb4bcb89adaa6d672c8bfb17c2.year IN (2023) left join "league_format_player_careerlogs" as "t2c88ab25d4acbc66daf6137b64987326" on "t2c88ab25d4acbc66daf6137b64987326"."pid" = "player"."pid" and t2c88ab25d4acbc66daf6137b64987326.league_format_hash = '1985e1968b75707ebcab9da620176a0b218c5c1bd28d00cbbc4d1744a1631d0b' group by player.fname, player.lname, "tbf494cbb4bcb89adaa6d672c8bfb17c2"."startable_games", "tbf494cbb4bcb89adaa6d672c8bfb17c2"."points_added", "tbf494cbb4bcb89adaa6d672c8bfb17c2"."points_added_per_game", "tbf494cbb4bcb89adaa6d672c8bfb17c2"."points_added_rnk", "tbf494cbb4bcb89adaa6d672c8bfb17c2"."points_added_pos_rnk", "t2c88ab25d4acbc66daf6137b64987326"."startable_games", "t2c88ab25d4acbc66daf6137b64987326"."points_added", "t2c88ab25d4acbc66daf6137b64987326"."points_added_per_game", "t2c88ab25d4acbc66daf6137b64987326"."best_season_points_added_per_game", "t2c88ab25d4acbc66daf6137b64987326"."points_added_first_three_seas", "t2c88ab25d4acbc66daf6137b64987326"."points_added_first_four_seas", "t2c88ab25d4acbc66daf6137b64987326"."points_added_first_five_seas", "t2c88ab25d4acbc66daf6137b64987326"."points_added_first_seas", "t2c88ab25d4acbc66daf6137b64987326"."points_added_second_seas", "t2c88ab25d4acbc66daf6137b64987326"."points_added_third_seas", "t2c88ab25d4acbc66daf6137b64987326"."draft_rank", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 11 DESC NULLS LAST, "player"."pid" asc limit 500`
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
    const expected_query = `with "t90ccccbf252ed1f0c385dcf7a959d737_markets" as (select "source_id", "source_market_id", "time_type" from "prop_markets_index" where "market_type" = 'SEASON_PASSING_YARDS' and "time_type" = 'CLOSE' and "prop_markets_index"."year" = 2024 and "source_id" = 'FANDUEL'), "t90ccccbf252ed1f0c385dcf7a959d737" as (select "pms"."selection_pid", "pms"."selection_metric_line" from "t90ccccbf252ed1f0c385dcf7a959d737_markets" as "m" inner join "prop_market_selections_index" as "pms" on "pms"."source_id" = "m"."source_id" and "pms"."source_market_id" = "m"."source_market_id" and "pms"."time_type" = "m"."time_type"), "t61d004f21f7442a9de38c5af1116adcf_markets" as (select "source_id", "source_market_id", "time_type" from "prop_markets_index" where "market_type" = 'SEASON_RECEIVING_YARDS' and "time_type" = 'CLOSE' and "prop_markets_index"."year" = 2024 and "source_id" = 'FANDUEL'), "t61d004f21f7442a9de38c5af1116adcf" as (select "pms"."selection_pid", "pms"."selection_metric_line" from "t61d004f21f7442a9de38c5af1116adcf_markets" as "m" inner join "prop_market_selections_index" as "pms" on "pms"."source_id" = "m"."source_id" and "pms"."source_market_id" = "m"."source_market_id" and "pms"."time_type" = "m"."time_type"), "td32ee11d651efc0763da30d1d379bee0_markets" as (select "source_id", "source_market_id", "time_type" from "prop_markets_index" where "market_type" = 'SEASON_RUSHING_YARDS' and "time_type" = 'CLOSE' and "prop_markets_index"."year" = 2024 and "source_id" = 'FANDUEL'), "td32ee11d651efc0763da30d1d379bee0" as (select "pms"."selection_pid", "pms"."selection_metric_line" from "td32ee11d651efc0763da30d1d379bee0_markets" as "m" inner join "prop_market_selections_index" as "pms" on "pms"."source_id" = "m"."source_id" and "pms"."source_market_id" = "m"."source_market_id" and "pms"."time_type" = "m"."time_type") select "player"."pid", player.fname, player.lname, "t90ccccbf252ed1f0c385dcf7a959d737"."selection_metric_line" AS "season_prop_line_betting_market_0", "t61d004f21f7442a9de38c5af1116adcf"."selection_metric_line" AS "season_prop_line_betting_market_1", "td32ee11d651efc0763da30d1d379bee0"."selection_metric_line" AS "season_prop_line_betting_market_2", "player"."pos" from "player" left join "t90ccccbf252ed1f0c385dcf7a959d737" on "t90ccccbf252ed1f0c385dcf7a959d737"."selection_pid" = "player"."pid" left join "t61d004f21f7442a9de38c5af1116adcf" on "t61d004f21f7442a9de38c5af1116adcf"."selection_pid" = "player"."pid" left join "td32ee11d651efc0763da30d1d379bee0" on "td32ee11d651efc0763da30d1d379bee0"."selection_pid" = "player"."pid" group by player.fname, player.lname, "t90ccccbf252ed1f0c385dcf7a959d737"."selection_metric_line", "t61d004f21f7442a9de38c5af1116adcf"."selection_metric_line", "td32ee11d651efc0763da30d1d379bee0"."selection_metric_line", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 5 DESC NULLS LAST, "player"."pid" asc limit 500`
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
    const expected_query = `with "t8ccbf7bf339257f09417974c12388ba0_markets" as (select "source_id", "source_market_id", "time_type" from "prop_markets_index" inner join "nfl_games" on "nfl_games"."esbid" = "prop_markets_index"."esbid" and "nfl_games"."year" = "prop_markets_index"."year" and "nfl_games"."week" = 1 where "market_type" = 'GAME_PASSING_YARDS' and "time_type" = 'CLOSE' and "prop_markets_index"."year" = 2023 and "source_id" = 'FANDUEL'), "t8ccbf7bf339257f09417974c12388ba0" as (select "pms"."selection_pid", "pms"."selection_metric_line" from "t8ccbf7bf339257f09417974c12388ba0_markets" as "m" inner join "prop_market_selections_index" as "pms" on "pms"."source_id" = "m"."source_id" and "pms"."source_market_id" = "m"."source_market_id" and "pms"."time_type" = "m"."time_type") select "player"."pid", player.fname, player.lname, "t8ccbf7bf339257f09417974c12388ba0"."selection_metric_line" AS "game_prop_line_betting_market_0", "player"."pos" from "player" left join "t8ccbf7bf339257f09417974c12388ba0" on "t8ccbf7bf339257f09417974c12388ba0"."selection_pid" = "player"."pid" group by player.fname, player.lname, "t8ccbf7bf339257f09417974c12388ba0"."selection_metric_line", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 4 DESC NULLS LAST, "player"."pid" asc limit 500`
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
    const expected_query = `with "t8556b9a9c4bf250fab85e549eaed8521" as (select "pg"."pid", ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) as trg_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and ("trg_pid" is not null) and "pg"."career_game" between 1 and 1 group by "pg"."pid" having ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) >= '15') select "player"."pid", player.fname, player.lname, "t0984699909800a4c1372fbe19abf07af"."top_1" AS "top_1_from_careerlogs_0", "t0984699909800a4c1372fbe19abf07af"."top_3" AS "top_3_from_careerlogs_0", "t0984699909800a4c1372fbe19abf07af"."top_6" AS "top_6_from_careerlogs_0", "t0984699909800a4c1372fbe19abf07af"."top_12" AS "top_12_from_careerlogs_0", "player"."pos" from "player" inner join "t8556b9a9c4bf250fab85e549eaed8521" on "t8556b9a9c4bf250fab85e549eaed8521"."pid" = "player"."pid" left join "scoring_format_player_careerlogs" as "t0984699909800a4c1372fbe19abf07af" on "t0984699909800a4c1372fbe19abf07af"."pid" = "player"."pid" and t0984699909800a4c1372fbe19abf07af.scoring_format_hash = '0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d' group by player.fname, player.lname, "t0984699909800a4c1372fbe19abf07af"."top_1", "t0984699909800a4c1372fbe19abf07af"."top_3", "t0984699909800a4c1372fbe19abf07af"."top_6", "t0984699909800a4c1372fbe19abf07af"."top_12", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 4 DESC NULLS LAST, "player"."pid" asc limit 500`
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
    const expected_query = `select "player"."pid", player.fname, player.lname, CASE WHEN rosters_players.slot = 13 THEN 'injured_reserve' WHEN rosters_players.slot = 12 THEN 'practice_squad' WHEN rosters_players.slot IS NULL THEN 'free_agent' ELSE 'active_roster' END AS player_league_roster_status, rosters_players.slot, rosters_players.tid, rosters_players.tag, "t26d9d9efaab14f81317e0aab19bb619c"."pts_added" AS "season_projected_points_added_0", "t0dfe1f40a872fb6aad6963492077913c"."total" AS "season_projected_points_0", "t06adaa2b44f8b40e476affee9748a3c5"."py" AS "season_projected_pass_yds_0", "t06adaa2b44f8b40e476affee9748a3c5"."tdp" AS "season_projected_pass_tds_0", "t06adaa2b44f8b40e476affee9748a3c5"."ints" AS "season_projected_pass_ints_0", "t06adaa2b44f8b40e476affee9748a3c5"."ra" AS "season_projected_rush_atts_0", "t06adaa2b44f8b40e476affee9748a3c5"."ry" AS "season_projected_rush_yds_0", "t06adaa2b44f8b40e476affee9748a3c5"."tdr" AS "season_projected_rush_tds_0", "t06adaa2b44f8b40e476affee9748a3c5"."fuml" AS "season_projected_fumbles_lost_0", "t06adaa2b44f8b40e476affee9748a3c5"."trg" AS "season_projected_targets_0", "t06adaa2b44f8b40e476affee9748a3c5"."rec" AS "season_projected_recs_0", "t06adaa2b44f8b40e476affee9748a3c5"."recy" AS "season_projected_rec_yds_0", "t06adaa2b44f8b40e476affee9748a3c5"."tdrec" AS "season_projected_rec_tds_0", "player"."pos" from "player" left join "rosters_players" on "rosters_players"."pid" = "player"."pid" and "rosters_players"."year" = 2024 and "rosters_players"."week" = 0 and "rosters_players"."lid" = 1 left join "league_format_player_projection_values" as "t26d9d9efaab14f81317e0aab19bb619c" on "t26d9d9efaab14f81317e0aab19bb619c"."pid" = "player"."pid" and "t26d9d9efaab14f81317e0aab19bb619c"."league_format_hash" = '1985e1968b75707ebcab9da620176a0b218c5c1bd28d00cbbc4d1744a1631d0b' and "t26d9d9efaab14f81317e0aab19bb619c"."year" = 2023 and "t26d9d9efaab14f81317e0aab19bb619c"."week" = '0' left join "scoring_format_player_projection_points" as "t0dfe1f40a872fb6aad6963492077913c" on "t0dfe1f40a872fb6aad6963492077913c"."pid" = "player"."pid" and "t0dfe1f40a872fb6aad6963492077913c"."scoring_format_hash" = '0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d' and "t0dfe1f40a872fb6aad6963492077913c"."year" = 2023 and "t0dfe1f40a872fb6aad6963492077913c"."week" = '0' left join "projections_index" as "t06adaa2b44f8b40e476affee9748a3c5" on "t06adaa2b44f8b40e476affee9748a3c5"."pid" = "player"."pid" and "t06adaa2b44f8b40e476affee9748a3c5"."sourceid" = 18 and "t06adaa2b44f8b40e476affee9748a3c5"."year" = 2023 and "t06adaa2b44f8b40e476affee9748a3c5"."week" = 0 group by player.fname, player.lname, rosters_players.slot, rosters_players.tid, rosters_players.tag, "t26d9d9efaab14f81317e0aab19bb619c"."pts_added", "t0dfe1f40a872fb6aad6963492077913c"."total", "t06adaa2b44f8b40e476affee9748a3c5"."py", "t06adaa2b44f8b40e476affee9748a3c5"."tdp", "t06adaa2b44f8b40e476affee9748a3c5"."ints", "t06adaa2b44f8b40e476affee9748a3c5"."ra", "t06adaa2b44f8b40e476affee9748a3c5"."ry", "t06adaa2b44f8b40e476affee9748a3c5"."tdr", "t06adaa2b44f8b40e476affee9748a3c5"."fuml", "t06adaa2b44f8b40e476affee9748a3c5"."trg", "t06adaa2b44f8b40e476affee9748a3c5"."rec", "t06adaa2b44f8b40e476affee9748a3c5"."recy", "t06adaa2b44f8b40e476affee9748a3c5"."tdrec", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 8 DESC NULLS LAST, "player"."pid" asc limit 500`
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
    const expected_query = `select "player"."pid", player.fname, player.lname, CASE WHEN rosters_players.slot = 13 THEN 'injured_reserve' WHEN rosters_players.slot = 12 THEN 'practice_squad' WHEN rosters_players.slot IS NULL THEN 'free_agent' ELSE 'active_roster' END AS player_league_roster_status, rosters_players.slot, rosters_players.tid, rosters_players.tag, "tdaa3548559fc3de994ece727a3d03fa9"."py" AS "week_projected_pass_yds_0", "player"."pos" from "player" left join "rosters_players" on "rosters_players"."pid" = "player"."pid" and "rosters_players"."year" = 2024 and "rosters_players"."week" = 0 and "rosters_players"."lid" = 1 left join "projections_index" as "tdaa3548559fc3de994ece727a3d03fa9" on "tdaa3548559fc3de994ece727a3d03fa9"."pid" = "player"."pid" and "tdaa3548559fc3de994ece727a3d03fa9"."sourceid" = 18 and "tdaa3548559fc3de994ece727a3d03fa9"."year" = 2023 and "tdaa3548559fc3de994ece727a3d03fa9"."week" = 2 group by player.fname, player.lname, rosters_players.slot, rosters_players.tid, rosters_players.tag, "tdaa3548559fc3de994ece727a3d03fa9"."py", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 8 DESC NULLS LAST, "player"."pid" asc limit 500`
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
    const expected_query = `with "t1206dd6a0185f87789312514d524dfa0" as (select COALESCE(bc_pid) as pid, "nfl_plays"."year", COUNT(*) as rush_atts_from_plays_0 from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' group by "nfl_plays"."year", COALESCE(bc_pid)) select "player"."pid", player.fname, player.lname, "t06adaa2b44f8b40e476affee9748a3c5"."ra" AS "season_projected_rush_atts_0", "t6f54c05eac6ba296f8748f9026c2d01f"."ry" AS "season_projected_rush_yds_0", "t1206dd6a0185f87789312514d524dfa0"."rush_atts_from_plays_0" as "rush_atts_from_plays_0", COALESCE(t06adaa2b44f8b40e476affee9748a3c5.year, t6f54c05eac6ba296f8748f9026c2d01f.year, t1206dd6a0185f87789312514d524dfa0.year) AS year, "player"."pos" from "player" left join "projections_index" as "t06adaa2b44f8b40e476affee9748a3c5" on "t06adaa2b44f8b40e476affee9748a3c5"."pid" = "player"."pid" and "t06adaa2b44f8b40e476affee9748a3c5"."sourceid" = 18 and t06adaa2b44f8b40e476affee9748a3c5.year IN (2023,2022,2021,2020) and "t06adaa2b44f8b40e476affee9748a3c5"."week" = 0 left join "projections_index" as "t6f54c05eac6ba296f8748f9026c2d01f" on "t6f54c05eac6ba296f8748f9026c2d01f"."pid" = "player"."pid" and "t6f54c05eac6ba296f8748f9026c2d01f"."sourceid" = 18 and "t6f54c05eac6ba296f8748f9026c2d01f"."year" = "t06adaa2b44f8b40e476affee9748a3c5"."year" and "t6f54c05eac6ba296f8748f9026c2d01f"."week" = 0 left join "t1206dd6a0185f87789312514d524dfa0" on "t1206dd6a0185f87789312514d524dfa0"."pid" = "player"."pid" and "t1206dd6a0185f87789312514d524dfa0"."year" = "t6f54c05eac6ba296f8748f9026c2d01f"."year" where player.pos IN ('RB') group by player.fname, player.lname, "t06adaa2b44f8b40e476affee9748a3c5"."ra", "t6f54c05eac6ba296f8748f9026c2d01f"."ry", "t1206dd6a0185f87789312514d524dfa0"."rush_atts_from_plays_0", COALESCE(t06adaa2b44f8b40e476affee9748a3c5.year, t6f54c05eac6ba296f8748f9026c2d01f.year, t1206dd6a0185f87789312514d524dfa0.year), "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 4 DESC NULLS LAST, "player"."pid" asc limit 500`
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
    const expected_query = `with "tcb3cea5c11f705e415f87574c59b9ac2" as (select COALESCE(trg_pid) as pid, "nfl_plays"."year" from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' group by "nfl_plays"."year", COALESCE(trg_pid) having COUNT(*) >= '55'), "t6dbc763279e59180a67cf964ed68662d" as (select "pg"."pid", ROUND(100.0 * SUM(CASE WHEN nfl_plays.trg_pid = pg.pid THEN CASE WHEN nfl_plays.first_down THEN 1 ELSE 0 END ELSE 0 END) / NULLIF(SUM(CASE WHEN nfl_plays.first_down THEN 1 ELSE 0 END), 0), 2) as recv_first_down_share_from_plays, "nfl_plays"."year" from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and ("trg_pid" is not null) and "nfl_plays"."year" in (2017, 2018, 2019, 2020, 2021, 2022, 2023) group by "pg"."pid", "nfl_plays"."year"), "t8445ccb32dbc965d0d87de91aa1cac76" as (select COALESCE(trg_pid) as pid, "nfl_plays"."year", SUM(CASE WHEN comp = true THEN recv_yds ELSE 0 END) as rec_yds_from_plays_0 from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' group by "nfl_plays"."year", COALESCE(trg_pid)), "t1d5c8eb7aa320de9aee48b57b62e411a" as (select COALESCE(bc_pid) as pid, "nfl_plays"."year", SUM(rush_yds) as rush_yds_from_plays_0 from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' group by "nfl_plays"."year", COALESCE(bc_pid)) select "player"."pid", player.fname, player.lname, "player_seasonlogs"."espn_overall_score" AS "espn_overall_score_0", "t6dbc763279e59180a67cf964ed68662d"."recv_first_down_share_from_plays" AS "recv_first_down_share_from_plays_0", "t8a4a84e735183537b2ba13726efd3e32"."points_per_game" AS "points_per_game_from_seasonlogs_0", "t43dad6b6c946e7f3d08b4cb24334c705"."points_per_game" AS "points_per_game_from_seasonlogs_1", "t8445ccb32dbc965d0d87de91aa1cac76"."rec_yds_from_plays_0" as "rec_yds_from_plays_0", "t1d5c8eb7aa320de9aee48b57b62e411a"."rush_yds_from_plays_0" as "rush_yds_from_plays_0", COALESCE(tcb3cea5c11f705e415f87574c59b9ac2.year, t154eac9f9dbf17872b2f79e5a75b67cc.year, player_seasonlogs.year, t6dbc763279e59180a67cf964ed68662d.year, t8a4a84e735183537b2ba13726efd3e32.year, t43dad6b6c946e7f3d08b4cb24334c705.year, t8445ccb32dbc965d0d87de91aa1cac76.year, t1d5c8eb7aa320de9aee48b57b62e411a.year) AS year, "player"."pos" from "player" inner join "tcb3cea5c11f705e415f87574c59b9ac2" on "tcb3cea5c11f705e415f87574c59b9ac2"."pid" = "player"."pid" inner join "scoring_format_player_seasonlogs" as "t154eac9f9dbf17872b2f79e5a75b67cc" on "t154eac9f9dbf17872b2f79e5a75b67cc"."pid" = "player"."pid" and t154eac9f9dbf17872b2f79e5a75b67cc.scoring_format_hash = '0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d' and "t154eac9f9dbf17872b2f79e5a75b67cc"."year" = "tcb3cea5c11f705e415f87574c59b9ac2"."year" inner join "player_seasonlogs" on "player_seasonlogs"."pid" = "player"."pid" and "player_seasonlogs"."seas_type" = 'REG' and "player_seasonlogs"."year" = "t154eac9f9dbf17872b2f79e5a75b67cc"."year" left join "t6dbc763279e59180a67cf964ed68662d" on "t6dbc763279e59180a67cf964ed68662d"."pid" = "player"."pid" and "t6dbc763279e59180a67cf964ed68662d"."year" = "player_seasonlogs"."year" left join "scoring_format_player_seasonlogs" as "t8a4a84e735183537b2ba13726efd3e32" on "t8a4a84e735183537b2ba13726efd3e32"."pid" = "player"."pid" and t8a4a84e735183537b2ba13726efd3e32.scoring_format_hash = '0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d' and "t8a4a84e735183537b2ba13726efd3e32"."year" = "t6dbc763279e59180a67cf964ed68662d"."year" left join "scoring_format_player_seasonlogs" as "t43dad6b6c946e7f3d08b4cb24334c705" on "t43dad6b6c946e7f3d08b4cb24334c705"."pid" = "player"."pid" and t43dad6b6c946e7f3d08b4cb24334c705.scoring_format_hash = '0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d' and t43dad6b6c946e7f3d08b4cb24334c705.year = t8a4a84e735183537b2ba13726efd3e32.year + -3 left join "t8445ccb32dbc965d0d87de91aa1cac76" on "t8445ccb32dbc965d0d87de91aa1cac76"."pid" = "player"."pid" and t8445ccb32dbc965d0d87de91aa1cac76.year = t43dad6b6c946e7f3d08b4cb24334c705.year + 1 left join "t1d5c8eb7aa320de9aee48b57b62e411a" on "t1d5c8eb7aa320de9aee48b57b62e411a"."pid" = "player"."pid" and t1d5c8eb7aa320de9aee48b57b62e411a.year = t8445ccb32dbc965d0d87de91aa1cac76.year + 1 where player.pos IN ('WR') and t154eac9f9dbf17872b2f79e5a75b67cc.games >= '6' and player_seasonlogs.espn_overall_score > '0' group by player.fname, player.lname, "player_seasonlogs"."espn_overall_score", "t6dbc763279e59180a67cf964ed68662d"."recv_first_down_share_from_plays", "t8a4a84e735183537b2ba13726efd3e32"."points_per_game", "t43dad6b6c946e7f3d08b4cb24334c705"."points_per_game", "t8445ccb32dbc965d0d87de91aa1cac76"."rec_yds_from_plays_0", "t1d5c8eb7aa320de9aee48b57b62e411a"."rush_yds_from_plays_0", COALESCE(tcb3cea5c11f705e415f87574c59b9ac2.year, t154eac9f9dbf17872b2f79e5a75b67cc.year, player_seasonlogs.year, t6dbc763279e59180a67cf964ed68662d.year, t8a4a84e735183537b2ba13726efd3e32.year, t43dad6b6c946e7f3d08b4cb24334c705.year, t8445ccb32dbc965d0d87de91aa1cac76.year, t1d5c8eb7aa320de9aee48b57b62e411a.year), "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 6 DESC NULLS LAST, "player"."pid" asc limit 500`
    expect(query.toString()).to.equal(expected_query)
  })

  it('should create a query with prospect columns, weighted oppurtunity, and oppurtunity share', () => {
    const query = get_players_table_view_results({
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
    const expected_query = `with "tb3e36120a917f58fcbf72b163549f606" as (select COALESCE(bc_pid, trg_pid) as pid, ROUND(SUM(CASE WHEN nfl_plays.ydl_100 <= 20 AND bc_pid IS NOT NULL THEN 1.30 WHEN nfl_plays.ydl_100 <= 20 AND trg_pid IS NOT NULL THEN 2.25 WHEN nfl_plays.ydl_100 > 20 AND bc_pid IS NOT NULL THEN 0.48 WHEN nfl_plays.ydl_100 > 20 AND trg_pid IS NOT NULL THEN 1.43 ELSE 0 END), 2) as weighted_opportunity_from_plays_0 from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' group by COALESCE(bc_pid, trg_pid)), "td2b8e0d3ac807cd59229c712aefce1fd" as (select "pg"."pid", ROUND(100.0 * (COUNT(CASE WHEN nfl_plays.bc_pid = pg.pid THEN 1 ELSE NULL END) + COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END)) / NULLIF(SUM(CASE WHEN nfl_plays.bc_pid IS NOT NULL OR nfl_plays.trg_pid IS NOT NULL THEN 1 ELSE 0 END), 0), 2) as opportunity_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and ("bc_pid" is not null or "trg_pid" is not null) group by "pg"."pid") select "player"."pid", "tb3e36120a917f58fcbf72b163549f606"."weighted_opportunity_from_plays_0" as "weighted_opportunity_from_plays_0", "td2b8e0d3ac807cd59229c712aefce1fd"."opportunity_share_from_plays" AS "opportunity_share_from_plays_0", CASE WHEN player.height > 0 THEN ROUND(CAST((player.weight::float / NULLIF(player.height::float * player.height::float, 0)) * 703 AS NUMERIC), 2) ELSE NULL END as bmi_0, CASE WHEN player.forty > 0 THEN ROUND((player.weight * 200.0) / NULLIF(POWER(player.forty, 4), 0), 2) ELSE NULL END as speed_score_0, CASE WHEN player.pos IN ('WR', 'TE') AND player.forty > 0 THEN ROUND(((player.weight * 200.0) / NULLIF(POWER(player.forty, 4), 0)) * (player.height / CASE WHEN player.pos = 'TE' THEN 76.4 ELSE 73.0 END), 2) ELSE NULL END as height_adjusted_speed_score_0, ROUND(COALESCE(player.shuttle, 0) + COALESCE(player.cone, 0), 2) as agility_score_0, ROUND(COALESCE(player.vertical, 0) + (COALESCE(player.broad, 0) / 12.0), 2) as burst_score_0, "player"."pos" from "player" left join "tb3e36120a917f58fcbf72b163549f606" on "tb3e36120a917f58fcbf72b163549f606"."pid" = "player"."pid" left join "td2b8e0d3ac807cd59229c712aefce1fd" on "td2b8e0d3ac807cd59229c712aefce1fd"."pid" = "player"."pid" group by "tb3e36120a917f58fcbf72b163549f606"."weighted_opportunity_from_plays_0", "td2b8e0d3ac807cd59229c712aefce1fd"."opportunity_share_from_plays", player.weight, player.height, player.weight, player.forty, player.weight, player.forty, player.height, player.pos, player.shuttle, player.cone, player.vertical, player.broad, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    expect(query.toString()).to.equal(expected_query)
  })

  it('should create a query with player metrics, weighted opportunity, and roster status — sorted by bmi', () => {
    const query = get_players_table_view_results({
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
    const expected_query = `with "tb3e36120a917f58fcbf72b163549f606" as (select COALESCE(bc_pid, trg_pid) as pid, ROUND(SUM(CASE WHEN nfl_plays.ydl_100 <= 20 AND bc_pid IS NOT NULL THEN 1.30 WHEN nfl_plays.ydl_100 <= 20 AND trg_pid IS NOT NULL THEN 2.25 WHEN nfl_plays.ydl_100 > 20 AND bc_pid IS NOT NULL THEN 0.48 WHEN nfl_plays.ydl_100 > 20 AND trg_pid IS NOT NULL THEN 1.43 ELSE 0 END), 2) as weighted_opportunity_from_plays_0 from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' group by COALESCE(bc_pid, trg_pid)), "td2b8e0d3ac807cd59229c712aefce1fd" as (select "pg"."pid", ROUND(100.0 * (COUNT(CASE WHEN nfl_plays.bc_pid = pg.pid THEN 1 ELSE NULL END) + COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END)) / NULLIF(SUM(CASE WHEN nfl_plays.bc_pid IS NOT NULL OR nfl_plays.trg_pid IS NOT NULL THEN 1 ELSE 0 END), 0), 2) as opportunity_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and ("bc_pid" is not null or "trg_pid" is not null) group by "pg"."pid") select "player"."pid", player.fname, player.lname, CASE WHEN player.height > 0 THEN ROUND(CAST((player.weight::float / NULLIF(player.height::float * player.height::float, 0)) * 703 AS NUMERIC), 2) ELSE NULL END as bmi_0, CASE WHEN player.forty > 0 THEN ROUND((player.weight * 200.0) / NULLIF(POWER(player.forty, 4), 0), 2) ELSE NULL END as speed_score_0, CASE WHEN player.pos IN ('WR', 'TE') AND player.forty > 0 THEN ROUND(((player.weight * 200.0) / NULLIF(POWER(player.forty, 4), 0)) * (player.height / CASE WHEN player.pos = 'TE' THEN 76.4 ELSE 73.0 END), 2) ELSE NULL END as height_adjusted_speed_score_0, ROUND(COALESCE(player.shuttle, 0) + COALESCE(player.cone, 0), 2) as agility_score_0, ROUND(COALESCE(player.vertical, 0) + (COALESCE(player.broad, 0) / 12.0), 2) as burst_score_0, CASE WHEN rosters_players.slot = 13 THEN 'injured_reserve' WHEN rosters_players.slot = 12 THEN 'practice_squad' WHEN rosters_players.slot IS NULL THEN 'free_agent' ELSE 'active_roster' END AS player_league_roster_status, rosters_players.slot, rosters_players.tid, rosters_players.tag, "tb3e36120a917f58fcbf72b163549f606"."weighted_opportunity_from_plays_0" as "weighted_opportunity_from_plays_0", "td2b8e0d3ac807cd59229c712aefce1fd"."opportunity_share_from_plays" AS "opportunity_share_from_plays_0", "player"."pos" from "player" left join "rosters_players" on "rosters_players"."pid" = "player"."pid" and "rosters_players"."year" = 2024 and "rosters_players"."week" = 0 and "rosters_players"."lid" = 1 left join "tb3e36120a917f58fcbf72b163549f606" on "tb3e36120a917f58fcbf72b163549f606"."pid" = "player"."pid" left join "td2b8e0d3ac807cd59229c712aefce1fd" on "td2b8e0d3ac807cd59229c712aefce1fd"."pid" = "player"."pid" group by player.fname, player.lname, player.weight, player.height, player.weight, player.forty, player.weight, player.forty, player.height, player.pos, player.shuttle, player.cone, player.vertical, player.broad, rosters_players.slot, rosters_players.tid, rosters_players.tag, "tb3e36120a917f58fcbf72b163549f606"."weighted_opportunity_from_plays_0", "td2b8e0d3ac807cd59229c712aefce1fd"."opportunity_share_from_plays", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 4 DESC NULLS LAST, "player"."pid" asc limit 500`
    expect(query.toString()).to.equal(expected_query)
  })

  it('should generate query for fantasy points by plays — split by year 2022 to 2023', () => {
    const query = get_players_table_view_results({
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
    const expected_query = `with "tf3b2f4f44c1977dac3344cf400954b61" as (select pid, ROUND(SUM(CASE WHEN pid_type = 'trg' AND comp = true THEN 1 ELSE 0 END + CASE WHEN pid_type IN ('bc', 'trg') THEN COALESCE(rush_yds, 0) + COALESCE(recv_yds, 0) ELSE 0 END * 0.1 + CASE WHEN pid_type = 'psr' THEN COALESCE(pass_yds, 0) ELSE 0 END * 0.04 + CASE WHEN pid_type = 'bc' AND rush_td = true THEN 6 WHEN pid_type = 'trg' AND pass_td = true THEN 6 WHEN pid_type = 'psr' AND pass_td = true THEN 4 ELSE 0 END + CASE WHEN pid_type = 'psr' AND int = true THEN -1 ELSE 0 END + CASE WHEN pid_type = 'fuml' THEN -1 ELSE 0 END), 2) as fantasy_points_from_plays, "fantasy_points_plays"."year" from (select bc_pid as pid, 'bc' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year from "nfl_plays" where "bc_pid" is not null union all select psr_pid as pid, 'psr' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year from "nfl_plays" where "psr_pid" is not null union all select trg_pid as pid, 'trg' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year from "nfl_plays" where "trg_pid" is not null union all select player_fuml_pid as pid, 'fuml' as pid_type, NULL as rush_yds, NULL as recv_yds, NULL as rush_td, NULL as td, NULL as comp, NULL as int, NULL as pass_yds, NULL as pass_td, play_type, seas_type, year from "nfl_plays" where "player_fuml_pid" is not null) as "fantasy_points_plays" where not "play_type" = 'NOPL' and "seas_type" = 'REG' and "fantasy_points_plays"."year" in (2022, 2023) group by "fantasy_points_plays"."year", "pid") select "player"."pid", "tf3b2f4f44c1977dac3344cf400954b61"."fantasy_points_from_plays" AS "fantasy_points_from_plays_0", "t7f074a6a223c6b25aa0ab11ab5c40539"."points" AS "points_from_seasonlogs_0", COALESCE(tf3b2f4f44c1977dac3344cf400954b61.year, t7f074a6a223c6b25aa0ab11ab5c40539.year) AS year, "player"."pos" from "player" left join "tf3b2f4f44c1977dac3344cf400954b61" on "tf3b2f4f44c1977dac3344cf400954b61"."pid" = "player"."pid" and tf3b2f4f44c1977dac3344cf400954b61.year IN (2022,2023) left join "scoring_format_player_seasonlogs" as "t7f074a6a223c6b25aa0ab11ab5c40539" on "t7f074a6a223c6b25aa0ab11ab5c40539"."pid" = "player"."pid" and t7f074a6a223c6b25aa0ab11ab5c40539.scoring_format_hash = 'ad64bf40cdfec0a1ebdf66453fa57687832f7556f3870251c044d5d270fc089e' and "t7f074a6a223c6b25aa0ab11ab5c40539"."year" = "tf3b2f4f44c1977dac3344cf400954b61"."year" group by "tf3b2f4f44c1977dac3344cf400954b61"."fantasy_points_from_plays", "t7f074a6a223c6b25aa0ab11ab5c40539"."points", COALESCE(tf3b2f4f44c1977dac3344cf400954b61.year, t7f074a6a223c6b25aa0ab11ab5c40539.year), "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    expect(query.toString()).to.equal(expected_query)
  })

  it('should generate a fantasy points by play rate query', () => {
    const query = get_players_table_view_results({
      columns: [
        {
          column_id: 'player_fantasy_points_from_plays',
          params: {
            year: [2022, 2023]
          },
          rate_type: 'per_game'
        }
      ],
      sort: [
        {
          column_id: 'player_fantasy_points_from_plays',
          desc: true
        }
      ]
    })
    const expected_query = `with "t90223ae0a429aa55987c27ce7da054de" as (select "pid", count(*) as "rate_type_total_count" from "player_gamelogs" left join "nfl_games" on "nfl_games"."esbid" = "player_gamelogs"."esbid" where "seas_type" = 'REG' and "year" in (2022, 2023) group by "pid"), "tf3b2f4f44c1977dac3344cf400954b61" as (select pid, ROUND(SUM(CASE WHEN pid_type = 'trg' AND comp = true THEN 1 ELSE 0 END + CASE WHEN pid_type IN ('bc', 'trg') THEN COALESCE(rush_yds, 0) + COALESCE(recv_yds, 0) ELSE 0 END * 0.1 + CASE WHEN pid_type = 'psr' THEN COALESCE(pass_yds, 0) ELSE 0 END * 0.04 + CASE WHEN pid_type = 'bc' AND rush_td = true THEN 6 WHEN pid_type = 'trg' AND pass_td = true THEN 6 WHEN pid_type = 'psr' AND pass_td = true THEN 4 ELSE 0 END + CASE WHEN pid_type = 'psr' AND int = true THEN -1 ELSE 0 END + CASE WHEN pid_type = 'fuml' THEN -1 ELSE 0 END), 2) as fantasy_points_from_plays from (select bc_pid as pid, 'bc' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year from "nfl_plays" where "bc_pid" is not null union all select psr_pid as pid, 'psr' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year from "nfl_plays" where "psr_pid" is not null union all select trg_pid as pid, 'trg' as pid_type, rush_yds, recv_yds, rush_td, td, comp, int, pass_yds, pass_td, play_type, seas_type, year from "nfl_plays" where "trg_pid" is not null union all select player_fuml_pid as pid, 'fuml' as pid_type, NULL as rush_yds, NULL as recv_yds, NULL as rush_td, NULL as td, NULL as comp, NULL as int, NULL as pass_yds, NULL as pass_td, play_type, seas_type, year from "nfl_plays" where "player_fuml_pid" is not null) as "fantasy_points_plays" where not "play_type" = 'NOPL' and "seas_type" = 'REG' and "fantasy_points_plays"."year" in (2022, 2023) group by "pid") select "player"."pid", "tf3b2f4f44c1977dac3344cf400954b61"."fantasy_points_from_plays" / nullif(t90223ae0a429aa55987c27ce7da054de.rate_type_total_count, 0) AS "fantasy_points_from_plays_0", "player"."pos" from "player" left join "t90223ae0a429aa55987c27ce7da054de" on "t90223ae0a429aa55987c27ce7da054de"."pid" = "player"."pid" left join "tf3b2f4f44c1977dac3344cf400954b61" on "tf3b2f4f44c1977dac3344cf400954b61"."pid" = "player"."pid" group by "tf3b2f4f44c1977dac3344cf400954b61"."fantasy_points_from_plays", t90223ae0a429aa55987c27ce7da054de.rate_type_total_count, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
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
