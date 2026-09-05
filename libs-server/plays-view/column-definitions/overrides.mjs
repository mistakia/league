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

// One left join per player ROLE, added at most once per query. The role is
// both the SQL table alias and the join_state key, so a role can never be
// joined twice and two columns reading the same role share one join.
//
// `player_key` is the PLAYER-side column the play's identifier matches. It is
// `pid` for every role whose play-side column is a pid, and `gsis_player_id`
// for the one role whose play-side column is a GSIS id instead. Defaulting it
// keeps the pid roles reading exactly as before.
const join_player =
  ({ role, pid_column, player_key = 'pid' }) =>
  ({ query, join_state }) => {
    if (join_state[role]) return
    query.leftJoin(
      `player as ${role}`,
      `nfl_plays.${pid_column}`,
      `${role}.${player_key}`
    )
    join_state[role] = true
  }

// The film link reads four tables, and it reads them from the SELECT list and
// from ORDER BY alike, so all four joins have to be present on either path.
//
// The three player roles are prefixed `film_` and keyed on the play's GSIS id
// rather than reusing the `passer`/`target`/`rusher` roles above, which are
// keyed on the pid columns. That is not duplication to collapse: the two id
// paths resolve to a different gsis_it_player_id on roughly half a percent of
// plays, and it is the GSIS path the film-room filters were measured against.
const join_play_film_url = (context) => {
  join_nfl_games(context)
  for (const [role, pid_column] of [
    ['film_passer', 'passer_gsis_player_id'],
    ['film_target', 'target_gsis_player_id'],
    ['film_rusher', 'ball_carrier_gsis_player_id']
  ]) {
    join_player({ role, pid_column, player_key: 'gsis_player_id' })(context)
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
// the name for display and the underlying pid, which the group-by path needs
// and which is also the only stable identity -- two players share a name.
//
// `player_group_by` is set only for the three roles the group-by enum knows
// about; it is read behind a truthiness check, so the defensive roles leaving
// it undefined is the correct way to say "not a grouping target".
const player_name = ({
  alias,
  role,
  pid_column,
  player_group_by,
  player_key
}) => ({
  join: join_player({ role, pid_column, player_key }),
  main_select: () => [
    db.raw(`${role}.first_name || ' ' || ${role}.last_name as ${alias}`),
    `nfl_plays.${pid_column}`
  ],
  main_where: () => `${role}.first_name || ' ' || ${role}.last_name`,
  aggregate_select: () =>
    db.raw(`MAX(${role}.first_name || ' ' || ${role}.last_name) as ${alias}`),
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
    sort_column_name: nfl_pro_film_url_sql(),
    join: join_play_film_url
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
    role: 'passer',
    pid_column: 'passer_pid',
    player_group_by: 'player_passer'
  }),
  play_rusher: player_name({
    alias: 'play_rusher',
    role: 'rusher',
    pid_column: 'ball_carrier_pid',
    player_group_by: 'player_rusher'
  }),
  play_target: player_name({
    alias: 'play_target',
    role: 'target',
    pid_column: 'target_pid',
    player_group_by: 'player_target'
  }),

  play_interceptor: player_name({
    alias: 'play_interceptor',
    role: 'interceptor',
    pid_column: 'interceptor_pid'
  }),
  play_sacker: player_name({
    alias: 'play_sacker',
    role: 'sacker',
    pid_column: 'sack_player_1_pid'
  }),
  play_solo_tackler: player_name({
    alias: 'play_solo_tackler',
    role: 'solo_tackler',
    pid_column: 'solo_tackle_1_pid'
  }),
  play_assist_tackler: player_name({
    alias: 'play_assist_tackler',
    role: 'assist_tackler',
    pid_column: 'tackle_assist_1_pid'
  }),
  play_penalty_player: player_name({
    alias: 'play_penalty_player',
    role: 'penalty_player',
    pid_column: 'penalty_player_pid'
  }),
  play_fumble_lost_by: player_name({
    alias: 'play_fumble_lost_by',
    role: 'fumble_lost_by',
    pid_column: 'fumble_lost_pid'
  }),
  // The one role whose play-side identifier is a GSIS id rather than a pid, so
  // it matches player.gsis_player_id instead of player.pid. Everything else
  // about it is the same shape as the roles above.
  play_targeted_defender: player_name({
    alias: 'play_targeted_defender',
    role: 'targeted_defender',
    pid_column: 'targeted_defender_gsis',
    player_key: 'gsis_player_id'
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
