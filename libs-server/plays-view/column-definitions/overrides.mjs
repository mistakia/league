import db from '#db'
import { nfl_pro_film_url_sql } from '#libs-server/plays-view/nfl-pro-film-url.mjs'

// Partial server definitions merged OVER the mechanically derived ones in
// index.mjs. A column appears here only for what it cannot derive -- a real SQL
// expression, a join, a grouping rule. Everything a column does not state is
// still derived from its table and column in the shared declaration.
//
// The declaration marks each column whose SQL lands here with `sql_override`,
// and index.mjs asserts the two agree, so this map and that flag cannot drift.

const join_nfl_games = ({ query, join_state }) => {
  if (!join_state.nfl_games) {
    query.leftJoin('nfl_games', 'nfl_plays.esbid', 'nfl_games.esbid')
    join_state.nfl_games = true
  }
}

function join_player_passer({ query, join_state }) {
  if (!join_state.player_passer) {
    query.leftJoin('player as passer', 'nfl_plays.passer_pid', 'passer.pid')
    join_state.player_passer = true
  }
}

function join_player_rusher({ query, join_state }) {
  if (!join_state.player_rusher) {
    query.leftJoin(
      'player as rusher',
      'nfl_plays.ball_carrier_pid',
      'rusher.pid'
    )
    join_state.player_rusher = true
  }
}

function join_player_target({ query, join_state }) {
  if (!join_state.player_target) {
    query.leftJoin('player as target', 'nfl_plays.target_pid', 'target.pid')
    join_state.player_target = true
  }
}

// Held as strings rather than built per call site because each has to appear
// identically in three places -- the select, the WHERE expression and the sort
// expression. A select and a filter that disagree on the fallback would filter
// on one value and display another, with no error to notice.
const CANONICAL_COVERAGE_TYPE = `COALESCE(nfl_plays.coverage_type::text, CASE WHEN nfl_plays.coverage_type_ngs = '2_MAN' THEN 'COVER_2_MAN' ELSE nfl_plays.coverage_type_ngs END)`

const COVERAGE_SOURCE = `CASE WHEN nfl_plays.coverage_type IS NOT NULL THEN 'charted' WHEN nfl_plays.coverage_type_ngs IS NOT NULL THEN 'next_gen_stats' END`

const CANONICAL_MAN_ZONE = `CASE nfl_plays.man_zone WHEN 'MAN' THEN 'MAN_COVERAGE' WHEN 'ZONE' THEN 'ZONE_COVERAGE' ELSE nfl_plays.man_zone END`

// A player name is a concatenation across a join, so it selects TWO fragments:
// the name for display and the underlying pid, which the group-by path needs.
const player_name = ({ alias, table, pid_column, join, player_group_by }) => ({
  join,
  main_select: () => [
    db.raw(`${table}.first_name || ' ' || ${table}.last_name as ${alias}`),
    `nfl_plays.${pid_column}`
  ],
  main_where: () => `${table}.first_name || ' ' || ${table}.last_name`,
  aggregate_select: () =>
    db.raw(`MAX(${table}.first_name || ' ' || ${table}.last_name) as ${alias}`),
  player_group_by
})

export default {
  // Timestamps emit through db.raw rather than as plain strings, which knex
  // would quote. The two forms are equivalent to Postgres; the raw one is kept
  // so the collapse moved no SQL. Nothing depends on the bare spelling.
  play_timestamp: {
    main_select: () => [db.raw('nfl_plays.play_time_of_day as play_timestamp')]
  },
  play_game_timestamp: {
    sort_column_name: 'nfl_games.kickoff_at',
    main_select: () => [db.raw('nfl_games.kickoff_at as play_game_timestamp')],
    join: join_nfl_games
  },

  // Derived, so there is no column to filter on -- omitting main_where is what
  // keeps it out of the filter UI. Sorting works because the expression is
  // reused verbatim as the sort column.
  play_film_url: {
    main_select: () => [nfl_pro_film_url_sql({ alias: 'play_film_url' })],
    sort_column_name: nfl_pro_film_url_sql()
  },

  play_off_team: {
    group_by_select: ({ group_by }) =>
      group_by === 'team'
        ? 'nfl_plays.possession_nfl_team as play_off_team'
        : null
  },

  play_home_team: { join: join_nfl_games },
  play_away_team: { join: join_nfl_games },

  play_passer: player_name({
    alias: 'play_passer',
    table: 'passer',
    pid_column: 'passer_pid',
    join: join_player_passer,
    player_group_by: 'player_passer'
  }),
  play_rusher: player_name({
    alias: 'play_rusher',
    table: 'rusher',
    pid_column: 'ball_carrier_pid',
    join: join_player_rusher,
    player_group_by: 'player_rusher'
  }),
  play_target: player_name({
    alias: 'play_target',
    table: 'target',
    pid_column: 'target_pid',
    join: join_player_target,
    player_group_by: 'player_target'
  }),

  play_coverage_type: {
    sort_column_name: CANONICAL_COVERAGE_TYPE,
    main_select: () => [
      db.raw(`${CANONICAL_COVERAGE_TYPE} as play_coverage_type`)
    ],
    main_where: () => CANONICAL_COVERAGE_TYPE
  },
  play_coverage_source: {
    sort_column_name: COVERAGE_SOURCE,
    main_select: () => [db.raw(`${COVERAGE_SOURCE} as play_coverage_source`)],
    main_where: () => COVERAGE_SOURCE
  },
  play_man_zone: {
    sort_column_name: CANONICAL_MAN_ZONE,
    main_select: () => [db.raw(`${CANONICAL_MAN_ZONE} as play_man_zone`)],
    main_where: () => CANONICAL_MAN_ZONE
  }
}
