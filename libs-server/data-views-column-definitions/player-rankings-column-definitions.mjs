import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
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

const player_season_rankings_source = {
  table: 'player_rankings_index',
  grain: 'player_year',
  key_columns: { pid: 'pid', year: 'season_year' },
  year_default: (params) => get_season_default_params({ params }).year,
  extra_predicates: (params) => {
    const { ranking_source_id, ranking_type } = get_season_default_params({
      params
    })
    return [
      { column: 'source_id', op: 'in', value: ranking_source_id },
      { column: 'ranking_type', op: 'in', value: ranking_type }
    ]
  }
}

// Range year_offset reduction per column (select-string defaults to SUM).
// Rankings are not additive: the consensus/overall/position ranks and the
// dispersion (std) average across the window; min is the best (lowest) rank
// seen in the window -> MIN, max the worst -> MAX. Summing ranks across years
// is meaningless.
const SEASON_RANKINGS_RANGE_OFFSET_AGGREGATE = {
  avg: 'AVG',
  overall_rank: 'AVG',
  position_rank: 'AVG',
  std: 'AVG',
  min: 'MIN',
  max: 'MAX'
}

const create_player_season_rankings_field = (field, select_as) => ({
  column_name: field,
  select_as: () => select_as,
  table_alias: generate_season_table_alias,
  source: player_season_rankings_source,
  range_offset_aggregate: SEASON_RANKINGS_RANGE_OFFSET_AGGREGATE[field],
  granularity: ['player_year'],
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
