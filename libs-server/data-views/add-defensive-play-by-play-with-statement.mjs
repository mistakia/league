import db from '#db'
import apply_play_by_play_column_params_to_query from '#libs-server/apply-play-by-play-column-params-to-query.mjs'
import { nfl_plays_column_params, data_views_constants } from '#libs-shared'
import get_play_by_play_default_params from '#libs-server/data-views/get-play-by-play-default-params.mjs'
import get_effective_years from '#libs-server/data-views/get-effective-years.mjs'
import { normalize_career_year_range } from '#libs-server/data-views/param-utils.mjs'

export const add_defensive_play_by_play_with_statement = ({
  query,
  params = {},
  with_table_name,
  having_clauses = [],
  select_strings = [],
  pid_columns = [],
  splits = [],
  data_view_options = {}
}) => {
  if (!with_table_name) {
    throw new Error('with_table_name is required')
  }

  if (!pid_columns.length) {
    throw new Error('pid_columns is required')
  }

  // nfl_week_id is always projected because get_play_by_play_default_params
  // injects it into the outer filter params whenever `year` is provided
  // without an explicit nfl_week_id; the outer WHERE then references
  // defensive_plays.nfl_week_id, which must exist in the inner projection.
  const base_columns = new Set([
    'play_type',
    'seas_type',
    'year',
    'nfl_week_id'
  ])
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

  // Inner UNION-ALL branches scan nfl_plays directly; apply_play_by_play is wired
  // to the outer defensive_plays subquery and cannot reach the branches, so this
  // push is the sole source of partition pruning for those scans.
  const effective_years = get_effective_years({ params, data_view_options })

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
      if (effective_years.length) {
        this.whereIn('nfl_plays.year', effective_years)
      }

      for (const pid_column of pid_columns.slice(1)) {
        this.unionAll(function () {
          this.select(
            db.raw(
              `${pid_column} as pid, '${pid_column}' as pid_column, ${select_columns_array.join(', ')}`
            )
          )
            .from('nfl_plays')
            .whereNotNull(pid_column)
          if (effective_years.length) {
            this.whereIn('nfl_plays.year', effective_years)
          }
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
      const table_name =
        (column_param_definition && column_param_definition.table) ||
        'defensive_plays'
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
    with_query.whereBetween(
      'player_seasonlogs.career_year',
      normalize_career_year_range(params.career_year)
    )
  }

  if (params.career_game) {
    with_query.join('player_gamelogs', function () {
      this.on('defensive_plays.pid', '=', 'player_gamelogs.pid').andOn(
        'defensive_plays.esbid',
        '=',
        'player_gamelogs.esbid'
      )
    })
    with_query.whereBetween(
      'player_gamelogs.career_game',
      normalize_career_year_range(params.career_game)
    )
  }

  // Remove career_year and career_game from params before applying other filters
  const filtered_params = get_play_by_play_default_params({ params })
  delete filtered_params.career_year
  delete filtered_params.career_game

  apply_play_by_play_column_params_to_query({
    query: with_query,
    params: filtered_params,
    table_name: 'defensive_plays',
    query_context: data_view_options.query_context
  })

  // Add groupBy clause
  with_query.groupBy('pid')

  // Add having clauses
  for (const having_clause of having_clauses) {
    with_query.havingRaw(having_clause)
  }

  // MATERIALIZED required: predicates are pushed at construction time; planner
  // predicate push-into-CTE is not needed and would let the planner inline the
  // CTE into a nested-loop that re-executes it per outer row.
  query.withMaterialized(with_table_name, with_query)
}
