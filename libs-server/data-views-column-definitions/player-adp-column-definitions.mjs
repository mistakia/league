import db from '#db'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import data_view_join_function from '#libs-server/data-views/data-view-join-function.mjs'
import { create_season_cache_info } from '#libs-server/data-views/cache-info-utils.mjs'
import { current_season } from '#constants'

const get_cache_info = create_season_cache_info({
  get_params: ({ params = {} } = {}) => {
    const { year } = get_default_params({ params })
    return { year }
  }
})

const get_default_params = ({ params = {} } = {}) => {
  const default_params = {
    year: [current_season.year],
    adp_source_id: ['SLEEPER'],
    adp_type: ['PPR_REDRAFT']
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
  const { year } = get_default_params({ params })
  const key = `player_adp_${year.join('_')}`
  return get_table_hash(key)
}

const add_player_adp_with_statement = ({
  query,
  params = {},
  with_table_name,
  where_clauses = [],
  select_strings = [],
  splits = []
}) => {
  const { year, adp_source_id, adp_type } = get_default_params({
    params
  })

  const with_query = db('player_adp_index')
    .select('pid')
    .whereIn('source_id', adp_source_id)
    .whereIn('adp_type', adp_type)
    .whereIn('year', year)

  // Add year to SELECT when splits are included
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

const create_player_adp_field = (field, select_as) => ({
  column_name: field,
  select_as: () => select_as,
  table_name: 'player_adp_index',
  table_alias: generate_table_alias,
  join: data_view_join_function,
  with: add_player_adp_with_statement,
  supported_splits: ['year'],
  with_where: () => `player_adp_index.${field}`,
  get_cache_info
})

export default {
  player_adp: create_player_adp_field('adp', 'adp'),
  player_adp_min: create_player_adp_field('min_pick', 'adp_min'),
  player_adp_max: create_player_adp_field('max_pick', 'adp_max'),
  player_adp_stddev: create_player_adp_field('std_dev', 'adp_stddev'),
  player_adp_sample_size: create_player_adp_field(
    'sample_size',
    'adp_sample_size'
  ),
  player_percent_drafted: create_player_adp_field(
    'percent_drafted',
    'percent_drafted'
  )
}
