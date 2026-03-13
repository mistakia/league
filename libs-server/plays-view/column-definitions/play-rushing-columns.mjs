import db from '#db'

function join_player_rusher({ query, join_state }) {
  if (!join_state.player_rusher) {
    query.leftJoin('player as rusher', 'nfl_plays.bc_pid', 'rusher.pid')
    join_state.player_rusher = true
  }
}

export default {
  play_rusher: {
    column_name: 'bc_pid',
    table_name: 'nfl_plays',
    join: join_player_rusher,
    main_select: () => [
      db.raw("rusher.fname || ' ' || rusher.lname as play_rusher"),
      'nfl_plays.bc_pid'
    ],
    main_where: () => "rusher.fname || ' ' || rusher.lname",
    aggregate_select: ({ params } = {}) =>
      db.raw("MAX(rusher.fname || ' ' || rusher.lname) as play_rusher"),
    player_group_by: 'player_rusher'
  },
  play_rusher_pid: {
    column_name: 'bc_pid',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.bc_pid as play_rusher_pid'],
    main_where: () => 'nfl_plays.bc_pid'
  },
  play_rush_yds: {
    column_name: 'rush_yds',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.rush_yds as play_rush_yds'],
    main_where: () => 'nfl_plays.rush_yds',
    aggregate_select: () => db.raw('SUM(nfl_plays.rush_yds) as play_rush_yds'),
    use_having: true
  },
  play_yards_after_contact: {
    column_name: 'yards_after_any_contact',
    table_name: 'nfl_plays',
    main_select: () => [
      'nfl_plays.yards_after_any_contact as play_yards_after_contact'
    ],
    main_where: () => 'nfl_plays.yards_after_any_contact',
    aggregate_select: () =>
      db.raw(
        'AVG(nfl_plays.yards_after_any_contact) as play_yards_after_contact'
      ),
    use_having: true
  },
  play_broken_tackles: {
    column_name: 'broken_tackles_rush',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.broken_tackles_rush as play_broken_tackles'],
    main_where: () => 'nfl_plays.broken_tackles_rush',
    aggregate_select: () =>
      db.raw('SUM(nfl_plays.broken_tackles_rush) as play_broken_tackles'),
    use_having: true
  },
  play_run_location: {
    column_name: 'run_location',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.run_location as play_run_location'],
    main_where: () => 'nfl_plays.run_location'
  },
  play_run_gap: {
    column_name: 'run_gap',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.run_gap as play_run_gap'],
    main_where: () => 'nfl_plays.run_gap'
  }
}
