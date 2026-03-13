import db from '#db'

function join_player_passer({ query, join_state }) {
  if (!join_state.player_passer) {
    query.leftJoin('player as passer', 'nfl_plays.psr_pid', 'passer.pid')
    join_state.player_passer = true
  }
}

export default {
  play_passer: {
    column_name: 'psr_pid',
    table_name: 'nfl_plays',
    join: join_player_passer,
    main_select: () => [
      db.raw("passer.fname || ' ' || passer.lname as play_passer"),
      'nfl_plays.psr_pid'
    ],
    main_where: () => "passer.fname || ' ' || passer.lname",
    aggregate_select: ({ params } = {}) =>
      db.raw("MAX(passer.fname || ' ' || passer.lname) as play_passer"),
    player_group_by: 'player_passer'
  },
  play_passer_pid: {
    column_name: 'psr_pid',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.psr_pid as play_passer_pid'],
    main_where: () => 'nfl_plays.psr_pid'
  },
  play_pass_yds: {
    column_name: 'pass_yds',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.pass_yds as play_pass_yds'],
    main_where: () => 'nfl_plays.pass_yds',
    aggregate_select: () => db.raw('SUM(nfl_plays.pass_yds) as play_pass_yds'),
    use_having: true
  },
  play_air_yards: {
    column_name: 'air_yards',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.air_yards as play_air_yards'],
    main_where: () => 'nfl_plays.air_yards',
    aggregate_select: () =>
      db.raw('AVG(nfl_plays.air_yards) as play_air_yards'),
    use_having: true
  },
  play_true_air_yards: {
    column_name: 'true_air_yards',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.true_air_yards as play_true_air_yards'],
    main_where: () => 'nfl_plays.true_air_yards',
    aggregate_select: () =>
      db.raw('AVG(nfl_plays.true_air_yards) as play_true_air_yards'),
    use_having: true
  },
  play_comp: {
    column_name: 'comp',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.comp as play_comp'],
    main_where: () => 'nfl_plays.comp',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.comp = true THEN 1 ELSE 0 END) as play_comp'
      ),
    use_having: true
  },
  play_time_to_throw: {
    column_name: 'time_to_throw',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.time_to_throw as play_time_to_throw'],
    main_where: () => 'nfl_plays.time_to_throw',
    aggregate_select: () =>
      db.raw('AVG(nfl_plays.time_to_throw) as play_time_to_throw'),
    use_having: true
  },
  play_dot: {
    column_name: 'dot',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.dot as play_dot'],
    main_where: () => 'nfl_plays.dot',
    aggregate_select: () => db.raw('AVG(nfl_plays.dot) as play_dot'),
    use_having: true
  },
  play_highlight_pass: {
    column_name: 'highlight_pass',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.highlight_pass as play_highlight_pass'],
    main_where: () => 'nfl_plays.highlight_pass',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.highlight_pass = true THEN 1 ELSE 0 END) as play_highlight_pass'
      ),
    use_having: true
  },
  play_int_worthy: {
    column_name: 'int_worthy',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.int_worthy as play_int_worthy'],
    main_where: () => 'nfl_plays.int_worthy',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.int_worthy = true THEN 1 ELSE 0 END) as play_int_worthy'
      ),
    use_having: true
  },
  play_dropped_pass: {
    column_name: 'dropped_pass',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.dropped_pass as play_dropped_pass'],
    main_where: () => 'nfl_plays.dropped_pass',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.dropped_pass = true THEN 1 ELSE 0 END) as play_dropped_pass'
      ),
    use_having: true
  },
  play_qb_pressure: {
    column_name: 'qb_pressure',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.qb_pressure as play_qb_pressure'],
    main_where: () => 'nfl_plays.qb_pressure',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.qb_pressure = true THEN 1 ELSE 0 END) as play_qb_pressure'
      ),
    use_having: true
  },
  play_qb_hit: {
    column_name: 'qb_hit',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.qb_hit as play_qb_hit'],
    main_where: () => 'nfl_plays.qb_hit',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.qb_hit = true THEN 1 ELSE 0 END) as play_qb_hit'
      ),
    use_having: true
  },
  play_sk: {
    column_name: 'sk',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.sk as play_sk'],
    main_where: () => 'nfl_plays.sk',
    aggregate_select: () =>
      db.raw('SUM(CASE WHEN nfl_plays.sk = true THEN 1 ELSE 0 END) as play_sk'),
    use_having: true
  }
}
