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
    const expected_query = `with "tfb16237785eba714b3b42848716d7ad5" as (select "pg"."pid", ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) as trg_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "trg_pid" is not null and "nfl_plays"."year" in (2023) group by "pg"."pid" having ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) >= '25') select "player"."pid", "tfb16237785eba714b3b42848716d7ad5"."trg_share_from_plays" AS "trg_share_from_plays_0", player.fname, player.lname, "player"."pos" from "player" inner join "tfb16237785eba714b3b42848716d7ad5" on "tfb16237785eba714b3b42848716d7ad5"."pid" = "player"."pid" group by "tfb16237785eba714b3b42848716d7ad5"."trg_share_from_plays", player.fname, player.lname, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST limit 500`
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
    const expected_query = `with "tfb16237785eba714b3b42848716d7ad5" as (select "pg"."pid", ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) as trg_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "trg_pid" is not null and "nfl_plays"."year" in (2023) group by "pg"."pid" having ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) >= '25') select "player"."pid", "tfb16237785eba714b3b42848716d7ad5"."trg_share_from_plays" AS "trg_share_from_plays_0", "tfb16237785eba714b3b42848716d7ad5"."trg_share_from_plays" AS "trg_share_from_plays_1", player.fname, player.lname, "player"."pos" from "player" inner join "tfb16237785eba714b3b42848716d7ad5" on "tfb16237785eba714b3b42848716d7ad5"."pid" = "player"."pid" group by "tfb16237785eba714b3b42848716d7ad5"."trg_share_from_plays", "tfb16237785eba714b3b42848716d7ad5"."trg_share_from_plays", player.fname, player.lname, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST limit 500`
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
    const expected_query = `with "tfb16237785eba714b3b42848716d7ad5" as (select "pg"."pid", ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) as trg_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "trg_pid" is not null and "nfl_plays"."year" in (2023) group by "pg"."pid" having ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) >= '25'), "t6473219292c0fbb60c905f65900c0771" as (select "pg"."pid", ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) as trg_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "trg_pid" is not null and "nfl_plays"."week" in (1, 2, 3) and "nfl_plays"."year" in (2022) group by "pg"."pid") select "player"."pid", "tfb16237785eba714b3b42848716d7ad5"."trg_share_from_plays" AS "trg_share_from_plays_0", player.fname, player.lname, "t6473219292c0fbb60c905f65900c0771"."trg_share_from_plays" AS "trg_share_from_plays_1", "player"."pos" from "player" inner join "tfb16237785eba714b3b42848716d7ad5" on "tfb16237785eba714b3b42848716d7ad5"."pid" = "player"."pid" left join "t6473219292c0fbb60c905f65900c0771" on "t6473219292c0fbb60c905f65900c0771"."pid" = "player"."pid" group by "tfb16237785eba714b3b42848716d7ad5"."trg_share_from_plays", player.fname, player.lname, "t6473219292c0fbb60c905f65900c0771"."trg_share_from_plays", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST limit 500`
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
    const expected_query = `with "t00c5fbd2acc4e9c4dbf48214a28d6d74" as (select "pg"."pid", ROUND(100.0 * SUM(CASE WHEN nfl_plays.trg_pid = pg.pid THEN nfl_plays.dot ELSE 0 END) / SUM(nfl_plays.dot), 2) as air_yds_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "trg_pid" is not null and "nfl_plays"."year" in (2023) group by "pg"."pid" having ROUND(100.0 * SUM(CASE WHEN nfl_plays.trg_pid = pg.pid THEN nfl_plays.dot ELSE 0 END) / SUM(nfl_plays.dot), 2) >= '25') select "player"."pid", "t00c5fbd2acc4e9c4dbf48214a28d6d74"."air_yds_share_from_plays" AS "air_yds_share_from_plays_0", player.fname, player.lname, "player"."pos" from "player" inner join "t00c5fbd2acc4e9c4dbf48214a28d6d74" on "t00c5fbd2acc4e9c4dbf48214a28d6d74"."pid" = "player"."pid" group by "t00c5fbd2acc4e9c4dbf48214a28d6d74"."air_yds_share_from_plays", player.fname, player.lname, "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST limit 500`
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
    const expected_query = `with "tbe7ece48420f88ac1870511903a0096e" as (select "trg_pid", COUNT(*) as trg_from_plays_0 from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."dwn" in (3) and "nfl_plays"."year" in (2023) group by "trg_pid" having COUNT(*) >= '15'), "t13726dca4444f428f89ad78c47dbf643" as (select "pg"."pid", ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) as trg_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "trg_pid" is not null and "nfl_plays"."dwn" in (3) and "nfl_plays"."year" in (2023) group by "pg"."pid"), "t0336aee1cbe89c7d08be4a28ff50d9d3" as (select "pg"."pid", ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) as trg_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "trg_pid" is not null and "nfl_plays"."qtr" in (1, 2) and "nfl_plays"."year" in (2023) group by "pg"."pid") select "player"."pid", "tbe7ece48420f88ac1870511903a0096e"."trg_from_plays_0" as "trg_from_plays_0", player.fname, player.lname, "t13726dca4444f428f89ad78c47dbf643"."trg_share_from_plays" AS "trg_share_from_plays_0", "t0336aee1cbe89c7d08be4a28ff50d9d3"."trg_share_from_plays" AS "trg_share_from_plays_1", "player"."pos" from "player" inner join "tbe7ece48420f88ac1870511903a0096e" on "tbe7ece48420f88ac1870511903a0096e"."trg_pid" = "player"."pid" left join "t13726dca4444f428f89ad78c47dbf643" on "t13726dca4444f428f89ad78c47dbf643"."pid" = "player"."pid" left join "t0336aee1cbe89c7d08be4a28ff50d9d3" on "t0336aee1cbe89c7d08be4a28ff50d9d3"."pid" = "player"."pid" group by "tbe7ece48420f88ac1870511903a0096e"."trg_from_plays_0", player.fname, player.lname, "t13726dca4444f428f89ad78c47dbf643"."trg_share_from_plays", "t0336aee1cbe89c7d08be4a28ff50d9d3"."trg_share_from_plays", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 5 DESC NULLS LAST limit 500`
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
    const expected_query = `with "tc49d4fe6e03c85739c185fdaf8ba8090" as (select "bc_pid", "nfl_plays"."year", SUM(rush_yds) as rush_yds_from_plays_0 from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."year" in (2020, 2021, 2022, 2023) group by "bc_pid", "nfl_plays"."year") select "player"."pid", player.fname, player.lname, "tc49d4fe6e03c85739c185fdaf8ba8090"."rush_yds_from_plays_0" as "rush_yds_from_plays_0", COALESCE(tc49d4fe6e03c85739c185fdaf8ba8090.year) AS year, "player"."pos" from "player" left join "tc49d4fe6e03c85739c185fdaf8ba8090" on "tc49d4fe6e03c85739c185fdaf8ba8090"."bc_pid" = "player"."pid" group by player.fname, player.lname, "tc49d4fe6e03c85739c185fdaf8ba8090"."rush_yds_from_plays_0", COALESCE(tc49d4fe6e03c85739c185fdaf8ba8090.year), "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 4 DESC NULLS LAST limit 500`
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
    const expected_query = `with "tc49d4fe6e03c85739c185fdaf8ba8090" as (select "bc_pid", "nfl_plays"."year", SUM(rush_yds) as rush_yds_from_plays_0 from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."year" in (2020, 2021, 2022, 2023) group by "bc_pid", "nfl_plays"."year"), "t5621f380bed0390e348c0fb086250fdb" as (select "bc_pid", "nfl_plays"."year", CASE WHEN COUNT(*) > 0 THEN ROUND(SUM(rush_yds) / COUNT(*), 2) ELSE 0 END as rush_yds_per_att_from_plays_0 from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."year" in (2023) and "nfl_plays"."xpass_prob" between 0 and 0.4 group by "bc_pid", "nfl_plays"."year"), "t48788ecfb2ff1ac3e14a50301819d804" as (select "bc_pid", "nfl_plays"."year", SUM(rush_yds) as rush_yds_from_plays_0 from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."dwn" in (1, 2) and "nfl_plays"."year" in (2020, 2021, 2022, 2023) group by "bc_pid", "nfl_plays"."year") select "player"."pid", player.fname, player.lname, "tc49d4fe6e03c85739c185fdaf8ba8090"."rush_yds_from_plays_0" as "rush_yds_from_plays_0", "t5621f380bed0390e348c0fb086250fdb"."rush_yds_per_att_from_plays_0" as "rush_yds_per_att_from_plays_0", "t48788ecfb2ff1ac3e14a50301819d804"."rush_yds_from_plays_0" as "rush_yds_from_plays_1", COALESCE(tc49d4fe6e03c85739c185fdaf8ba8090.year, t5621f380bed0390e348c0fb086250fdb.year, t48788ecfb2ff1ac3e14a50301819d804.year) AS year, "player"."pos" from "player" left join "tc49d4fe6e03c85739c185fdaf8ba8090" on "tc49d4fe6e03c85739c185fdaf8ba8090"."bc_pid" = "player"."pid" left join "t5621f380bed0390e348c0fb086250fdb" on "t5621f380bed0390e348c0fb086250fdb"."bc_pid" = "player"."pid" and "t5621f380bed0390e348c0fb086250fdb"."year" = "tc49d4fe6e03c85739c185fdaf8ba8090"."year" left join "t48788ecfb2ff1ac3e14a50301819d804" on "t48788ecfb2ff1ac3e14a50301819d804"."bc_pid" = "player"."pid" and "t48788ecfb2ff1ac3e14a50301819d804"."year" = "t5621f380bed0390e348c0fb086250fdb"."year" group by player.fname, player.lname, "tc49d4fe6e03c85739c185fdaf8ba8090"."rush_yds_from_plays_0", "t5621f380bed0390e348c0fb086250fdb"."rush_yds_per_att_from_plays_0", "t48788ecfb2ff1ac3e14a50301819d804"."rush_yds_from_plays_0", COALESCE(tc49d4fe6e03c85739c185fdaf8ba8090.year, t5621f380bed0390e348c0fb086250fdb.year, t48788ecfb2ff1ac3e14a50301819d804.year), "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 4 DESC NULLS LAST limit 500`
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
    const expected_query = `with "t0dc566e07849c6ff647b207067d61849" as (select "pg"."pid", ROUND((1.5 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / NULLIF(COUNT(*), 0)) + (0.7 * SUM(CASE WHEN nfl_plays.trg_pid = pg.pid THEN nfl_plays.dot ELSE 0 END) / NULLIF(SUM(nfl_plays.dot), 0)), 4) as weighted_opp_rating_from_plays, "nfl_plays"."year" from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "trg_pid" is not null and "nfl_plays"."year" in (2022, 2023) and "nfl_plays"."xpass_prob" between 0.7 and 1 group by "pg"."pid", "nfl_plays"."year"), "tc1878b0b74778dc53dedcedb8eb5774b" as (select "trg_pid", "nfl_plays"."year", COUNT(*) as trg_from_plays_0 from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."year" in (2022, 2023) and "nfl_plays"."xpass_prob" between 0.7 and 1 group by "trg_pid", "nfl_plays"."year") select "player"."pid", player.fname, player.lname, "player"."pos" AS "pos_0", "t0dc566e07849c6ff647b207067d61849"."weighted_opp_rating_from_plays" AS "weighted_opp_rating_from_plays_0", "tc1878b0b74778dc53dedcedb8eb5774b"."trg_from_plays_0" as "trg_from_plays_0", COALESCE(t0dc566e07849c6ff647b207067d61849.year, tc1878b0b74778dc53dedcedb8eb5774b.year) AS year, "player"."pos" from "player" left join "t0dc566e07849c6ff647b207067d61849" on "t0dc566e07849c6ff647b207067d61849"."pid" = "player"."pid" left join "tc1878b0b74778dc53dedcedb8eb5774b" on "tc1878b0b74778dc53dedcedb8eb5774b"."trg_pid" = "player"."pid" and "tc1878b0b74778dc53dedcedb8eb5774b"."year" = "t0dc566e07849c6ff647b207067d61849"."year" where player.pos IN ('WR') group by player.fname, player.lname, "player"."pos", "t0dc566e07849c6ff647b207067d61849"."weighted_opp_rating_from_plays", "tc1878b0b74778dc53dedcedb8eb5774b"."trg_from_plays_0", COALESCE(t0dc566e07849c6ff647b207067d61849.year, tc1878b0b74778dc53dedcedb8eb5774b.year), "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 5 DESC NULLS LAST limit 500`
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
    const expected_query = `with "tf73e96d27b45898354be12d742e66a03" as (select "pg"."pid", ROUND((1.5 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / NULLIF(COUNT(*), 0)) + (0.7 * SUM(CASE WHEN nfl_plays.trg_pid = pg.pid THEN nfl_plays.dot ELSE 0 END) / NULLIF(SUM(nfl_plays.dot), 0)), 4) as weighted_opp_rating_from_plays, "nfl_plays"."year" from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "trg_pid" is not null group by "pg"."pid", "nfl_plays"."year") select "player"."pid", player.fname, player.lname, "player_seasonlogs"."espn_open_score" AS "espn_open_score_0", "tf73e96d27b45898354be12d742e66a03"."weighted_opp_rating_from_plays" AS "weighted_opp_rating_from_plays_0", COALESCE(player_seasonlogs.year, tf73e96d27b45898354be12d742e66a03.year) AS year, "player"."pos" from "player" left join "player_seasonlogs" on "player_seasonlogs"."pid" = "player"."pid" left join "tf73e96d27b45898354be12d742e66a03" on "tf73e96d27b45898354be12d742e66a03"."pid" = "player"."pid" and "tf73e96d27b45898354be12d742e66a03"."year" = "player_seasonlogs"."year" group by player.fname, player.lname, "player_seasonlogs"."espn_open_score", "tf73e96d27b45898354be12d742e66a03"."weighted_opp_rating_from_plays", COALESCE(player_seasonlogs.year, tf73e96d27b45898354be12d742e66a03.year), "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 4 DESC NULLS LAST limit 500`
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
    const expected_query = `select "player"."pid", player.fname, player.lname, "t626199f46d9de1cc8bf280d9b15d6c9b"."points" AS "points_from_seasonlogs_0", "t626199f46d9de1cc8bf280d9b15d6c9b"."points_per_game" AS "points_per_game_from_seasonlogs_0", "t626199f46d9de1cc8bf280d9b15d6c9b"."points_rnk" AS "points_rnk_from_seasonlogs_0", "t626199f46d9de1cc8bf280d9b15d6c9b"."points_pos_rnk" AS "points_pos_rnk_from_seasonlogs_0", "player"."pos" from "player" left join "scoring_format_player_seasonlogs" as "t626199f46d9de1cc8bf280d9b15d6c9b" on "t626199f46d9de1cc8bf280d9b15d6c9b"."pid" = "player"."pid" and t626199f46d9de1cc8bf280d9b15d6c9b.scoring_format_hash = '0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d' group by player.fname, player.lname, "t626199f46d9de1cc8bf280d9b15d6c9b"."points", "t626199f46d9de1cc8bf280d9b15d6c9b"."points_per_game", "t626199f46d9de1cc8bf280d9b15d6c9b"."points_rnk", "t626199f46d9de1cc8bf280d9b15d6c9b"."points_pos_rnk", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 4 DESC NULLS LAST limit 500`
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
    const expected_query = `select "player"."pid", player.fname, player.lname, "tcb53652543034aeb03043f1af2cac9a3"."startable_games" AS "startable_games_from_seasonlogs_0", "tcb53652543034aeb03043f1af2cac9a3"."points_added" AS "points_added_from_seasonlogs_0", "tcb53652543034aeb03043f1af2cac9a3"."points_added_per_game" AS "points_added_per_game_from_seasonlogs_0", "tcb53652543034aeb03043f1af2cac9a3"."points_added_rnk" AS "points_added_rnk_from_seasonlogs_0", "tcb53652543034aeb03043f1af2cac9a3"."points_added_pos_rnk" AS "points_added_pos_rnk_from_seasonlogs_0", "t2c88ab25d4acbc66daf6137b64987326"."startable_games" AS "startable_games_from_careerlogs_0", "t2c88ab25d4acbc66daf6137b64987326"."points_added" AS "points_added_from_careerlogs_0", "t2c88ab25d4acbc66daf6137b64987326"."points_added_per_game" AS "points_added_per_game_from_careerlogs_0", "t2c88ab25d4acbc66daf6137b64987326"."best_season_points_added_per_game" AS "best_season_points_added_per_game_from_careerlogs_0", "t2c88ab25d4acbc66daf6137b64987326"."points_added_first_three_seas" AS "points_added_first_three_seas_from_careerlogs_0", "t2c88ab25d4acbc66daf6137b64987326"."points_added_first_four_seas" AS "points_added_first_four_seas_from_careerlogs_0", "t2c88ab25d4acbc66daf6137b64987326"."points_added_first_five_seas" AS "points_added_first_five_seas_from_careerlogs_0", "t2c88ab25d4acbc66daf6137b64987326"."points_added_first_seas" AS "points_added_first_seas_from_careerlogs_0", "t2c88ab25d4acbc66daf6137b64987326"."points_added_second_seas" AS "points_added_second_seas_from_careerlogs_0", "t2c88ab25d4acbc66daf6137b64987326"."points_added_third_seas" AS "points_added_third_seas_from_careerlogs_0", "t2c88ab25d4acbc66daf6137b64987326"."draft_rank" AS "draft_rank_from_careerlogs_0", "player"."pos" from "player" left join "league_format_player_seasonlogs" as "tcb53652543034aeb03043f1af2cac9a3" on "tcb53652543034aeb03043f1af2cac9a3"."pid" = "player"."pid" and tcb53652543034aeb03043f1af2cac9a3.league_format_hash = '1985e1968b75707ebcab9da620176a0b218c5c1bd28d00cbbc4d1744a1631d0b' left join "league_format_player_careerlogs" as "t2c88ab25d4acbc66daf6137b64987326" on "t2c88ab25d4acbc66daf6137b64987326"."pid" = "player"."pid" and t2c88ab25d4acbc66daf6137b64987326.league_format_hash = '1985e1968b75707ebcab9da620176a0b218c5c1bd28d00cbbc4d1744a1631d0b' group by player.fname, player.lname, "tcb53652543034aeb03043f1af2cac9a3"."startable_games", "tcb53652543034aeb03043f1af2cac9a3"."points_added", "tcb53652543034aeb03043f1af2cac9a3"."points_added_per_game", "tcb53652543034aeb03043f1af2cac9a3"."points_added_rnk", "tcb53652543034aeb03043f1af2cac9a3"."points_added_pos_rnk", "t2c88ab25d4acbc66daf6137b64987326"."startable_games", "t2c88ab25d4acbc66daf6137b64987326"."points_added", "t2c88ab25d4acbc66daf6137b64987326"."points_added_per_game", "t2c88ab25d4acbc66daf6137b64987326"."best_season_points_added_per_game", "t2c88ab25d4acbc66daf6137b64987326"."points_added_first_three_seas", "t2c88ab25d4acbc66daf6137b64987326"."points_added_first_four_seas", "t2c88ab25d4acbc66daf6137b64987326"."points_added_first_five_seas", "t2c88ab25d4acbc66daf6137b64987326"."points_added_first_seas", "t2c88ab25d4acbc66daf6137b64987326"."points_added_second_seas", "t2c88ab25d4acbc66daf6137b64987326"."points_added_third_seas", "t2c88ab25d4acbc66daf6137b64987326"."draft_rank", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 11 DESC NULLS LAST limit 500`
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
    const expected_query = `with "td871ef36bef200157216fece0d7551ce" as (select "pg"."pid", ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) as trg_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "trg_pid" is not null and "pg"."career_game" between 1 and 1 group by "pg"."pid" having ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) >= '15') select "player"."pid", "td871ef36bef200157216fece0d7551ce"."trg_share_from_plays" AS "trg_share_from_plays_0", player.fname, player.lname, "t0984699909800a4c1372fbe19abf07af"."top_1" AS "top_1_from_careerlogs_0", "t0984699909800a4c1372fbe19abf07af"."top_3" AS "top_3_from_careerlogs_0", "t0984699909800a4c1372fbe19abf07af"."top_6" AS "top_6_from_careerlogs_0", "t0984699909800a4c1372fbe19abf07af"."top_12" AS "top_12_from_careerlogs_0", "player"."pos" from "player" inner join "td871ef36bef200157216fece0d7551ce" on "td871ef36bef200157216fece0d7551ce"."pid" = "player"."pid" left join "scoring_format_player_careerlogs" as "t0984699909800a4c1372fbe19abf07af" on "t0984699909800a4c1372fbe19abf07af"."pid" = "player"."pid" and t0984699909800a4c1372fbe19abf07af.scoring_format_hash = '0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d' group by "td871ef36bef200157216fece0d7551ce"."trg_share_from_plays", player.fname, player.lname, "t0984699909800a4c1372fbe19abf07af"."top_1", "t0984699909800a4c1372fbe19abf07af"."top_3", "t0984699909800a4c1372fbe19abf07af"."top_6", "t0984699909800a4c1372fbe19abf07af"."top_12", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 5 DESC NULLS LAST limit 500`
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
