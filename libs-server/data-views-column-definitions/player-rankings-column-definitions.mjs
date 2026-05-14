import db from '#db'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import data_view_join_function from '#libs-server/data-views/data-view-join-function.mjs'
import { create_season_cache_info } from '#libs-server/data-views/cache-info-utils.mjs'
import { current_season } from '#constants'

const get_season_default_params = ({ params = {} } = {}) => {
  const default_params = {
    ranking_source_id: ['FANTASYPROS'],
    ranking_type: ['PPR_REDRAFT']
  }

  let year = params.year || [current_season.year]
  if (!Array.isArray(year)) year = [year]

  for (const [key, default_value] of Object.entries(default_params)) {
    let value = params[key] || default_value
    if (!Array.isArray(value)) value = [value]
    default_params[key] = value
  }

  return {
    ...default_params,
    year
  }
}

const get_season_cache_info = create_season_cache_info({
  get_params: ({ params = {} } = {}) => {
    const { year } = get_season_default_params({ params })
    return { year, week: [0] }
  }
})

const generate_season_table_alias = ({ params = {} } = {}) => {
  const { year, ranking_source_id, ranking_type } = get_season_default_params({
    params
  })
  const key = `player_season_rankings_${year.join('_')}_${ranking_source_id.join('_')}_${ranking_type.join('_')}`
  return get_table_hash(key)
}

const add_player_season_rankings_with_statement = ({
  query,
  params = {},
  with_table_name,
  where_clauses = [],
  select_strings = [],
  splits = []
}) => {
  const { year, ranking_source_id, ranking_type } = get_season_default_params({
    params
  })

  const with_query = db('player_rankings_index')
    .select('pid')
    .whereIn('source_id', ranking_source_id)
    .whereIn('ranking_type', ranking_type)
    .whereIn('year', year)

  if (splits.includes('year')) {
    with_query.select('year')
  }

  if (select_strings.length) {
    for (const select_string of select_strings) {
      with_query.select(db.raw(select_string))
    }
  }

  if (where_clauses.length) {
    for (const where_clause of where_clauses) {
      with_query.whereRaw(where_clause)
    }
  }

  query.with(with_table_name, with_query)
}

const create_player_season_rankings_field = (field, select_as) => ({
  column_name: field,
  select_as: () => select_as,
  table_name: 'player_rankings_index',
  table_alias: generate_season_table_alias,
  join: data_view_join_function,
  with: add_player_season_rankings_with_statement,
  supported_splits: ['year'],
  granularity: ['player_year'],
  with_where: () => `player_rankings_index.${field}`,
  get_cache_info: get_season_cache_info
})

export default {
  player_season_average_ranking: create_player_season_rankings_field(
    'avg',
    'average_rank'
  ),
  player_season_overall_ranking: create_player_season_rankings_field(
    'overall_rank',
    'overall_rank'
  ),
  player_season_position_ranking: create_player_season_rankings_field(
    'position_rank',
    'position_rank'
  ),
  player_season_min_ranking: create_player_season_rankings_field(
    'min',
    'min_rank'
  ),
  player_season_max_ranking: create_player_season_rankings_field(
    'max',
    'max_rank'
  ),
  player_season_ranking_standard_deviation: create_player_season_rankings_field(
    'std',
    'rank_stddev'
  )
}
