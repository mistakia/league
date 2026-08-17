import db from '#db'

function join_player_passer({ query, join_state }) {
  if (!join_state.player_passer) {
    query.leftJoin('player as passer', 'nfl_plays.passer_pid', 'passer.pid')
    join_state.player_passer = true
  }
}

export default {
  play_passer: {
    column_name: 'passer_pid',
    table_name: 'nfl_plays',
    join: join_player_passer,
    main_select: () => [
      db.raw("passer.first_name || ' ' || passer.last_name as play_passer"),
      'nfl_plays.passer_pid'
    ],
    main_where: () => "passer.first_name || ' ' || passer.last_name",
    aggregate_select: ({ params } = {}) =>
      db.raw(
        "MAX(passer.first_name || ' ' || passer.last_name) as play_passer"
      ),
    player_group_by: 'player_passer'
  },
  play_passer_pid: {
    column_name: 'passer_pid',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.passer_pid as play_passer_pid'],
    main_where: () => 'nfl_plays.passer_pid'
  },
  play_pass_yds: {
    column_name: 'pass_yards',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.pass_yards as play_pass_yds'],
    main_where: () => 'nfl_plays.pass_yards',
    aggregate_select: () =>
      db.raw('SUM(nfl_plays.pass_yards) as play_pass_yds'),
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
    column_name: 'is_completion',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.is_completion as play_comp'],
    main_where: () => 'nfl_plays.is_completion',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.is_completion = true THEN 1 ELSE 0 END) as play_comp'
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
    column_name: 'depth_of_target',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.depth_of_target as play_dot'],
    main_where: () => 'nfl_plays.depth_of_target',
    aggregate_select: () =>
      db.raw('AVG(nfl_plays.depth_of_target) as play_dot'),
    use_having: true
  },
  play_highlight_pass: {
    column_name: 'is_highlight_pass',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.is_highlight_pass as play_highlight_pass'],
    main_where: () => 'nfl_plays.is_highlight_pass',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.is_highlight_pass = true THEN 1 ELSE 0 END) as play_highlight_pass'
      ),
    use_having: true
  },
  play_int_worthy: {
    column_name: 'is_interception_worthy',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.is_interception_worthy as play_int_worthy'],
    main_where: () => 'nfl_plays.is_interception_worthy',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.is_interception_worthy = true THEN 1 ELSE 0 END) as play_int_worthy'
      ),
    use_having: true
  },
  play_dropped_pass: {
    column_name: 'is_dropped_pass',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.is_dropped_pass as play_dropped_pass'],
    main_where: () => 'nfl_plays.is_dropped_pass',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.is_dropped_pass = true THEN 1 ELSE 0 END) as play_dropped_pass'
      ),
    use_having: true
  },
  play_qb_pressure: {
    column_name: 'is_qb_pressure',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.is_qb_pressure as play_qb_pressure'],
    main_where: () => 'nfl_plays.is_qb_pressure',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.is_qb_pressure = true THEN 1 ELSE 0 END) as play_qb_pressure'
      ),
    use_having: true
  },
  play_qb_hit: {
    column_name: 'is_qb_hit',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.is_qb_hit as play_qb_hit'],
    main_where: () => 'nfl_plays.is_qb_hit',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.is_qb_hit = true THEN 1 ELSE 0 END) as play_qb_hit'
      ),
    use_having: true
  },
  play_sk: {
    column_name: 'is_sack',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.is_sack as play_sk'],
    main_where: () => 'nfl_plays.is_sack',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.is_sack = true THEN 1 ELSE 0 END) as play_sk'
      ),
    use_having: true
  }
}
