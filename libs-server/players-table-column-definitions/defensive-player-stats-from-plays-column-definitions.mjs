import db from '#db'
import { nfl_plays_column_params } from '#libs-shared'
import get_table_hash from '#libs-server/get-table-hash.mjs'
import players_table_join_function from '#libs-server/players-table/players-table-join-function.mjs'
import { add_defensive_play_by_play_with_statement } from '#libs-server/players-table/add-defensive-play-by-play-with-statement.mjs'
import { get_rate_type_sql } from '#libs-server/players-table/select-string.mjs'

const defensive_player_table_alias = ({ pid_columns, params = {} } = {}) => {
  if (!pid_columns || !Array.isArray(pid_columns) || pid_columns.length === 0) {
    throw new Error('pid_columns must be a non-empty array')
  }

  const column_param_keys = Object.keys(nfl_plays_column_params).sort()
  const key = column_param_keys
    .map((key) => {
      const value = params[key]
      return Array.isArray(value)
        ? `${key}${value.sort().join('')}`
        : `${key}${value || ''}`
    })
    .join('')

  const pid_columns_string = pid_columns.sort().join('_')
  return get_table_hash(`defensive_player_stats_${pid_columns_string}_${key}`)
}

const defensive_player_join = (options) => {
  players_table_join_function({
    ...options,
    additional_conditions: function ({ table_name, params }) {
      if (params.pid_column) {
        this.andOn(
          `${table_name}.pid_column`,
          '=',
          db.raw('?', [params.pid_column])
        )
      }
    }
  })
}

const defensive_player_stat_from_plays = ({
  pid_columns,
  select_string,
  stat_name
}) => ({
  table_alias: ({ params }) =>
    defensive_player_table_alias({ pid_columns, params }),
  column_name: stat_name,
  with_select: () => [`${select_string} AS ${stat_name}`],
  with_where: ({ params }) => {
    // should be handled in main where
    if (params.rate_type && params.rate_type.length) {
      return null
    }

    return select_string
  },
  main_where: ({
    table_name,
    params,
    column_id,
    column_index,
    rate_type_column_mapping
  }) => {
    if (params.rate_type && params.rate_type.length) {
      const rate_type_table_name =
        rate_type_column_mapping[`${column_id}_${column_index}`]
      return get_rate_type_sql({
        table_name,
        column_name: stat_name,
        rate_type_table_name
      })
    }

    return null
  },
  join: defensive_player_join,
  pid_columns,
  supported_splits: ['year', 'week'],
  supported_rate_types: [
    'per_game',
    'per_team_def_play',
    'per_team_def_drive',
    'per_team_def_series'
  ],
  use_having: true,
  with: add_defensive_play_by_play_with_statement
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
