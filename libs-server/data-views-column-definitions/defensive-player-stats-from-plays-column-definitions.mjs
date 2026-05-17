import db from '#db'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import { add_defensive_play_by_play_with_statement } from '#libs-server/data-views/add-defensive-play-by-play-with-statement.mjs'
import { get_rate_type_sql } from '#libs-server/data-views/select-string.mjs'
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

// Mirrors data_view_join_function (no flags) + the pid_column additional
// condition: pid equality always; year/week predicates emitted only when the
// bucket's splits projected those columns; pid_column predicate appended when
// params.pid_column is set. Year/week references prefer from-table-aware
// data_view_options so from-table-optimization resolves against the FROM-table
// aliases rather than the unjoined player_years identity CTE.
const apply_defensive_plays_join = ({
  query_context,
  params,
  table_alias,
  join_type,
  splits = []
}) => {
  const dv = query_context.data_view_options || {}
  const { players_query } = query_context
  const pid_reference = dv.pid_reference ?? query_context.pid_reference
  const year_reference = dv.year_reference ?? query_context.year_reference
  const week_reference = dv.week_reference ?? query_context.week_reference
  const year_offset_param = params.year_offset
  const year_offset_range = Array.isArray(year_offset_param)
    ? year_offset_param
    : [year_offset_param || 0, year_offset_param || 0]
  const min_year_offset = Math.min(...year_offset_range)
  const max_year_offset = Math.max(...year_offset_range)
  const join_method = join_type === 'INNER' ? 'innerJoin' : 'leftJoin'
  const join_year = splits.includes('year')
  const join_week = splits.includes('week')

  players_query[join_method](table_alias, function () {
    this.on(`${table_alias}.pid`, '=', pid_reference)

    if (join_year && year_reference) {
      if (min_year_offset !== 0 || max_year_offset !== 0) {
        if (min_year_offset === max_year_offset) {
          this.andOn(
            db.raw(`${table_alias}.year = ${year_reference} + ?`, [
              min_year_offset
            ])
          )
        } else {
          this.andOn(
            db.raw(
              `${table_alias}.year BETWEEN ${year_reference} + ? AND ${year_reference} + ?`,
              [min_year_offset, max_year_offset]
            )
          )
        }
      } else {
        const single_year_param_set =
          params.year &&
          (Array.isArray(params.year) ? params.year.length === 1 : true)
        if (single_year_param_set) {
          const specific_year = Array.isArray(params.year)
            ? params.year[0]
            : params.year
          this.andOn(`${table_alias}.year`, '=', db.raw('?', [specific_year]))
        } else {
          this.andOn(db.raw(`${table_alias}.year = ${year_reference}`))
          if (params.year) {
            const year_array = Array.isArray(params.year)
              ? params.year
              : [params.year]
            if (year_array.length > 0) {
              this.andOn(
                db.raw(`${table_alias}.year IN (${year_array.join(',')})`)
              )
            }
          }
        }
      }
    }

    if (join_week && week_reference) {
      this.andOn(db.raw(`${table_alias}.week = ${week_reference}`))
    }

    if (params.pid_column) {
      this.andOn(
        `${table_alias}.pid_column`,
        '=',
        db.raw('?', [params.pid_column])
      )
    }
  })
}

const defensive_plays_source = {
  grain: 'player_year',
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
  source: defensive_plays_source,
  pid_columns,
  // Retained during the parallel-path window: group_tables_by_supported_splits
  // buckets tables by `derive_supported_splits_from_granularity(granularity)`,
  // and the with-statement adds year/week columns to the CTE only when those
  // splits are routed through. Step 6 swaps to source.grain-driven walking.
  granularity: ['player_year', 'player_year_week'],
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
