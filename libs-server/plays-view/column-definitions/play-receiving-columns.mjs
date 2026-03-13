import db from '#db'

function join_player_target({ query, join_state }) {
  if (!join_state.player_target) {
    query.leftJoin('player as target', 'nfl_plays.trg_pid', 'target.pid')
    join_state.player_target = true
  }
}

export default {
  play_target: {
    column_name: 'trg_pid',
    table_name: 'nfl_plays',
    join: join_player_target,
    main_select: () => [
      db.raw("target.fname || ' ' || target.lname as play_target"),
      'nfl_plays.trg_pid'
    ],
    main_where: () => "target.fname || ' ' || target.lname",
    aggregate_select: ({ params } = {}) =>
      db.raw("MAX(target.fname || ' ' || target.lname) as play_target"),
    player_group_by: 'player_target'
  },
  play_target_pid: {
    column_name: 'trg_pid',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.trg_pid as play_target_pid'],
    main_where: () => 'nfl_plays.trg_pid'
  },
  play_recv_yds: {
    column_name: 'recv_yds',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.recv_yds as play_recv_yds'],
    main_where: () => 'nfl_plays.recv_yds',
    aggregate_select: () => db.raw('SUM(nfl_plays.recv_yds) as play_recv_yds'),
    use_having: true
  },
  play_yards_after_catch: {
    column_name: 'yards_after_catch',
    table_name: 'nfl_plays',
    main_select: () => [
      'nfl_plays.yards_after_catch as play_yards_after_catch'
    ],
    main_where: () => 'nfl_plays.yards_after_catch',
    aggregate_select: () =>
      db.raw('AVG(nfl_plays.yards_after_catch) as play_yards_after_catch'),
    use_having: true
  },
  play_route: {
    column_name: 'route',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.route as play_route'],
    main_where: () => 'nfl_plays.route'
  },
  play_contested_ball: {
    column_name: 'contested_ball',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.contested_ball as play_contested_ball'],
    main_where: () => 'nfl_plays.contested_ball',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.contested_ball = true THEN 1 ELSE 0 END) as play_contested_ball'
      ),
    use_having: true
  },
  play_catchable_ball: {
    column_name: 'catchable_ball',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.catchable_ball as play_catchable_ball'],
    main_where: () => 'nfl_plays.catchable_ball',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.catchable_ball = true THEN 1 ELSE 0 END) as play_catchable_ball'
      ),
    use_having: true
  },
  play_endzone_target: {
    column_name: 'endzone_target',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.endzone_target as play_endzone_target'],
    main_where: () => 'nfl_plays.endzone_target',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.endzone_target = true THEN 1 ELSE 0 END) as play_endzone_target'
      ),
    use_having: true
  }
}
