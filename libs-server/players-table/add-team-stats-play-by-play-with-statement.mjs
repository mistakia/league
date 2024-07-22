import db from '#db'
import { players_table_constants } from '#libs-shared'
import apply_play_by_play_column_params_to_query from '#libs-server/apply-play-by-play-column-params-to-query.mjs'
import nfl_plays_column_params from '#libs-shared/nfl-plays-column-params.mjs'

export const add_team_stats_play_by_play_with_statement = ({
  query,
  params = {},
  with_table_name,
  having_clauses = [],
  select_strings = [],
  splits = []
}) => {
  if (!with_table_name) {
    throw new Error('with_table_name is required')
  }

  const with_query = db('nfl_plays')
    .select('nfl_plays.off as nfl_team', 'nfl_plays.year', 'nfl_plays.week')
    .whereNot('play_type', 'NOPL')
    .where('nfl_plays.seas_type', 'REG')

  for (const split of splits) {
    if (players_table_constants.split_params.includes(split)) {
      const column_param_definition = nfl_plays_column_params[split]
      const table_name = column_param_definition.table || 'nfl_plays'
      const split_statement = `${table_name}.${split}`
      with_query.select(split_statement)
      with_query.groupBy(split_statement)
    }
  }

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

  // where_clauses to filter stats/metrics
  for (const having_clause of having_clauses) {
    with_query.havingRaw(having_clause)
  }

  query.with(with_table_name, with_query)

  // Add the player_team_stats with table
  const player_team_stats_query = db('player_gamelogs')
    .select('player_gamelogs.pid')
    .join('nfl_games', 'player_gamelogs.esbid', 'nfl_games.esbid')
    .join(with_table_name, function () {
      this.on('player_gamelogs.tm', '=', `${with_table_name}.nfl_team`)
      this.andOn('nfl_games.year', '=', `${with_table_name}.year`)
      this.andOn('nfl_games.week', '=', `${with_table_name}.week`)
    })

  if (splits.includes('year')) {
    player_team_stats_query.select('nfl_games.year')
    player_team_stats_query.groupBy('player_gamelogs.pid', 'nfl_games.year')
  } else {
    player_team_stats_query.groupBy('player_gamelogs.pid')
  }

  player_team_stats_query.select(
    db.raw(
      `SUM(${with_table_name}.team_pass_yds_from_plays_0) as team_pass_yds_from_plays_0`
    )
  )

  if (params.year) {
    const year_array = Array.isArray(params.year) ? params.year : [params.year]
    player_team_stats_query.whereIn('nfl_games.year', year_array)
  }

  query.with('player_team_stats', player_team_stats_query)
}
