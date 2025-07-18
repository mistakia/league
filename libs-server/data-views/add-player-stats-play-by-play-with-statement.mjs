import db from '#db'
import { data_views_constants } from '#libs-shared'
import apply_play_by_play_column_params_to_query from '#libs-server/apply-play-by-play-column-params-to-query.mjs'
import get_play_by_play_default_params from '#libs-server/data-views/get-play-by-play-default-params.mjs'

export const add_player_stats_play_by_play_with_statement = ({
  query,
  params = {},
  with_table_name,
  having_clauses = [],
  select_strings = [],
  pid_columns,
  splits = []
}) => {
  if (!with_table_name) {
    throw new Error('with_table_name is required')
  }

  const default_params = get_play_by_play_default_params({ params })

  const ordered_pid_columns_string = pid_columns.includes('player_fuml_pid')
    ? [
        'player_fuml_pid',
        ...pid_columns.filter((col) => col !== 'player_fuml_pid')
      ].join(', ')
    : pid_columns.join(', ')

  const with_query = db('nfl_plays')
    .select(db.raw(`COALESCE(${ordered_pid_columns_string}) as pid`))
    .whereNot('play_type', 'NOPL')
  // TODO this could be helpful for performance
  // .where(function () {
  //   for (const pid_column of pid_columns) {
  //     this.orWhereNotNull(pid_column)
  //   }
  // })

  for (const split of splits) {
    if (data_views_constants.split_params.includes(split)) {
      const split_statement = `nfl_plays.${split}`
      with_query.select(split_statement)
      with_query.groupBy(split_statement)
    }
  }

  // Add year column when year param exists (needed for joins)
  if (params.year && !splits.includes('year')) {
    with_query.select('nfl_plays.year')
    with_query.groupBy('nfl_plays.year')
  }

  const unique_select_strings = new Set(select_strings)

  for (const select_string of unique_select_strings) {
    with_query.select(db.raw(select_string))
  }

  // Handle career_year and career_game separately
  if (params.career_year) {
    with_query.join('player_seasonlogs', function () {
      this.on(function () {
        for (const pid_column of pid_columns) {
          this.orOn(`nfl_plays.${pid_column}`, '=', 'player_seasonlogs.pid')
        }
      })
        .andOn('nfl_plays.year', '=', 'player_seasonlogs.year')
        .andOn('nfl_plays.seas_type', '=', 'player_seasonlogs.seas_type')
    })
    with_query.whereBetween('player_seasonlogs.career_year', [
      Math.min(params.career_year[0], params.career_year[1]),
      Math.max(params.career_year[0], params.career_year[1])
    ])
  }

  if (params.career_game) {
    with_query.join('player_gamelogs', function () {
      this.on(function () {
        for (const pid_column of pid_columns) {
          this.orOn(`nfl_plays.${pid_column}`, '=', 'player_gamelogs.pid')
        }
      }).andOn('nfl_plays.esbid', '=', 'player_gamelogs.esbid')
    })
    with_query.whereBetween('player_gamelogs.career_game', [
      Math.min(params.career_game[0], params.career_game[1]),
      Math.max(params.career_game[0], params.career_game[1])
    ])
  }

  // Remove career_year and career_game from params before applying other filters
  const filtered_params = default_params
  delete filtered_params.career_year
  delete filtered_params.career_game

  apply_play_by_play_column_params_to_query({
    query: with_query,
    params: filtered_params
  })

  // Add groupBy clause before having
  with_query.groupBy(db.raw(`COALESCE(${ordered_pid_columns_string})`))

  // where_clauses to filter stats/metrics
  for (const having_clause of having_clauses) {
    with_query.havingRaw(having_clause)
  }

  query.with(with_table_name, with_query)
}
