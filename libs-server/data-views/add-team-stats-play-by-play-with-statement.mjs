import db from '#db'
import apply_play_by_play_column_params_to_query from '#libs-server/apply-play-by-play-column-params-to-query.mjs'

export const add_team_stats_play_by_play_with_statement = ({
  query,
  params = {},
  with_table_name,
  having_clauses = [],
  select_strings = [],
  splits = [],
  select_column_names = [],
  rate_columns = []
}) => {
  if (!with_table_name) {
    throw new Error('with_table_name is required')
  }

  const limit_to_player_active_games =
    params.limit_to_player_active_games || false
  const team_unit = params.team_unit || 'off'

  const with_query = db('nfl_plays')
    .select(
      `nfl_plays.${team_unit} as nfl_team`,
      'nfl_plays.year',
      'nfl_plays.week'
    )
    .whereNot('play_type', 'NOPL')
    .where('nfl_plays.seas_type', 'REG')

  const unique_select_strings = new Set(select_strings)

  for (const select_string of unique_select_strings) {
    with_query.select(db.raw(select_string))
  }

  // Remove career_year and career_game from params before applying other filters
  const filtered_params = { ...params }
  delete filtered_params.career_year
  delete filtered_params.career_game

  apply_play_by_play_column_params_to_query({
    query: with_query,
    params: filtered_params
  })

  // Add groupBy clause before having
  with_query.groupBy(
    `nfl_plays.${team_unit}`,
    'nfl_plays.year',
    'nfl_plays.week'
  )

  query.with(with_table_name, with_query)

  const stats_query = limit_to_player_active_games
    ? create_player_team_stats_query({
        with_table_name,
        select_column_names,
        rate_columns,
        splits,
        params,
        having_clauses
      })
    : create_team_stats_query({
        with_table_name,
        select_column_names,
        rate_columns,
        splits,
        params,
        having_clauses
      })

  const with_stats_table_postfix = limit_to_player_active_games
    ? '_player_team_stats'
    : '_team_stats'
  query.with(`${with_table_name}${with_stats_table_postfix}`, stats_query)
}

function create_team_stats_query({
  with_table_name,
  select_column_names,
  rate_columns,
  splits,
  params,
  having_clauses
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
  add_year_filter({ query: team_stats_query, with_table_name, params })
  add_having_clauses({ query: team_stats_query, having_clauses })

  return team_stats_query
}

function create_player_team_stats_query({
  with_table_name,
  select_column_names,
  rate_columns,
  splits,
  params,
  having_clauses
}) {
  const player_team_stats_query = db('player_gamelogs')
    .select('player_gamelogs.pid')
    .groupBy('player_gamelogs.pid')
    .join('nfl_games', 'player_gamelogs.esbid', 'nfl_games.esbid')
    .join(`${with_table_name}`, function () {
      this.on('player_gamelogs.tm', '=', `${with_table_name}.nfl_team`)
      this.andOn('nfl_games.year', '=', `${with_table_name}.year`)
      this.andOn('nfl_games.week', '=', `${with_table_name}.week`)
    })
    .where('nfl_games.seas_type', 'REG')

  add_select_columns({
    query: player_team_stats_query,
    with_table_name,
    select_column_names,
    rate_columns
  })
  add_splits({ query: player_team_stats_query, with_table_name, splits })
  add_year_filter({ query: player_team_stats_query, with_table_name, params })
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

function add_year_filter({ query, with_table_name, params }) {
  if (params.year) {
    const year_array = Array.isArray(params.year) ? params.year : [params.year]
    query.whereIn(`${with_table_name}.year`, year_array)
  }
}

function add_having_clauses({ query, having_clauses }) {
  for (const having_clause of having_clauses) {
    query.havingRaw(having_clause)
  }
}
