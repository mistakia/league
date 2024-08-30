import db from '#db'
import get_table_hash from '#libs-server/get-table-hash.mjs'
import data_view_join_function from '#libs-server/data-views/data-view-join-function.mjs'
import { constants } from '#libs-shared'

const generate_table_alias = ({ params = {} } = {}) => {
  let year = params.year || [constants.season.year]
  if (!Array.isArray(year)) {
    year = [year]
  }

  let week = params.week || [Math.max(constants.season.week, 1)]
  if (!Array.isArray(week)) {
    week = [week]
  }

  const key = `player_dfs_salaries_${year.join('_')}_${week.join('_')}`
  return get_table_hash(key)
}

const add_player_dfs_salaries_with_statement = ({
  query,
  params = {},
  with_table_name,
  where_clauses = []
}) => {
  let year = params.year || [constants.season.year]
  if (!Array.isArray(year)) {
    year = [year]
  }

  let week = params.week || [Math.max(constants.season.week, 1)]
  if (!Array.isArray(week)) {
    week = [week]
  }

  const platform_source_id = params.platform_source_id || 'DRAFTKINGS'

  // need to set the source_contest_id

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
    .where('player_salaries.source_id', platform_source_id)
    .whereIn('nfl_games.year', year)
    .whereIn('nfl_games.week', week)

  if (where_clauses.length) {
    for (const where_clause of where_clauses) {
      with_query.whereRaw(where_clause)
    }
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
