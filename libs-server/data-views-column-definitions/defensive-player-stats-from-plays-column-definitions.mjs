import db from '#db'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import { add_defensive_play_by_play_with_statement } from '#libs-server/data-views/add-defensive-play-by-play-with-statement.mjs'
import { apply_plays_join } from '#libs-server/data-views/source-attach/apply-plays-join.mjs'
import { get_cache_info_for_fields_from_plays } from '#libs-server/data-views/get-cache-info-for-fields-from-plays.mjs'
import get_stats_column_param_key from '#libs-server/data-views/get-stats-column-param-key.mjs'

const defensive_player_table_alias = ({ pid_columns, params = {} } = {}) => {
  if (!pid_columns || !Array.isArray(pid_columns) || pid_columns.length === 0) {
    throw new Error('pid_columns must be a non-empty array')
  }

  const key = get_stats_column_param_key({ params })
  const pid_columns_string = pid_columns.sort().join('_')
  return get_table_hash(`defensive_player_stats_${pid_columns_string}_${key}`)
}

const apply_defensive_plays_join = (args) =>
  apply_plays_join({
    ...args,
    extra_conditions({ table_alias, params }) {
      if (params.pid_column) {
        this.andOn(
          `${table_alias}.pid_column`,
          '=',
          db.raw('?', [params.pid_column])
        )
      }
    }
  })

const defensive_plays_source = {
  grain: 'player_year',
  // `with` builder (add_defensive_play_by_play_with_statement) projects week
  // onto the CTE under week row_axes. Declare supports_row_axes so the dispatcher
  // forwards week to with_func instead of stripping it via the grain's
  // ['year'] intersection.
  supports_row_axes: ['year', 'week'],
  attach: apply_defensive_plays_join
}

// Output-aggregator retrofit: each `pid_column` contributes 1 to the count
// (the `pid_column` virtual column doesn't exist in nfl_plays; we synthesize
// it per role). The legacy `select_string` form aggregates over the WITH
// CTE's synthetic pid_column rows; the role_union path produces equivalent
// counts per period.
const defensive_role_attributions = ({ pid_columns }) =>
  pid_columns.map((pid_column) => ({
    pid_column,
    measure_expr: '1'
  }))

const defensive_player_stat_from_plays = ({
  pid_columns,
  select_string,
  stat_name
}) => ({
  table_alias: ({ params }) =>
    defensive_player_table_alias({ pid_columns, params }),
  column_name: stat_name,
  measure_source: 'plays_role_union',
  role_attributions: () => defensive_role_attributions({ pid_columns }),
  supports_output: {
    periods: [
      'game',
      'season',
      'team_play',
      'team_pass_play',
      'team_rush_play',
      'team_half',
      'team_quarter',
      'team_drive',
      'team_series',
      'player_play',
      'player_pass_play',
      'player_rush_play'
    ],
    aggregations: ['rate', 'count']
  },
  with_select: () => [`${select_string} AS ${stat_name}`],
  with_where: () => select_string,
  main_where: () => null,
  source: defensive_plays_source,
  pid_columns,
  supported_rate_types: [
    'per_game',
    'per_team_half',
    'per_team_quarter',
    'per_team_play',
    'per_team_pass_play',
    'per_team_rush_play',
    'per_team_drive',
    'per_team_series',

    'per_player_play',
    'per_player_pass_play',
    'per_player_rush_play'
  ],
  use_having: true,
  with: add_defensive_play_by_play_with_statement,
  get_cache_info: get_cache_info_for_fields_from_plays,
  team_unit: 'def'
})

export default {
  player_solo_tackles_from_plays: defensive_player_stat_from_plays({
    pid_columns: [
      'solo_tackle_1_pid',
      'solo_tackle_2_pid',
      'solo_tackle_3_pid'
    ],
    select_string: `SUM(CASE WHEN pid_column = 'solo_tackle_1_pid' THEN 1 WHEN pid_column = 'solo_tackle_2_pid' THEN 1 WHEN pid_column = 'solo_tackle_3_pid' THEN 1 ELSE 0 END)`,
    stat_name: 'solo_tackles_from_plays'
  }),
  player_tackle_assists_from_plays: defensive_player_stat_from_plays({
    pid_columns: [
      'tackle_assist_1_pid',
      'tackle_assist_2_pid',
      'tackle_assist_3_pid',
      'tackle_assist_4_pid'
    ],
    select_string: `SUM(CASE WHEN pid_column = 'tackle_assist_1_pid' THEN 1 WHEN pid_column = 'tackle_assist_2_pid' THEN 1 WHEN pid_column = 'tackle_assist_3_pid' THEN 1 WHEN pid_column = 'tackle_assist_4_pid' THEN 1 ELSE 0 END)`,
    stat_name: 'tackle_assists_from_plays'
  }),
  player_combined_tackles_from_plays: defensive_player_stat_from_plays({
    pid_columns: [
      'solo_tackle_1_pid',
      'solo_tackle_2_pid',
      'solo_tackle_3_pid',
      'assisted_tackle_1_pid',
      'assisted_tackle_2_pid',
      'tackle_assist_1_pid',
      'tackle_assist_2_pid',
      'tackle_assist_3_pid'
    ],
    select_string: `SUM(CASE WHEN pid_column = 'solo_tackle_1_pid' THEN 1 WHEN pid_column = 'solo_tackle_2_pid' THEN 1 WHEN pid_column = 'solo_tackle_3_pid' THEN 1 WHEN pid_column = 'assisted_tackle_1_pid' THEN 1 WHEN pid_column = 'assisted_tackle_2_pid' THEN 1 WHEN pid_column = 'tackle_assist_1_pid' THEN 1 WHEN pid_column = 'tackle_assist_2_pid' THEN 1 WHEN pid_column = 'tackle_assist_3_pid' THEN 1 ELSE 0 END)`,
    stat_name: 'combined_tackles_from_plays'
  })
}
