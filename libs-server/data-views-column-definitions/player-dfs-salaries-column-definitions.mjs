import db from '#db'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import data_view_join_function from '#libs-server/data-views/data-view-join-function.mjs'
import { constants } from '#libs-shared'

const get_params = ({ params = {} }) => {
  let year = params.year || [constants.season.year]
  if (!Array.isArray(year)) {
    year = [year]
  }

  let week = params.week || [Math.max(constants.season.week, 1)]
  if (!Array.isArray(week)) {
    week = [week]
  }

  let career_year = params.career_year || []
  if (!Array.isArray(career_year)) {
    career_year = [career_year]
  }

  let career_game = params.career_game || []
  if (!Array.isArray(career_game)) {
    career_game = [career_game]
  }

  let platform_source_id = params.platform_source_id || ['DRAFTKINGS']
  if (!Array.isArray(platform_source_id)) {
    platform_source_id = [platform_source_id]
  }

  return {
    year,
    week,
    career_year,
    career_game,
    platform_source_id
  }
}

const generate_table_alias = ({ params = {} } = {}) => {
  const { year, week, career_year, career_game, platform_source_id } =
    get_params({ params })
  const key = `player_dfs_salaries_${year.join('_')}_${week.join('_')}_${career_year.join('_')}_${career_game.join('_')}_${platform_source_id.join('_')}`
  return get_table_hash(key)
}

const add_player_dfs_salaries_with_statement = ({
  query,
  params = {},
  with_table_name,
  where_clauses = []
}) => {
  const { year, week, career_year, career_game, platform_source_id } =
    get_params({ params })

  const with_query = db('player_salaries')
    .select(
      'player_salaries.pid',
      'player_salaries.salary',
      'nfl_games.year',
      'nfl_games.week'
    )
    .join('nfl_games', function () {
      this.on('player_salaries.esbid', '=', 'nfl_games.esbid')
    })
    .whereIn('player_salaries.source_id', platform_source_id)
    .whereIn('nfl_games.year', year)
    .whereIn('nfl_games.week', week)

  if (where_clauses.length) {
    for (const where_clause of where_clauses) {
      with_query.whereRaw(where_clause)
    }
  }

  if (career_year.length) {
    with_query.join('player_seasonlogs', function () {
      this.on('player_salaries.pid', '=', 'player_seasonlogs.pid')
        .andOn('nfl_games.year', '=', 'player_seasonlogs.year')
        .andOn('nfl_games.seas_type', '=', 'player_seasonlogs.seas_type')
    })
    with_query.whereBetween('player_seasonlogs.career_year', [
      Math.min(career_year[0], career_year[1]),
      Math.max(career_year[0], career_year[1])
    ])
  }

  if (career_game.length) {
    with_query.join('player_gamelogs', function () {
      this.on('player_salaries.pid', '=', 'player_gamelogs.pid').andOn(
        'nfl_games.esbid',
        '=',
        'player_gamelogs.esbid'
      )
    })
    with_query.whereBetween('player_gamelogs.career_game', [
      Math.min(career_game[0], career_game[1]),
      Math.max(career_game[0], career_game[1])
    ])
  }

  query.with(with_table_name, with_query)
}

const create_player_dfs_salaries_field = (field) => ({
  column_name: field,
  table_name: 'player_salaries',
  select_as: () => 'dfs_salary',
  table_alias: generate_table_alias,
  join: data_view_join_function,
  with: add_player_dfs_salaries_with_statement,
  supported_splits: ['year', 'week'],
  with_where: () => 'player_salaries.salary'
})

export default {
  player_dfs_salary: create_player_dfs_salaries_field('salary')
}
