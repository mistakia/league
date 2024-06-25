/* global describe it */

import chai from 'chai'

import { get_players_table_view_results } from '#libs-server'

const { expect } = chai

describe('LIBS SERVER get_players_table_view_results', () => {
  it('should return a query', () => {
    const query = get_players_table_view_results()
    const expected_query =
      'select `player`.`pid` from `player` group by `player`.`pid`, `player`.`lname`, `player`.`fname` limit 500'
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
    const expected_query =
      "with `5a905dee3bafcd06e930b2c052d5d5e5a2abeef71a709c4b703a742060df2bdf` as (select `pg`.`pid`, ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) AS trg_share_from_plays from `nfl_plays` inner join `player_gamelogs` as `pg` on `nfl_plays`.`esbid` = `pg`.`esbid` and `nfl_plays`.`off` = `pg`.`tm` where not `play_type` = 'NOPL' and `seas_type` = 'REG' and `trg_pid` is not null and `year` in (2023) group by `pg`.`pid` having trg_share_from_plays >= '25') select `player`.`pid`, `5a905dee3bafcd06e930b2c052d5d5e5a2abeef71a709c4b703a742060df2bdf`.`trg_share_from_plays` as `trg_share_from_plays_0`, player.fname, player.lname from `player` inner join `5a905dee3bafcd06e930b2c052d5d5e5a2abeef71a709c4b703a742060df2bdf` on `5a905dee3bafcd06e930b2c052d5d5e5a2abeef71a709c4b703a742060df2bdf`.`pid` = `player`.`pid` group by `player`.`pid`, `player`.`lname`, `player`.`fname` order by `trg_share_from_plays_0` IS NULL, `trg_share_from_plays_0` desc limit 500"
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
    const expected_query =
      "with `5a905dee3bafcd06e930b2c052d5d5e5a2abeef71a709c4b703a742060df2bdf` as (select `pg`.`pid`, ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) AS trg_share_from_plays from `nfl_plays` inner join `player_gamelogs` as `pg` on `nfl_plays`.`esbid` = `pg`.`esbid` and `nfl_plays`.`off` = `pg`.`tm` where not `play_type` = 'NOPL' and `seas_type` = 'REG' and `trg_pid` is not null and `year` in (2023) group by `pg`.`pid` having trg_share_from_plays >= '25') select `player`.`pid`, `5a905dee3bafcd06e930b2c052d5d5e5a2abeef71a709c4b703a742060df2bdf`.`trg_share_from_plays` as `trg_share_from_plays_0`, `5a905dee3bafcd06e930b2c052d5d5e5a2abeef71a709c4b703a742060df2bdf`.`trg_share_from_plays` as `trg_share_from_plays_1`, player.fname, player.lname from `player` inner join `5a905dee3bafcd06e930b2c052d5d5e5a2abeef71a709c4b703a742060df2bdf` on `5a905dee3bafcd06e930b2c052d5d5e5a2abeef71a709c4b703a742060df2bdf`.`pid` = `player`.`pid` group by `player`.`pid`, `player`.`lname`, `player`.`fname` order by `trg_share_from_plays_0` IS NULL, `trg_share_from_plays_0` desc limit 500"
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
    const expected_query =
      "with `5a905dee3bafcd06e930b2c052d5d5e5a2abeef71a709c4b703a742060df2bdf` as (select `pg`.`pid`, ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) AS trg_share_from_plays from `nfl_plays` inner join `player_gamelogs` as `pg` on `nfl_plays`.`esbid` = `pg`.`esbid` and `nfl_plays`.`off` = `pg`.`tm` where not `play_type` = 'NOPL' and `seas_type` = 'REG' and `trg_pid` is not null and `year` in (2023) group by `pg`.`pid` having trg_share_from_plays >= '25'), `d06edb6e13e055a47deb317cceea360f4c046cc436b3c45f0c16dead01e72d61` as (select `pg`.`pid`, ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) AS trg_share_from_plays from `nfl_plays` inner join `player_gamelogs` as `pg` on `nfl_plays`.`esbid` = `pg`.`esbid` and `nfl_plays`.`off` = `pg`.`tm` where not `play_type` = 'NOPL' and `seas_type` = 'REG' and `trg_pid` is not null and `week` in (1, 2, 3) and `year` in (2022) group by `pg`.`pid`) select `player`.`pid`, `5a905dee3bafcd06e930b2c052d5d5e5a2abeef71a709c4b703a742060df2bdf`.`trg_share_from_plays` as `trg_share_from_plays_0`, player.fname, player.lname, `d06edb6e13e055a47deb317cceea360f4c046cc436b3c45f0c16dead01e72d61`.`trg_share_from_plays` as `trg_share_from_plays_1` from `player` inner join `5a905dee3bafcd06e930b2c052d5d5e5a2abeef71a709c4b703a742060df2bdf` on `5a905dee3bafcd06e930b2c052d5d5e5a2abeef71a709c4b703a742060df2bdf`.`pid` = `player`.`pid` left join `d06edb6e13e055a47deb317cceea360f4c046cc436b3c45f0c16dead01e72d61` on `d06edb6e13e055a47deb317cceea360f4c046cc436b3c45f0c16dead01e72d61`.`pid` = `player`.`pid` group by `player`.`pid`, `player`.`lname`, `player`.`fname` order by `trg_share_from_plays_0` IS NULL, `trg_share_from_plays_0` desc limit 500"
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
    const expected_query =
      "with `f93346a51cbad8531491c4e5538f42384366d8d153b66c5e26a6b4d62d58aa5d` as (select `pg`.`pid`, ROUND(100.0 * SUM(CASE WHEN nfl_plays.trg_pid = pg.pid THEN nfl_plays.dot ELSE 0 END) / SUM(nfl_plays.dot), 2) AS air_yds_share_from_plays from `nfl_plays` inner join `player_gamelogs` as `pg` on `nfl_plays`.`esbid` = `pg`.`esbid` and `nfl_plays`.`off` = `pg`.`tm` where not `play_type` = 'NOPL' and `seas_type` = 'REG' and `trg_pid` is not null and `year` in (2023) group by `pg`.`pid` having air_yds_share_from_plays >= '25') select `player`.`pid`, `f93346a51cbad8531491c4e5538f42384366d8d153b66c5e26a6b4d62d58aa5d`.`air_yds_share_from_plays` as `air_yds_share_from_plays_0`, player.fname, player.lname from `player` inner join `f93346a51cbad8531491c4e5538f42384366d8d153b66c5e26a6b4d62d58aa5d` on `f93346a51cbad8531491c4e5538f42384366d8d153b66c5e26a6b4d62d58aa5d`.`pid` = `player`.`pid` group by `player`.`pid`, `player`.`lname`, `player`.`fname` order by `air_yds_share_from_plays_0` IS NULL, `air_yds_share_from_plays_0` desc limit 500"
    expect(query.toString()).to.equal(expected_query)
  })
})
