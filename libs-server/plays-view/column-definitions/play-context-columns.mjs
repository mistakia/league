function join_nfl_games({ query, join_state }) {
  if (!join_state.nfl_games) {
    query.leftJoin('nfl_games', 'nfl_plays.esbid', 'nfl_games.esbid')
    join_state.nfl_games = true
  }
}

export default {
  play_score_diff: {
    column_name: 'score_diff',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.score_diff as play_score_diff'],
    main_where: () => 'nfl_plays.score_diff'
  },
  play_home_score: {
    column_name: 'home_score',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.home_score as play_home_score'],
    main_where: () => 'nfl_plays.home_score'
  },
  play_away_score: {
    column_name: 'away_score',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.away_score as play_away_score'],
    main_where: () => 'nfl_plays.away_score'
  },
  play_sec_rem_half: {
    column_name: 'sec_rem_half',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.sec_rem_half as play_sec_rem_half'],
    main_where: () => 'nfl_plays.sec_rem_half'
  },
  play_sec_rem_gm: {
    column_name: 'sec_rem_gm',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.sec_rem_gm as play_sec_rem_gm'],
    main_where: () => 'nfl_plays.sec_rem_gm'
  },
  play_home_team: {
    column_name: 'h',
    table_name: 'nfl_games',
    join: join_nfl_games,
    main_select: () => ['nfl_games.h as play_home_team'],
    main_where: () => 'nfl_games.h'
  },
  play_away_team: {
    column_name: 'v',
    table_name: 'nfl_games',
    join: join_nfl_games,
    main_select: () => ['nfl_games.v as play_away_team'],
    main_where: () => 'nfl_games.v'
  },
  play_goal_to_go: {
    column_name: 'goal_to_go',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.goal_to_go as play_goal_to_go'],
    main_where: () => 'nfl_plays.goal_to_go'
  }
}
