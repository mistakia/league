import db from '#db'

export default {
  play_desc: {
    column_name: 'desc',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.desc as play_desc'],
    main_where: () => 'nfl_plays.desc'
  },
  play_type: {
    column_name: 'play_type',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.play_type'],
    main_where: () => 'nfl_plays.play_type',
    aggregate_select: () => db.raw('nfl_plays.play_type')
  },
  play_off_team: {
    column_name: 'pos_team',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.pos_team as play_off_team'],
    main_where: () => 'nfl_plays.pos_team',
    group_by_select: ({ group_by }) =>
      group_by === 'team' ? 'nfl_plays.pos_team as play_off_team' : null
  },
  play_def_team: {
    column_name: 'def',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.def as play_def_team'],
    main_where: () => 'nfl_plays.def'
  },
  play_down: {
    column_name: 'dwn',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.dwn as play_down'],
    main_where: () => 'nfl_plays.dwn'
  },
  play_yards_to_go: {
    column_name: 'yards_to_go',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.yards_to_go as play_yards_to_go'],
    main_where: () => 'nfl_plays.yards_to_go',
    aggregate_select: () =>
      db.raw('AVG(nfl_plays.yards_to_go) as play_yards_to_go'),
    use_having: true
  },
  play_ydl_100: {
    column_name: 'ydl_100',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.ydl_100 as play_ydl_100'],
    main_where: () => 'nfl_plays.ydl_100',
    aggregate_select: () => db.raw('AVG(nfl_plays.ydl_100) as play_ydl_100'),
    use_having: true
  },
  play_quarter: {
    column_name: 'qtr',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.qtr as play_quarter'],
    main_where: () => 'nfl_plays.qtr'
  },
  play_game_clock: {
    column_name: 'game_clock_start',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.game_clock_start as play_game_clock'],
    main_where: () => 'nfl_plays.game_clock_start'
  },
  play_sequence: {
    column_name: 'sequence',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.sequence as play_sequence'],
    main_where: () => 'nfl_plays.sequence'
  },
  play_year: {
    column_name: 'year',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.year as play_year'],
    main_where: () => 'nfl_plays.year'
  },
  play_week: {
    column_name: 'week',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.week as play_week'],
    main_where: () => 'nfl_plays.week'
  },
  play_game_id: {
    column_name: 'esbid',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.esbid as play_game_id'],
    main_where: () => 'nfl_plays.esbid'
  }
}
