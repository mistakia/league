import db from '#db'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import data_view_join_function from '#libs-server/data-views/data-view-join-function.mjs'
import { create_season_cache_info } from '#libs-server/data-views/cache-info-utils.mjs'
import { constants } from '#libs-shared'

// TODO career_year

const get_cache_info = create_season_cache_info({
  get_params: ({ params = {} } = {}) => {
    const { year } = get_default_params({ params })
    return { year }
  }
})

const get_default_params = ({ params = {} } = {}) => {
  const default_params = {
    year: [constants.season.year],
    week: [constants.season.week],
    ranking_source_id: ['FANTASYPROS'],
    ranking_type: ['PPR_REDRAFT']
  }

  for (const [key, default_value] of Object.entries(default_params)) {
    let value = params[key] || default_value
    if (!Array.isArray(value)) {
      value = [value]
    }
    default_params[key] = value
  }

  return default_params
}

const generate_table_alias = ({ params = {} } = {}) => {
  const { year, week } = get_default_params({ params })
  const key = `player_rankings_${year.join('_')}_${week.join('_')}`
  return get_table_hash(key)
}

const add_player_rankings_with_statement = ({
  query,
  params = {},
  with_table_name,
  where_clauses = [],
  select_strings = [],
  splits = []
}) => {
  const { year, week, ranking_source_id, ranking_type } = get_default_params({
    params
  })

  const with_query = db('player_rankings_index')
    .select('pid')
    .whereIn('source_id', ranking_source_id)
    .whereIn('ranking_type', ranking_type)
    .whereIn('year', year)
    .whereIn('week', week)

  // Add year and week to SELECT when splits are included
  if (splits.includes('year')) {
    with_query.select('year')
  }

  if (splits.includes('week')) {
    with_query.select('week')
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

const create_player_rankings_field = (field, select_as) => ({
  column_name: field,
  select_as: () => select_as,
  table_name: 'player_rankings_index',
  table_alias: generate_table_alias,
  join: data_view_join_function,
  with: add_player_rankings_with_statement,
  supported_splits: ['year', 'week'],
  with_where: () => `player_rankings_index.${field}`,
  get_cache_info
})

export default {
  player_average_ranking: create_player_rankings_field('avg', 'average_rank'),
  player_overall_ranking: create_player_rankings_field(
    'overall_rank',
    'overall_rank'
  ),
  player_position_ranking: create_player_rankings_field(
    'position_rank',
    'position_rank'
  ),
  player_min_ranking: create_player_rankings_field('min', 'min_rank'),
  player_max_ranking: create_player_rankings_field('max', 'max_rank'),
  player_ranking_standard_deviation: create_player_rankings_field(
    'std',
    'rank_stddev'
  )
}
