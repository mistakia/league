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

  const with_query = db('nfl_plays')
    .select('nfl_plays.off as nfl_team', 'nfl_plays.year', 'nfl_plays.week')
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
  with_query.groupBy('nfl_plays.off', 'nfl_plays.year', 'nfl_plays.week')

  query.with(with_table_name, with_query)

  // Add the player_team_stats with table
  const player_team_stats_query = db('player_gamelogs')
    .select('player_gamelogs.pid')
    .groupBy('player_gamelogs.pid')
    .join('nfl_games', 'player_gamelogs.esbid', 'nfl_games.esbid')
    .join(with_table_name, function () {
      this.on('player_gamelogs.tm', '=', `${with_table_name}.nfl_team`)
      this.andOn('nfl_games.year', '=', `${with_table_name}.year`)
      this.andOn('nfl_games.week', '=', `${with_table_name}.week`)
    })
    .where('nfl_games.seas_type', 'REG')

  // where_clauses to filter stats/metrics
  for (const having_clause of having_clauses) {
    player_team_stats_query.havingRaw(having_clause)
  }

  const unique_select_column_names = new Set(select_column_names)
  for (const select_column_name of unique_select_column_names) {
    if (rate_columns.includes(select_column_name)) {
      player_team_stats_query.select(
        db.raw(
          `sum(${with_table_name}.${select_column_name}_numerator) / sum(${with_table_name}.${select_column_name}_denominator) as ${select_column_name}`
        )
      )
    } else {
      player_team_stats_query.select(
        db.raw(
          `sum(${with_table_name}.${select_column_name}) as ${select_column_name}`
        )
      )
    }
  }

  if (splits.includes('year')) {
    player_team_stats_query.select('nfl_games.year')
    player_team_stats_query.groupBy('nfl_games.year')
  }

  if (splits.includes('week')) {
    player_team_stats_query.select('nfl_games.week')
    player_team_stats_query.groupBy('nfl_games.week')
  }

  if (params.year) {
    const year_array = Array.isArray(params.year) ? params.year : [params.year]
    player_team_stats_query.whereIn('nfl_games.year', year_array)
  }

  query.with(`${with_table_name}_player_team_stats`, player_team_stats_query)
}
