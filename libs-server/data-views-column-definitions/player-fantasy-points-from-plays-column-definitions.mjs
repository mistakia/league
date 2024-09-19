import db from '#db'
import { nfl_plays_column_params, data_views_constants } from '#libs-shared'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import apply_play_by_play_column_params_to_query from '../apply-play-by-play-column-params-to-query.mjs'
import data_view_join_function from '#libs-server/data-views/data-view-join-function.mjs'
import { get_rate_type_sql } from '#libs-server/data-views/select-string.mjs'
import { get_cache_info_for_fields_from_plays } from '#libs-server/data-views/get-cache-info-for-fields-from-plays.mjs'

const generate_fantasy_points_table_alias = ({ params = {} } = {}) => {
  const column_param_keys = Object.keys(nfl_plays_column_params).sort()
  const key = column_param_keys
    .map((key) => {
      const value = params[key]
      return Array.isArray(value)
        ? `${key}${value.sort().join('')}`
        : `${key}${value || ''}`
    })
    .join('')

  return get_table_hash(`fantasy_points_from_plays_${key}`)
}

const select_string = `ROUND(SUM(CASE WHEN pid_type = 'trg' AND comp = true THEN 1 ELSE 0 END + CASE WHEN pid_type IN ('bc', 'trg') THEN COALESCE(rush_yds, 0) + COALESCE(recv_yds, 0) ELSE 0 END * 0.1 + CASE WHEN pid_type = 'psr' THEN COALESCE(pass_yds, 0) ELSE 0 END * 0.04 + CASE WHEN pid_type = 'bc' AND rush_td = true THEN 6 WHEN pid_type = 'trg' AND pass_td = true THEN 6 WHEN pid_type = 'psr' AND pass_td = true THEN 4 ELSE 0 END + CASE WHEN pid_type = 'psr' AND int = true THEN -1 ELSE 0 END + CASE WHEN pid_type = 'fuml' THEN -1 ELSE 0 END), 2)`

// TODO add two points conversion
// TODO add special teams touchdowns
// TODO use scoring_format_hash in params to get scoring format from the database
const fantasy_points_from_plays_with = ({
  query,
  params = {},
  with_table_name,
  having_clauses = [],
  splits = []
}) => {
  const base_columns = new Set(['play_type', 'seas_type', 'year'])
  const stat_columns = new Set([
    'rush_yds',
    'recv_yds',
    'rush_td',
    'td',
    'comp',
    'int',
    'pass_yds',
    'pass_td'
  ])

  if (splits.includes('week')) {
    base_columns.add('week')
  }

  for (const param_name of Object.keys(params)) {
    if (param_name === 'career_year') {
      base_columns.add('year')
    } else if (param_name === 'career_game') {
      base_columns.add('esbid')
    } else if (
      nfl_plays_column_params[param_name] &&
      param_name !== 'year_offset'
    ) {
      base_columns.add(param_name)
    }
  }

  const select_columns = new Set([...stat_columns, ...base_columns])

  const with_query = db
    .queryBuilder()
    .select(db.raw('fantasy_points_plays.pid'))
    .select(db.raw(`${select_string} as fantasy_points_from_plays`))
    .from(function () {
      const select_columns_array = Array.from(select_columns)

      this.select(
        db.raw(
          `bc_pid as pid, 'bc' as pid_type, ${select_columns_array.join(', ')}`
        )
      )
        .from('nfl_plays')
        .whereNotNull('bc_pid')
        .unionAll(function () {
          this.select(
            db.raw(
              `psr_pid as pid, 'psr' as pid_type, ${select_columns_array.join(', ')}`
            )
          )
            .from('nfl_plays')
            .whereNotNull('psr_pid')
        })
        .unionAll(function () {
          this.select(
            db.raw(
              `trg_pid as pid, 'trg' as pid_type, ${select_columns_array.join(', ')}`
            )
          )
            .from('nfl_plays')
            .whereNotNull('trg_pid')
        })
        .unionAll(function () {
          const null_stat_columns = Array.from(stat_columns)
            .map((col) => `NULL as ${col}`)
            .join(', ')
          const base_columns_array = Array.from(base_columns)
          this.select(
            db.raw(
              `player_fuml_pid as pid, 'fuml' as pid_type, ${null_stat_columns}, ${base_columns_array.join(', ')}`
            )
          )
            .from('nfl_plays')
            .whereNotNull('player_fuml_pid')
        })
        .as('fantasy_points_plays')
    })
    .whereNot('play_type', 'NOPL')
    .where('fantasy_points_plays.seas_type', 'REG')

  // Add splits
  for (const split of splits) {
    if (data_views_constants.split_params.includes(split)) {
      const column_param_definition = nfl_plays_column_params[split]
      const table_name = column_param_definition.table || 'fantasy_points_plays'
      const split_statement = `${table_name}.${split}`
      with_query.select(split_statement)
      with_query.groupBy(split_statement)
    }
  }

  // Handle career_year and career_game
  if (params.career_year) {
    with_query.join('player_seasonlogs', function () {
      this.on('fantasy_points_plays.pid', '=', 'player_seasonlogs.pid')
        .andOn('fantasy_points_plays.year', '=', 'player_seasonlogs.year')
        .andOn(
          'fantasy_points_plays.seas_type',
          '=',
          'player_seasonlogs.seas_type'
        )
    })
    with_query.whereBetween('player_seasonlogs.career_year', [
      Math.min(params.career_year[0], params.career_year[1]),
      Math.max(params.career_year[0], params.career_year[1])
    ])
  }

  if (params.career_game) {
    with_query.join('player_gamelogs', function () {
      this.on('fantasy_points_plays.pid', '=', 'player_gamelogs.pid').andOn(
        'fantasy_points_plays.esbid',
        '=',
        'player_gamelogs.esbid'
      )
    })
    with_query.whereBetween('player_gamelogs.career_game', [
      Math.min(params.career_game[0], params.career_game[1]),
      Math.max(params.career_game[0], params.career_game[1])
    ])
  }

  // Remove career_year and career_game from params before applying other filters
  const filtered_params = { ...params }
  delete filtered_params.career_year
  delete filtered_params.career_game

  apply_play_by_play_column_params_to_query({
    query: with_query,
    params: filtered_params,
    table_name: 'fantasy_points_plays'
  })

  // Add groupBy clause
  with_query.groupBy('fantasy_points_plays.pid')

  // Add having clauses
  for (const having_clause of having_clauses) {
    with_query.havingRaw(having_clause)
  }

  query.with(with_table_name, with_query)
}

