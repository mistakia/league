import { current_season } from '#constants'
import { create_exact_year_cache_info } from '#libs-server/data-views/cache-info-utils.mjs'

const get_default_params = ({ params = {} } = {}) => {
  let year = params.year || current_season.stats_season_year
  if (Array.isArray(year)) {
    year = year[0]
  }
  return { year: Number(year) }
}

const get_valid_year = (year) => {
  const parsed_year = Number(year)
  return parsed_year >= 2017 && parsed_year <= current_season.stats_season_year
    ? parsed_year
    : current_season.stats_season_year
}

const get_cache_info_for_pfr_season_value = create_exact_year_cache_info({
  get_year: (params) => get_default_params({ params }).year
})

const pfr_season_value_source = {
  table: 'player_seasonlogs',
  grain: 'player_year',
  key_columns: { pid: 'pid', year: 'year' },
  year_default: (params) => get_valid_year(params.year),
  extra_predicates: (params) => {
    const extras = [{ column: 'seas_type', value: 'REG' }]
    if (params.career_year) {
      extras.push({
        column: 'career_year',
        op: 'between',
        value: [
          Math.min(params.career_year[0], params.career_year[1]),
          Math.max(params.career_year[0], params.career_year[1])
        ]
      })
    }
    return extras
  }
}

export default {
  player_pfr_season_value: {
    column_name: 'pfr_season_value',
    source: pfr_season_value_source,
    get_cache_info: get_cache_info_for_pfr_season_value
  }
}
