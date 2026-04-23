import db from '#db'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import data_view_join_function from '#libs-server/data-views/data-view-join-function.mjs'
import { create_season_cache_info } from '#libs-server/data-views/cache-info-utils.mjs'
import resolve_single_nfl_week_id from '#libs-server/data-views/resolve-single-nfl-week-id.mjs'
import {
  format_nfl_week_identifier,
  parse_nfl_week_identifier
} from '#libs-shared/nfl-week-identifier.mjs'

const get_params = ({ params = {} }) => {
  if (params.nfl_week_id) {
    const nfl_week = Array.isArray(params.nfl_week_id)
      ? params.nfl_week_id
      : [params.nfl_week_id]
    return { nfl_week }
  }

  // Cartesian fallback for callers that pass year[]/week[] arrays without
  // nfl_week_id (the pre-migration form). When neither is present, fall back
  // to the resolver default.
  const years = params.year
    ? Array.isArray(params.year)
      ? params.year
      : [params.year]
    : null
  const weeks = params.week
    ? Array.isArray(params.week)
      ? params.week
      : [params.week]
    : null
  const seas_type = Array.isArray(params.seas_type)
    ? params.seas_type[0]
    : params.seas_type

  if (years && weeks) {
    const resolved_seas_type =
      seas_type ||
      parse_nfl_week_identifier({
        identifier: resolve_single_nfl_week_id({ params })
      })?.seas_type ||
      'REG'
    const nfl_week = []
    for (const y of years) {
      for (const w of weeks) {
        nfl_week.push(
          format_nfl_week_identifier({
            year: y,
            seas_type: resolved_seas_type,
            week: w
          })
        )
      }
    }
    return { nfl_week }
  }

  const nfl_week = [resolve_single_nfl_week_id({ params })]
  return { nfl_week }
}

const get_cache_info = create_season_cache_info({ get_params })

const generate_table_alias = ({ params = {} } = {}) => {
  const { nfl_week } = get_params({ params })
  const key = `game_${nfl_week.join('_')}`
  return get_table_hash(key)
}

const add_game_with_statement = ({
  query,
  params = {},
  with_table_name,
  where_clauses = []
}) => {
  const { nfl_week } = get_params({ params })

  const with_query = db('nfl_games')
    .select(
      'year',
      'week',
      db.raw('v as nfl_team'),
      db.raw('h as game_opponent'),
      db.raw('true as game_is_home')
    )
    .whereIn('nfl_week_id', nfl_week)
    .union(function () {
      this.select(
        'year',
        'week',
        db.raw('h as nfl_team'),
        db.raw('v as game_opponent'),
        db.raw('false as game_is_home')
      )
        .from('nfl_games')
        .whereIn('nfl_week_id', nfl_week)

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