const should_use_main_where = ({ params }) => {
  return (
    (params.year_offset &&
      Array.isArray(params.year_offset) &&
      params.year_offset.length > 1) ||
    (params.rate_type && params.rate_type.length > 0)
  )
}

export default {
  player_fantasy_points_from_plays: {
    with_where: ({ params }) => {
      if (should_use_main_where({ params })) {
        return null
      }
      return select_string
    },
    main_where: ({
      params,
      table_name,
      column_id,
      column_index,
      rate_type_column_mapping
    }) => {
      if (should_use_main_where({ params })) {
        if (params.rate_type && params.rate_type.includes('per_game')) {
          const rate_type_table_name =
            rate_type_column_mapping[`${column_id}_${column_index}`]
          return get_rate_type_sql({
            table_name,
            column_name: 'fantasy_points_from_plays',
            rate_type_table_name
          })
        }
        return `SUM(${table_name}.fantasy_points_from_plays)`
      }
      return null
    },
    main_where_group_by: ({ params, table_name }) => {
      if (should_use_main_where({ params })) {
        return `${table_name}.fantasy_points_from_plays`
      }
      return null
    },
    table_alias: generate_fantasy_points_table_alias,
    column_name: 'fantasy_points_from_plays',
    with: fantasy_points_from_plays_with,
    join: data_view_join_function,
    supported_splits: ['year', 'week'],
    supported_rate_types: [
      'per_game',
      'per_team_half',
      'per_team_quarter',
      'per_team_play',
      'per_team_pass_play',
      'per_team_rush_play',
      'per_team_drive',
      'per_team_series',

      'per_player_rush_attempt',
      'per_player_pass_attempt',
      'per_player_target',
      'per_player_catchable_target',
      'per_player_catchable_deep_target',
      'per_player_reception',

      'per_player_play',
      'per_player_route',
      'per_player_pass_play',
      'per_player_rush_play'
    ],
    use_having: true,
    get_cache_info: get_cache_info_for_fields_from_plays
  }
}
