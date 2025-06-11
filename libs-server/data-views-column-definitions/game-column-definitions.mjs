import db from '#db'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import data_view_join_function from '#libs-server/data-views/data-view-join-function.mjs'
import { create_season_cache_info } from '#libs-server/data-views/cache-info-utils.mjs'
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

  const seas_type = Array.isArray(params.seas_type)
    ? params.seas_type[0]
    : params.seas_type || constants.season.nfl_seas_type

  return {
    year,
    week,
    seas_type
  }
}

const get_cache_info = create_season_cache_info({ get_params })

const generate_table_alias = ({ params = {} } = {}) => {
  const { year, week, seas_type } = get_params({ params })
  const key = `game_${year.join('_')}_${week.join('_')}_${seas_type}`
  return get_table_hash(key)
}

const add_game_with_statement = ({
  query,
  params = {},
  with_table_name,
  where_clauses = []
}) => {
  const { year, week, seas_type } = get_params({ params })

  const with_query = db('nfl_games')
    .select(
      'year',
      'week',
      db.raw('v as nfl_team'),
      db.raw('h as game_opponent'),
      db.raw('true as game_is_home')
    )
    .whereIn('year', year)
    .whereIn('week', week)
    .where('seas_type', seas_type)
    .union(function () {
      this.select(
        'year',
        'week',
        db.raw('h as nfl_team'),
        db.raw('v as game_opponent'),
        db.raw('false as game_is_home')
      )
        .from('nfl_games')
        .whereIn('year', year)
        .whereIn('week', week)
        .where('seas_type', seas_type)

      if (where_clauses.length) {
        for (const where_clause of where_clauses) {
          if (where_clause.includes('game_opponent')) {
            this.whereRaw(where_clause.replace('game_opponent', 'v'))
          } else {
            this.whereRaw(where_clause)
          }
        }
      }
    })

  if (where_clauses.length) {
    for (const where_clause of where_clauses) {
      if (where_clause.includes('game_opponent')) {
        with_query.whereRaw(where_clause.replace('game_opponent', 'h'))
      } else {
        with_query.whereRaw(where_clause)
      }
    }
  }

  query.with(with_table_name, with_query)
}

export default {
  game_opponent: {
    column_name: 'game_opponent',
    main_select: ({ table_name, column_index }) => [
      `${table_name}.game_opponent as game_opponent_${column_index}`,
      `${table_name}.game_is_home as game_is_home_${column_index}`
    ],
    main_group_by: ({ table_name }) => [
      `${table_name}.game_opponent`,
      `${table_name}.game_is_home`
    ],
    with_where: () => `game_opponent`,
    table_alias: generate_table_alias,
    join: (args) => data_view_join_function({ ...args, join_on_team: true }),
    with: add_game_with_statement,
    supported_splits: ['year', 'week'],
    get_cache_info
  }
}
