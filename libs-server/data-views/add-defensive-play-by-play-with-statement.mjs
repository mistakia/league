import db from '#db'
import apply_play_by_play_column_params_to_query from '#libs-server/apply-play-by-play-column-params-to-query.mjs'
import { nfl_plays_column_params, data_views_constants } from '#libs-shared'
import get_play_by_play_default_params from '#libs-server/data-views/get-play-by-play-default-params.mjs'

export const add_defensive_play_by_play_with_statement = ({
  query,
  params = {},
  with_table_name,
  having_clauses = [],
  select_strings = [],
  pid_columns = [],
  splits = []
}) => {
  if (!with_table_name) {
    throw new Error('with_table_name is required')
  }

  if (!pid_columns.length) {
    throw new Error('pid_columns is required')
  }

  const base_columns = new Set(['play_type', 'seas_type', 'year'])
  const stat_columns = new Set([])

  for (const param_name of Object.keys(params)) {
    if (param_name === 'career_year') {
      base_columns.add('year')
    } else if (param_name === 'career_game') {
      base_columns.add('esbid')
    } else if (nfl_plays_column_params[param_name]) {
      base_columns.add(param_name)
    }
  }

  const select_columns = new Set([...stat_columns, ...base_columns])

  const with_query = db
    .queryBuilder()
    .select(db.raw('pid'))
    .from(function () {
      const select_columns_array = Array.from(select_columns)

      this.from('nfl_plays')
      this.select(
        db.raw(
          `${pid_columns[0]} as pid, '${pid_columns[0]}' as pid_column, ${select_columns_array.join(', ')}`
        )
      )
      this.whereNotNull(pid_columns[0])

      for (const pid_column of pid_columns.slice(1)) {
        this.unionAll(function () {
          this.select(
            db.raw(
              `${pid_column} as pid, '${pid_column}' as pid_column, ${select_columns_array.join(', ')}`
            )
          )
            .from('nfl_plays')
            .whereNotNull(pid_column)
        })
      }

      this.as('defensive_plays')
    })
    .whereNot('play_type', 'NOPL')

  const unique_select_strings = new Set(select_strings)

  for (const select_string of unique_select_strings) {
    with_query.select(db.raw(select_string))
  }

  // Add splits
  for (const split of splits) {
    if (data_views_constants.split_params.includes(split)) {
      const column_param_definition = nfl_plays_column_params[split]
      const table_name = column_param_definition.table || 'defensive_plays'
      const split_statement = `${table_name}.${split}`
      with_query.select(split_statement)
      with_query.groupBy(split_statement)
    }
  }

  // Handle career_year and career_game
  if (params.career_year) {
    with_query.join('player_seasonlogs', function () {
      this.on('defensive_plays.pid', '=', 'player_seasonlogs.pid')
        .andOn('defensive_plays.year', '=', 'player_seasonlogs.year')
        .andOn('defensive_plays.seas_type', '=', 'player_seasonlogs.seas_type')
    })
    with_query.whereBetween('player_seasonlogs.career_year', [
      Math.min(params.career_year[0], params.career_year[1]),
      Math.max(params.career_year[0], params.career_year[1])
    ])
  }

  if (params.career_game) {
    with_query.join('player_gamelogs', function () {
      this.on('defensive_plays.pid', '=', 'player_gamelogs.pid').andOn(
        'defensive_plays.esbid',
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
  const filtered_params = get_play_by_play_default_params({ params })
  delete filtered_params.career_year
  delete filtered_params.career_game

  apply_play_by_play_column_params_to_query({
    query: with_query,
    params: filtered_params,
    table_name: 'defensive_plays'
  })

  // Add groupBy clause
  with_query.groupBy('pid')

  // Add having clauses
  for (const having_clause of having_clauses) {
    with_query.havingRaw(having_clause)
  }

  query.with(with_table_name, with_query)
}
