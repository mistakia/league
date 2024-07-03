/* global describe it */

import chai from 'chai'

import { get_players_table_view_results } from '#libs-server'

const { expect } = chai

describe('LIBS SERVER get_players_table_view_results', () => {
  it('should return a query', () => {
    const query = get_players_table_view_results()
    const expected_query =
      'select "player"."pid" from "player" group by "player"."pid", "player"."lname", "player"."fname" limit 500'
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
    const expected_query = `with "t7f8e2aa2c1c4d6e00dacfa7a46010596" as (select "pg"."pid", ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) as trg_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and "seas_type" = 'REG' and "trg_pid" is not null and "nfl_plays"."year" in (2023) group by "pg"."pid" having ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) >= '25') select "player"."pid", "t7f8e2aa2c1c4d6e00dacfa7a46010596"."trg_share_from_plays" AS "trg_share_from_plays_0", player.fname, player.lname from "player" inner join "t7f8e2aa2c1c4d6e00dacfa7a46010596" on "t7f8e2aa2c1c4d6e00dacfa7a46010596"."pid" = "player"."pid" group by "t7f8e2aa2c1c4d6e00dacfa7a46010596"."trg_share_from_plays", player.fname, player.lname, "player"."pid", "player"."lname", "player"."fname" order by 2 DESC NULLS LAST limit 500`
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
    const expected_query = `with "t7f8e2aa2c1c4d6e00dacfa7a46010596" as (select "pg"."pid", ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) as trg_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and "seas_type" = 'REG' and "trg_pid" is not null and "nfl_plays"."year" in (2023) group by "pg"."pid" having ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) >= '25') select "player"."pid", "t7f8e2aa2c1c4d6e00dacfa7a46010596"."trg_share_from_plays" AS "trg_share_from_plays_0", "t7f8e2aa2c1c4d6e00dacfa7a46010596"."trg_share_from_plays" AS "trg_share_from_plays_1", player.fname, player.lname from "player" inner join "t7f8e2aa2c1c4d6e00dacfa7a46010596" on "t7f8e2aa2c1c4d6e00dacfa7a46010596"."pid" = "player"."pid" group by "t7f8e2aa2c1c4d6e00dacfa7a46010596"."trg_share_from_plays", "t7f8e2aa2c1c4d6e00dacfa7a46010596"."trg_share_from_plays", player.fname, player.lname, "player"."pid", "player"."lname", "player"."fname" order by 2 DESC NULLS LAST limit 500`
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
    const expected_query = `with "t7f8e2aa2c1c4d6e00dacfa7a46010596" as (select "pg"."pid", ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) as trg_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and "seas_type" = 'REG' and "trg_pid" is not null and "nfl_plays"."year" in (2023) group by "pg"."pid" having ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) >= '25'), "tf8f3a32ec3dc1413437cdf8a84874d57" as (select "pg"."pid", ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) as trg_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and "seas_type" = 'REG' and "trg_pid" is not null and "nfl_plays"."week" in (1, 2, 3) and "nfl_plays"."year" in (2022) group by "pg"."pid") select "player"."pid", "t7f8e2aa2c1c4d6e00dacfa7a46010596"."trg_share_from_plays" AS "trg_share_from_plays_0", player.fname, player.lname, "tf8f3a32ec3dc1413437cdf8a84874d57"."trg_share_from_plays" AS "trg_share_from_plays_1" from "player" inner join "t7f8e2aa2c1c4d6e00dacfa7a46010596" on "t7f8e2aa2c1c4d6e00dacfa7a46010596"."pid" = "player"."pid" left join "tf8f3a32ec3dc1413437cdf8a84874d57" on "tf8f3a32ec3dc1413437cdf8a84874d57"."pid" = "player"."pid" group by "t7f8e2aa2c1c4d6e00dacfa7a46010596"."trg_share_from_plays", player.fname, player.lname, "tf8f3a32ec3dc1413437cdf8a84874d57"."trg_share_from_plays", "player"."pid", "player"."lname", "player"."fname" order by 2 DESC NULLS LAST limit 500`
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
    const expected_query = `with "tb0774e9f460611b644870c2539d3b427" as (select "pg"."pid", ROUND(100.0 * SUM(CASE WHEN nfl_plays.trg_pid = pg.pid THEN nfl_plays.dot ELSE 0 END) / SUM(nfl_plays.dot), 2) as air_yds_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and "seas_type" = 'REG' and "trg_pid" is not null and "nfl_plays"."year" in (2023) group by "pg"."pid" having ROUND(100.0 * SUM(CASE WHEN nfl_plays.trg_pid = pg.pid THEN nfl_plays.dot ELSE 0 END) / SUM(nfl_plays.dot), 2) >= '25') select "player"."pid", "tb0774e9f460611b644870c2539d3b427"."air_yds_share_from_plays" AS "air_yds_share_from_plays_0", player.fname, player.lname from "player" inner join "tb0774e9f460611b644870c2539d3b427" on "tb0774e9f460611b644870c2539d3b427"."pid" = "player"."pid" group by "tb0774e9f460611b644870c2539d3b427"."air_yds_share_from_plays", player.fname, player.lname, "player"."pid", "player"."lname", "player"."fname" order by 2 DESC NULLS LAST limit 500`
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
    const expected_query = `with "t68d25f42a8068c5d91abd1117406525e" as (select "trg_pid", COUNT(*) as trg_from_plays_0 from "nfl_plays" where not "play_type" = 'NOPL' and "seas_type" = 'REG' and "nfl_plays"."dwn" in (3) and "nfl_plays"."year" in (2023) group by "trg_pid" having COUNT(*) >= '15'), "tf549760c477a589ac6f45cfcfe1ce8df" as (select "pg"."pid", ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) as trg_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and "seas_type" = 'REG' and "trg_pid" is not null and "nfl_plays"."dwn" in (3) and "nfl_plays"."year" in (2023) group by "pg"."pid"), "t1fada934bdf57a70b1e1a9c6280df76d" as (select "pg"."pid", ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) as trg_share_from_plays from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and "seas_type" = 'REG' and "trg_pid" is not null and "nfl_plays"."qtr" in (1, 2) and "nfl_plays"."year" in (2023) group by "pg"."pid") select "player"."pid", "t68d25f42a8068c5d91abd1117406525e"."trg_from_plays_0" as "trg_from_plays_0", player.fname, player.lname, "tf549760c477a589ac6f45cfcfe1ce8df"."trg_share_from_plays" AS "trg_share_from_plays_0", "t1fada934bdf57a70b1e1a9c6280df76d"."trg_share_from_plays" AS "trg_share_from_plays_1" from "player" inner join "t68d25f42a8068c5d91abd1117406525e" on "t68d25f42a8068c5d91abd1117406525e"."trg_pid" = "player"."pid" left join "tf549760c477a589ac6f45cfcfe1ce8df" on "tf549760c477a589ac6f45cfcfe1ce8df"."pid" = "player"."pid" left join "t1fada934bdf57a70b1e1a9c6280df76d" on "t1fada934bdf57a70b1e1a9c6280df76d"."pid" = "player"."pid" group by "t68d25f42a8068c5d91abd1117406525e"."trg_from_plays_0", player.fname, player.lname, "tf549760c477a589ac6f45cfcfe1ce8df"."trg_share_from_plays", "t1fada934bdf57a70b1e1a9c6280df76d"."trg_share_from_plays", "player"."pid", "player"."lname", "player"."fname" order by 5 DESC NULLS LAST limit 500`
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
    const expected_query = `with "t1ceac1f694bf82585921df0bec8fcc28" as (select "bc_pid", "nfl_plays"."year", SUM(rush_yds) as rush_yds_from_plays_0 from "nfl_plays" where not "play_type" = 'NOPL' and "seas_type" = 'REG' and "nfl_plays"."year" in (2020, 2021, 2022, 2023) group by "bc_pid", "nfl_plays"."year") select "player"."pid", player.fname, player.lname, "t1ceac1f694bf82585921df0bec8fcc28"."rush_yds_from_plays_0" as "rush_yds_from_plays_0", COALESCE(t1ceac1f694bf82585921df0bec8fcc28.year) AS year from "player" left join "t1ceac1f694bf82585921df0bec8fcc28" on "t1ceac1f694bf82585921df0bec8fcc28"."bc_pid" = "player"."pid" group by player.fname, player.lname, "t1ceac1f694bf82585921df0bec8fcc28"."rush_yds_from_plays_0", COALESCE(t1ceac1f694bf82585921df0bec8fcc28.year), "player"."pid", "player"."lname", "player"."fname" order by 4 DESC NULLS LAST limit 500`
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
    const expected_query = `with "t1ceac1f694bf82585921df0bec8fcc28" as (select "bc_pid", "nfl_plays"."year", SUM(rush_yds) as rush_yds_from_plays_0 from "nfl_plays" where not "play_type" = 'NOPL' and "seas_type" = 'REG' and "nfl_plays"."year" in (2020, 2021, 2022, 2023) group by "bc_pid", "nfl_plays"."year"), "t4380251a297ab24514bc69b66795912d" as (select "bc_pid", "nfl_plays"."year", CASE WHEN COUNT(*) > 0 THEN ROUND(SUM(rush_yds) / COUNT(*), 2) ELSE 0 END as rush_yds_per_att_from_plays_0 from "nfl_plays" where not "play_type" = 'NOPL' and "seas_type" = 'REG' and "nfl_plays"."year" in (2023) and "nfl_plays"."xpass_prob" between 0 and 0.4 group by "bc_pid", "nfl_plays"."year"), "td86f802af88c2fbcd29122fc8a763de2" as (select "bc_pid", "nfl_plays"."year", SUM(rush_yds) as rush_yds_from_plays_0 from "nfl_plays" where not "play_type" = 'NOPL' and "seas_type" = 'REG' and "nfl_plays"."dwn" in (1, 2) and "nfl_plays"."year" in (2020, 2021, 2022, 2023) group by "bc_pid", "nfl_plays"."year") select "player"."pid", player.fname, player.lname, "t1ceac1f694bf82585921df0bec8fcc28"."rush_yds_from_plays_0" as "rush_yds_from_plays_0", "t4380251a297ab24514bc69b66795912d"."rush_yds_per_att_from_plays_0" as "rush_yds_per_att_from_plays_0", "td86f802af88c2fbcd29122fc8a763de2"."rush_yds_from_plays_0" as "rush_yds_from_plays_1", COALESCE(t1ceac1f694bf82585921df0bec8fcc28.year, t4380251a297ab24514bc69b66795912d.year, td86f802af88c2fbcd29122fc8a763de2.year) AS year from "player" left join "t1ceac1f694bf82585921df0bec8fcc28" on "t1ceac1f694bf82585921df0bec8fcc28"."bc_pid" = "player"."pid" left join "t4380251a297ab24514bc69b66795912d" on "t4380251a297ab24514bc69b66795912d"."bc_pid" = "player"."pid" and "t4380251a297ab24514bc69b66795912d"."year" = "t1ceac1f694bf82585921df0bec8fcc28"."year" left join "td86f802af88c2fbcd29122fc8a763de2" on "td86f802af88c2fbcd29122fc8a763de2"."bc_pid" = "player"."pid" and "td86f802af88c2fbcd29122fc8a763de2"."year" = "t4380251a297ab24514bc69b66795912d"."year" group by player.fname, player.lname, "t1ceac1f694bf82585921df0bec8fcc28"."rush_yds_from_plays_0", "t4380251a297ab24514bc69b66795912d"."rush_yds_per_att_from_plays_0", "td86f802af88c2fbcd29122fc8a763de2"."rush_yds_from_plays_0", COALESCE(t1ceac1f694bf82585921df0bec8fcc28.year, t4380251a297ab24514bc69b66795912d.year, td86f802af88c2fbcd29122fc8a763de2.year), "player"."pid", "player"."lname", "player"."fname" order by 4 DESC NULLS LAST limit 500`
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
    const expected_query = `with "t01b11e3dd6711866524242f4de796cda" as (select "pg"."pid", ROUND((1.5 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / NULLIF(COUNT(*), 0)) + (0.7 * SUM(CASE WHEN nfl_plays.trg_pid = pg.pid THEN nfl_plays.dot ELSE 0 END) / NULLIF(SUM(nfl_plays.dot), 0)), 4) as weighted_opp_rating_from_plays, "nfl_plays"."year" from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and "seas_type" = 'REG' and "trg_pid" is not null and "nfl_plays"."year" in (2022, 2023) and "nfl_plays"."xpass_prob" between 0.7 and 1 group by "pg"."pid", "nfl_plays"."year"), "t573a9a4e9f61686cedc1b37cf2cfc62a" as (select "trg_pid", "nfl_plays"."year", COUNT(*) as trg_from_plays_0 from "nfl_plays" where not "play_type" = 'NOPL' and "seas_type" = 'REG' and "nfl_plays"."year" in (2022, 2023) and "nfl_plays"."xpass_prob" between 0.7 and 1 group by "trg_pid", "nfl_plays"."year") select "player"."pid", player.fname, player.lname, "player"."pos" AS "pos_0", "t01b11e3dd6711866524242f4de796cda"."weighted_opp_rating_from_plays" AS "weighted_opp_rating_from_plays_0", "t573a9a4e9f61686cedc1b37cf2cfc62a"."trg_from_plays_0" as "trg_from_plays_0", COALESCE(t01b11e3dd6711866524242f4de796cda.year, t573a9a4e9f61686cedc1b37cf2cfc62a.year) AS year from "player" left join "t01b11e3dd6711866524242f4de796cda" on "t01b11e3dd6711866524242f4de796cda"."pid" = "player"."pid" left join "t573a9a4e9f61686cedc1b37cf2cfc62a" on "t573a9a4e9f61686cedc1b37cf2cfc62a"."trg_pid" = "player"."pid" and "t573a9a4e9f61686cedc1b37cf2cfc62a"."year" = "t01b11e3dd6711866524242f4de796cda"."year" where player.pos IN ('WR') group by player.fname, player.lname, "player"."pos", "t01b11e3dd6711866524242f4de796cda"."weighted_opp_rating_from_plays", "t573a9a4e9f61686cedc1b37cf2cfc62a"."trg_from_plays_0", COALESCE(t01b11e3dd6711866524242f4de796cda.year, t573a9a4e9f61686cedc1b37cf2cfc62a.year), "player"."pid", "player"."lname", "player"."fname" order by 5 DESC NULLS LAST limit 500`
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
    const expected_query = `with "t45a638cf2fdc84646b5009d57980678a" as (select "pg"."pid", ROUND((1.5 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / NULLIF(COUNT(*), 0)) + (0.7 * SUM(CASE WHEN nfl_plays.trg_pid = pg.pid THEN nfl_plays.dot ELSE 0 END) / NULLIF(SUM(nfl_plays.dot), 0)), 4) as weighted_opp_rating_from_plays, "nfl_plays"."year" from "nfl_plays" inner join "player_gamelogs" as "pg" on "nfl_plays"."esbid" = "pg"."esbid" and "nfl_plays"."off" = "pg"."tm" where not "play_type" = 'NOPL' and "seas_type" = 'REG' and "trg_pid" is not null group by "pg"."pid", "nfl_plays"."year") select "player"."pid", player.fname, player.lname, "player_seasonlogs"."espn_open_score" AS "espn_open_score_0", "t45a638cf2fdc84646b5009d57980678a"."weighted_opp_rating_from_plays" AS "weighted_opp_rating_from_plays_0", COALESCE(player_seasonlogs.year, t45a638cf2fdc84646b5009d57980678a.year) AS year from "player" left join "player_seasonlogs" on "player_seasonlogs"."pid" = "player"."pid" left join "t45a638cf2fdc84646b5009d57980678a" on "t45a638cf2fdc84646b5009d57980678a"."pid" = "player"."pid" and "t45a638cf2fdc84646b5009d57980678a"."year" = "player_seasonlogs"."year" group by player.fname, player.lname, "player_seasonlogs"."espn_open_score", "t45a638cf2fdc84646b5009d57980678a"."weighted_opp_rating_from_plays", COALESCE(player_seasonlogs.year, t45a638cf2fdc84646b5009d57980678a.year), "player"."pid", "player"."lname", "player"."fname" order by 4 DESC NULLS LAST limit 500`
    expect(query.toString()).to.equal(expected_query)
  })

  it('should create a query with fantasy points from seasonlogs', () => {
    const query = get_players_table_view_results({
      prefix_columns: ['player_name'],
      columns: [
        'player_fantasy_points_from_seasonlogs',
        'player_fantasy_points_per_game_from_seasonlogs',
        'player_fantasy_points_rank_from_seasonlogs',
        'player_fantasy_points_position_rank_from_seasonlogs'
      ],
      sort: [
        {
          column_id: 'player_fantasy_points_from_seasonlogs',
          desc: true
        }
      ]
    })
    const expected_query = `select "player"."pid", player.fname, player.lname, "t11b6b132b846955bec14bad1bf028f8b"."points" AS "points_0", "t11b6b132b846955bec14bad1bf028f8b"."points_per_game" AS "points_per_game_0", "t11b6b132b846955bec14bad1bf028f8b"."points_rnk" AS "points_rnk_0", "t11b6b132b846955bec14bad1bf028f8b"."points_pos_rnk" AS "points_pos_rnk_0" from "player" left join "scoring_format_player_seasonlogs" as "t11b6b132b846955bec14bad1bf028f8b" on "t11b6b132b846955bec14bad1bf028f8b"."pid" = "player"."pid" and "t11b6b132b846955bec14bad1bf028f8b"."year" = 2023 and t11b6b132b846955bec14bad1bf028f8b.scoring_format_hash = '0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d' group by player.fname, player.lname, "t11b6b132b846955bec14bad1bf028f8b"."points", "t11b6b132b846955bec14bad1bf028f8b"."points_per_game", "t11b6b132b846955bec14bad1bf028f8b"."points_rnk", "t11b6b132b846955bec14bad1bf028f8b"."points_pos_rnk", "player"."pid", "player"."lname", "player"."fname" order by 4 DESC NULLS LAST limit 500`
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
    const expected_query = `select "player"."pid", player.fname, player.lname, "t0984699909800a4c1372fbe19abf07af"."points" AS "points_0", "t0984699909800a4c1372fbe19abf07af"."points_per_game" AS "points_per_game_0", "t0984699909800a4c1372fbe19abf07af"."games" AS "games_0", "t0984699909800a4c1372fbe19abf07af"."top_3" AS "top_3_0", "t0984699909800a4c1372fbe19abf07af"."top_6" AS "top_6_0", "t0984699909800a4c1372fbe19abf07af"."top_12" AS "top_12_0", "t0984699909800a4c1372fbe19abf07af"."top_24" AS "top_24_0", "t0984699909800a4c1372fbe19abf07af"."top_36" AS "top_36_0" from "player" left join "scoring_format_player_careerlogs" as "t0984699909800a4c1372fbe19abf07af" on "t0984699909800a4c1372fbe19abf07af"."pid" = "player"."pid" and t0984699909800a4c1372fbe19abf07af.scoring_format_hash = '0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d' group by player.fname, player.lname, "t0984699909800a4c1372fbe19abf07af"."points", "t0984699909800a4c1372fbe19abf07af"."points_per_game", "t0984699909800a4c1372fbe19abf07af"."games", "t0984699909800a4c1372fbe19abf07af"."top_3", "t0984699909800a4c1372fbe19abf07af"."top_6", "t0984699909800a4c1372fbe19abf07af"."top_12", "t0984699909800a4c1372fbe19abf07af"."top_24", "t0984699909800a4c1372fbe19abf07af"."top_36", "player"."pid", "player"."lname", "player"."fname" order by 4 DESC NULLS LAST limit 500`
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
