import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import { create_season_cache_info } from '#libs-server/data-views/cache-info-utils.mjs'
import { current_season } from '#constants'

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

const get_cache_info = create_season_cache_info({
  get_params: ({ params = {} } = {}) => {
    const { year } = get_default_params({ params })
    return { year }
  }
})

const generate_table_alias = ({ params = {} } = {}) => {
  const { year } = get_default_params({ params })
  const key = `player_adp_${year.join('_')}`
  return get_table_hash(key)
}

const player_adp_source = {
  table: 'player_adp_index',
  grain: 'player_year',
  key_columns: { pid: 'pid', year: 'year' },
  year_default: (params) => get_default_params({ params }).year,
  extra_predicates: (params) => {
    const { adp_source_id, adp_type } = get_default_params({ params })
    return [
      { column: 'source_id', op: 'in', value: adp_source_id },
      { column: 'adp_type', op: 'in', value: adp_type }
    ]
  }
}

const create_player_adp_field = (field, select_as) => ({
  column_name: field,
  select_as: () => select_as,
  table_alias: generate_table_alias,
  source: player_adp_source,
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
