import db from '#db'
import { nfl_pro_film_url_sql } from '#libs-server/plays-view/nfl-pro-film-url.mjs'

const join_nfl_games = ({ query, join_state }) => {
  if (!join_state.nfl_games) {
    query.leftJoin('nfl_games', 'nfl_plays.esbid', 'nfl_games.esbid')
    join_state.nfl_games = true
  }
}

export default {
  play_esbid: {
    column_name: 'esbid',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.esbid as play_esbid'],
    main_where: () => 'nfl_plays.esbid'
  },
  play_timestamp: {
    column_name: 'play_time_of_day',
    table_name: 'nfl_plays',
    main_select: () => [db.raw('nfl_plays.play_time_of_day as play_timestamp')],
    main_where: () => 'nfl_plays.play_time_of_day'
  },
  play_game_timestamp: {
    column_name: 'kickoff_at',
    table_name: 'nfl_games',
    sort_column_name: 'nfl_games.kickoff_at',
    main_select: () => [db.raw('nfl_games.kickoff_at as play_game_timestamp')],
    main_where: () => 'nfl_games.kickoff_at',
    join: join_nfl_games
  },
  play_desc: {
    column_name: 'play_description',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.play_description as play_desc'],
    main_where: () => 'nfl_plays.play_description'
  },
  play_type: {
    column_name: 'play_type',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.play_type'],
    main_where: () => 'nfl_plays.play_type',
    aggregate_select: () => db.raw('nfl_plays.play_type')
  },
  play_off_team: {
    column_name: 'possession_nfl_team',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.possession_nfl_team as play_off_team'],
    main_where: () => 'nfl_plays.possession_nfl_team',
    group_by_select: ({ group_by }) =>
      group_by === 'team'
        ? 'nfl_plays.possession_nfl_team as play_off_team'
        : null
  },
  play_def_team: {
    column_name: 'defense_nfl_team',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.defense_nfl_team as play_def_team'],
    main_where: () => 'nfl_plays.defense_nfl_team'
  },
  play_down: {
    column_name: 'down_number',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.down_number as play_down'],
    main_where: () => 'nfl_plays.down_number'
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
    column_name: 'yard_line_100',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.yard_line_100 as play_ydl_100'],
    main_where: () => 'nfl_plays.yard_line_100',
    aggregate_select: () =>
      db.raw('AVG(nfl_plays.yard_line_100) as play_ydl_100'),
    use_having: true
  },
  play_quarter: {
    column_name: 'quarter',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.quarter as play_quarter'],
    main_where: () => 'nfl_plays.quarter'
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
    column_name: 'season_year',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.season_year as play_year'],
    main_where: () => 'nfl_plays.season_year'
  },
  // Load-bearing rather than decorative. A request that names its own years
  // gets exactly the seasons it named and no implicit season type, so any view
  // scoping its own years must filter this column too or it mixes preseason
  // and postseason into what reads as a regular-season table. The regular
  // season is applied by default only to a request that names no season scope
  // at all -- see apply_default_season_scope in get-plays-view-results.mjs.
  play_seas_type: {
    column_name: 'season_type',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.season_type as play_seas_type'],
    main_where: () => 'nfl_plays.season_type'
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
  },
  // Derived, so there is no column to filter on -- omitting main_where is what
  // keeps it out of the filter UI. Sorting works because the expression is
  // reused verbatim as the sort column.
  play_film_url: {
    main_select: () => [nfl_pro_film_url_sql({ alias: 'play_film_url' })],
    sort_column_name: nfl_pro_film_url_sql()
  }
}
