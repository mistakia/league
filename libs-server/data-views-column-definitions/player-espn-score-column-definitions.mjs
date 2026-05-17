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

const get_cache_info_for_espn_score = create_exact_year_cache_info({
  get_year: (params) => get_default_params({ params }).year
})

const espn_score_source = {
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

const create_espn_score_columns = (column_name) => ({
  column_name,
  source: espn_score_source,
  get_cache_info: get_cache_info_for_espn_score
})

export default {
  player_espn_open_score: create_espn_score_columns('espn_open_score'),
  player_espn_catch_score: create_espn_score_columns('espn_catch_score'),
  player_espn_overall_score: create_espn_score_columns('espn_overall_score'),
  player_espn_yac_score: create_espn_score_columns('espn_yac_score')
}
