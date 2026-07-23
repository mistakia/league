import db from '#db'
import { data_views_constants } from '#libs-shared'
import apply_play_by_play_column_params_to_query from '#libs-server/apply-play-by-play-column-params-to-query.mjs'
import get_play_by_play_default_params from '#libs-server/data-views/get-play-by-play-default-params.mjs'
import get_effective_years from '#libs-server/data-views/get-effective-years.mjs'
import { normalize_career_year_range } from '#libs-server/data-views/param-utils.mjs'

export const add_player_stats_play_by_play_with_statement = ({
  query,
  params = {},
  with_table_name,
  having_clauses = [],
  select_strings = [],
  pid_columns,
  row_axes = [],
  data_view_options = {}
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

  for (const row_axis of row_axes) {
    if (data_views_constants.row_axis_params.includes(row_axis)) {
      const row_axis_statement = `nfl_plays.${row_axis}`
      with_query.select(row_axis_statement)
      with_query.groupBy(row_axis_statement)
    }
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
        .andOn('nfl_plays.year', '=', 'player_seasonlogs.season_year')
        .andOn('nfl_plays.seas_type', '=', 'player_seasonlogs.season_type')
    })
    with_query.whereBetween(
      'player_seasonlogs.career_year',
      normalize_career_year_range(params.career_year)
    )
  }

  if (params.career_game) {
    with_query.join('player_gamelogs', function () {
      this.on(function () {
        for (const pid_column of pid_columns) {
          this.orOn(`nfl_plays.${pid_column}`, '=', 'player_gamelogs.pid')
        }
      }).andOn('nfl_plays.esbid', '=', 'player_gamelogs.esbid')
    })
    with_query.whereBetween(
      'player_gamelogs.career_game',
      normalize_career_year_range(params.career_game)
    )
  }

  // Remove career_year and career_game from params before applying other filters
  const filtered_params = default_params
  delete filtered_params.career_year
  delete filtered_params.career_game

  apply_play_by_play_column_params_to_query({
    query: with_query,
    params: filtered_params,
    query_context: data_view_options.query_context
  })

  // Add groupBy clause before having
  with_query.groupBy(db.raw(`COALESCE(${ordered_pid_columns_string})`))

  // where_clauses to filter stats/metrics
  for (const having_clause of having_clauses) {
    with_query.havingRaw(having_clause)
  }

  // Skip when scope has been emitted: apply_play_by_play_column_params_to_query
  // (with query_context) already pushes nfl_plays.year via apply_scope_to_query,
  // and the legacy nfl_week_id branch pushes year on its own when nfl_week_id is
  // set. Only emit here for callers without view scope and without nfl_week_id.
  const view_scope_emitted =
    data_view_options.query_context &&
    data_view_options.query_context.nfl_week_ids &&
    data_view_options.query_context.nfl_week_ids.length
  if (!params.nfl_week_id && !view_scope_emitted) {
    const effective_years = get_effective_years({ params, data_view_options })
    if (effective_years.length) {
      with_query.whereIn('nfl_plays.year', effective_years)
    }
  }

  // MATERIALIZED required: predicates are pushed at construction time; planner
  // predicate push-into-CTE is not needed and would mask the partition-pruning
  // behavior we rely on, and would let the planner inline the CTE into a
  // nested-loop that re-executes it per outer row.
  query.withMaterialized(with_table_name, with_query)
}
