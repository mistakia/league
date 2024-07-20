import db from '#db'
import { nfl_plays_column_params } from '#libs-shared'
import get_table_hash from '#libs-server/get-table-hash.mjs'
import get_join_func from '#libs-server/get-join-func.mjs'

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

const defensive_player_join = ({
  query,
  table_name,
  join_type = 'LEFT',
  splits = [],
  previous_table_name = null,
  params = {}
}) => {
  const join_func = get_join_func(join_type)
  let year_offset = params.year_offset || 0
  if (Array.isArray(year_offset)) {
    year_offset = year_offset[0]
  }

  if (splits.length && previous_table_name) {
    query[join_func](table_name, function () {
      this.on(`${table_name}.pid`, '=', 'player.pid')
      for (const split of splits) {
        if (split === 'year' && year_offset !== 0) {
          this.andOn(
            db.raw(
              `${table_name}.${split} = ${previous_table_name}.${split} + ${year_offset}`
            )
          )
        } else {
          this.andOn(
            `${table_name}.${split}`,
            '=',
            `${previous_table_name}.${split}`
          )
        }
      }
      // Add condition for pid_column to ensure we're joining the correct defensive stat
      this.andOn(
        `${table_name}.pid_column`,
        '=',
        db.raw('?', [params.pid_column])
      )
    })
  } else {
    query[join_func](table_name, function () {
      this.on(`${table_name}.pid`, '=', 'player.pid')
      if (splits.includes('year') && params.year) {
        const year_array = Array.isArray(params.year)
          ? params.year
          : [params.year]
        this.andOn(
          db.raw(
            `${table_name}.year IN (${year_array.map((y) => y + year_offset).join(',')})`
          )
        )
      }
    })
  }
}

const defensive_player_stat_from_plays = ({
  pid_columns,
  select_string,
  stat_name
}) => ({
  table_alias: ({ params }) =>
    defensive_player_table_alias({ pid_columns, params }),
  column_name: stat_name,
  select: () => [`${select_string} AS ${stat_name}_0`],
  where_column: () => select_string,
  join: defensive_player_join,
  pid_columns,
  supported_splits: ['year'],
  supported_rate_types: ['per_game'],
  use_having: true,
  use_defensive_play_by_play_with: true
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
