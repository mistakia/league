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
    const expected_query =
      "with `2a75baacf96d2681b567e3bb61d0ea94fc46b9d94290ca11aa679cf35cdece17` as (select `trg_pid`, COUNT(*) AS trg_from_plays_0 from `nfl_plays` where not `play_type` = 'NOPL' and `seas_type` = 'REG' and `dwn` in (3) and `year` in (2023) group by `trg_pid` having trg_from_plays_0 >= '15'), `e9290825ef915b8776a391455230feab7b6cf7a607062b12529dbd65e0cf542f` as (select `pg`.`pid`, ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) AS trg_share_from_plays from `nfl_plays` inner join `player_gamelogs` as `pg` on `nfl_plays`.`esbid` = `pg`.`esbid` and `nfl_plays`.`off` = `pg`.`tm` where not `play_type` = 'NOPL' and `seas_type` = 'REG' and `trg_pid` is not null and `dwn` in (3) and `year` in (2023) group by `pg`.`pid`), `db60da4fe342316de8c189603bb657c844ffad9b69a6ca1df4a1316276efd8c3` as (select `pg`.`pid`, ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2) AS trg_share_from_plays from `nfl_plays` inner join `player_gamelogs` as `pg` on `nfl_plays`.`esbid` = `pg`.`esbid` and `nfl_plays`.`off` = `pg`.`tm` where not `play_type` = 'NOPL' and `seas_type` = 'REG' and `trg_pid` is not null and `qtr` in (1, 2) and `year` in (2023) group by `pg`.`pid`) select `player`.`pid`, `2a75baacf96d2681b567e3bb61d0ea94fc46b9d94290ca11aa679cf35cdece17`.`trg_from_plays_0` as `trg_from_plays_0`, player.fname, player.lname, `e9290825ef915b8776a391455230feab7b6cf7a607062b12529dbd65e0cf542f`.`trg_share_from_plays` as `trg_share_from_plays_0`, `db60da4fe342316de8c189603bb657c844ffad9b69a6ca1df4a1316276efd8c3`.`trg_share_from_plays` as `trg_share_from_plays_1` from `player` inner join `2a75baacf96d2681b567e3bb61d0ea94fc46b9d94290ca11aa679cf35cdece17` on `2a75baacf96d2681b567e3bb61d0ea94fc46b9d94290ca11aa679cf35cdece17`.`trg_pid` = `player`.`pid` left join `e9290825ef915b8776a391455230feab7b6cf7a607062b12529dbd65e0cf542f` on `e9290825ef915b8776a391455230feab7b6cf7a607062b12529dbd65e0cf542f`.`pid` = `player`.`pid` left join `db60da4fe342316de8c189603bb657c844ffad9b69a6ca1df4a1316276efd8c3` on `db60da4fe342316de8c189603bb657c844ffad9b69a6ca1df4a1316276efd8c3`.`pid` = `player`.`pid` group by `player`.`pid`, `player`.`lname`, `player`.`fname` order by `trg_share_from_plays_0` IS NULL, `trg_share_from_plays_0` desc limit 500"
    expect(query.toString()).to.equal(expected_query)
  })

  it('should handle value not set for where query', () => {
    const query = get_players_table_view_results({
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
    const expected_query = "with `c5442931a55d383a8f71861ed6d6d533f67cf2141870db429f258afa8609085e` as (select `pg`.`pid`, ROUND((1.5 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*)) + (0.7 * SUM(CASE WHEN nfl_plays.trg_pid = pg.pid THEN nfl_plays.dot ELSE 0 END) / SUM(nfl_plays.dot)), 2) AS weighted_opp_rating_from_plays from `nfl_plays` inner join `player_gamelogs` as `pg` on `nfl_plays`.`esbid` = `pg`.`esbid` and `nfl_plays`.`off` = `pg`.`tm` where not `play_type` = 'NOPL' and `seas_type` = 'REG' and `trg_pid` is not null and `year` in (2023) group by `pg`.`pid`) select `player`.`pid`, player.fname, player.lname, `player`.`bench` as `bench_0`, `player`.`pos` as `pos_0`, `c5442931a55d383a8f71861ed6d6d533f67cf2141870db429f258afa8609085e`.`weighted_opp_rating_from_plays` as `weighted_opp_rating_from_plays_0` from `player` left join `c5442931a55d383a8f71861ed6d6d533f67cf2141870db429f258afa8609085e` on `c5442931a55d383a8f71861ed6d6d533f67cf2141870db429f258afa8609085e`.`pid` = `player`.`pid` where player.pos IN ('WR') group by `player`.`pid`, `player`.`lname`, `player`.`fname` order by `weighted_opp_rating_from_plays_0` IS NULL, `weighted_opp_rating_from_plays_0` desc limit 500"
    expect(query.toString()).to.equal(expected_query)
  })
})
