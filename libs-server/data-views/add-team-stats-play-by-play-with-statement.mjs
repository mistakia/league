import db from '#db'
import apply_play_by_play_column_params_to_query from '#libs-server/apply-play-by-play-column-params-to-query.mjs'
import get_play_by_play_default_params from '#libs-server/data-views/get-play-by-play-default-params.mjs'

export const add_team_stats_play_by_play_with_statement = ({
  query,
  params = {},
  with_table_name,
  having_clauses = [],
  select_strings = [],
  splits = [],
  select_column_names = [],
  rate_columns = [],
  data_view_options
}) => {
  if (!with_table_name) {
    throw new Error('with_table_name is required')
  }

  const limit_to_player_active_games =
    params.limit_to_player_active_games || false
  const team_unit = params.team_unit || 'off'

  const with_query = db('nfl_plays')
    .select(`nfl_plays.${team_unit} as nfl_team`)
    .whereNot('play_type', 'NOPL')

  const unique_select_strings = new Set(select_strings)

  for (const select_string of unique_select_strings) {
    with_query.select(db.raw(select_string))
  }

  // Remove career_year and career_game from params before applying other filters
  const filtered_params = get_play_by_play_default_params({ params })
  delete filtered_params.career_year
  delete filtered_params.career_game

  apply_play_by_play_column_params_to_query({
    query: with_query,
    params: filtered_params
  })

  // Add groupBy clause before having
  with_query.groupBy(`nfl_plays.${team_unit}`)

  if (splits.includes('year')) {
    with_query.select('nfl_plays.year')
    with_query.groupBy('nfl_plays.year')
  }

  if (splits.includes('week')) {
    with_query.select('nfl_plays.week')
    with_query.groupBy('nfl_plays.week')
  }

  query.with(with_table_name, with_query)

  const stats_query = limit_to_player_active_games
    ? create_player_team_stats_query({
        with_table_name,
        select_column_names,
        rate_columns,
        splits,
        params,
        having_clauses,
        data_view_options
      })
    : create_team_stats_query({
        with_table_name,
        select_column_names,
        rate_columns,
        splits,
        params,
        having_clauses,
        data_view_options
      })

  const with_stats_table_postfix = limit_to_player_active_games
    ? '_player_team_stats'
    : '_team_stats'
  const final_stats_table_name = `${with_table_name}${with_stats_table_postfix}`

  // TODO review this code
  // Check if this final table is the from table - if so, make sure it has pid and split columns
  if (
    data_view_options &&
    final_stats_table_name === data_view_options.from_table_name
  ) {
    // Ensure the stats query includes pid and split columns for from table compatibility
    if (limit_to_player_active_games) {
      // Player team stats already includes pid
      if (
        splits.includes('year') &&
        !stats_query.toString().includes(`${with_table_name}.year`)
      ) {
        stats_query.select(`${with_table_name}.year`)
        stats_query.groupBy(`${with_table_name}.year`)
      }
      if (
        splits.includes('week') &&
        !stats_query.toString().includes(`${with_table_name}.week`)
      ) {
        stats_query.select(`${with_table_name}.week`)
        stats_query.groupBy(`${with_table_name}.week`)
      }
    }
  }

  query.with(final_stats_table_name, stats_query)
}

function create_team_stats_query({
  with_table_name,
  select_column_names,
  rate_columns,
  splits,
  params,
  having_clauses,
  data_view_options
}) {
  const team_stats_query = db(with_table_name)
    .select(`${with_table_name}.nfl_team`)
    .groupBy(`${with_table_name}.nfl_team`)

  add_select_columns({
    query: team_stats_query,
    with_table_name,
    select_column_names,
    rate_columns
  })
  add_splits({ query: team_stats_query, with_table_name, splits })
  add_having_clauses({ query: team_stats_query, having_clauses })

  return team_stats_query
}

function create_player_team_stats_query({
  with_table_name,
  select_column_names,
  rate_columns,
  splits,
  params,
  having_clauses,
  data_view_options
}) {
  const { seas_type } = get_play_by_play_default_params({ params })
  const player_team_stats_query = db('player_gamelogs')
    .select('player_gamelogs.pid')
    .groupBy('player_gamelogs.pid')
    .join('nfl_games', 'player_gamelogs.esbid', 'nfl_games.esbid')
    .join(`${with_table_name}`, function () {
      this.on('player_gamelogs.tm', '=', `${with_table_name}.nfl_team`)
      this.andOn('nfl_games.year', '=', `${with_table_name}.year`)
      this.andOn('nfl_games.week', '=', `${with_table_name}.week`)
    })
    .whereIn('nfl_games.seas_type', seas_type)

  add_select_columns({
    query: player_team_stats_query,
    with_table_name,
    select_column_names,
    rate_columns
  })
  add_splits({ query: player_team_stats_query, with_table_name, splits })
  add_having_clauses({ query: player_team_stats_query, having_clauses })

  return player_team_stats_query
}

function add_select_columns({
  query,
  with_table_name,
  select_column_names,
  rate_columns
}) {
  const unique_select_column_names = new Set(select_column_names)
  for (const select_column_name of unique_select_column_names) {
    if (rate_columns.includes(select_column_name)) {
      query.select(
        db.raw(
          `sum(${with_table_name}.${select_column_name}_numerator) / sum(${with_table_name}.${select_column_name}_denominator) as ${select_column_name}`
        )
      )
    } else {
      query.select(
        db.raw(
          `sum(${with_table_name}.${select_column_name}) as ${select_column_name}`
        )
      )
    }
  }
}

function add_splits({ query, with_table_name, splits }) {
  if (splits.includes('year')) {
    query.select(`${with_table_name}.year`)
    query.groupBy(`${with_table_name}.year`)
  }

  if (splits.includes('week')) {
    query.select(`${with_table_name}.week`)
    query.groupBy(`${with_table_name}.week`)
  }
}

// TODO not sure if this is needed
function add_having_clauses({ query, having_clauses }) {
  for (const having_clause of having_clauses) {
    query.havingRaw(having_clause)
  }
}
