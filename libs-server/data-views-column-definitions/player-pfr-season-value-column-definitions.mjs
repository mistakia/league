import db from '#db'
import data_view_join_function from '#libs-server/data-views/data-view-join-function.mjs'
import { constants } from '#libs-shared'
import { create_exact_year_cache_info } from '#libs-server/data-views/cache-info-utils.mjs'

const get_default_params = ({ params = {} } = {}) => {
  let year = params.year || constants.season.stats_season_year
  if (Array.isArray(year)) {
    year = year[0]
  }
  return { year: Number(year) }
}

const get_valid_year = (year) => {
  const parsed_year = Number(year)
  return parsed_year >= 2017 &&
    parsed_year <= constants.season.stats_season_year
    ? parsed_year
    : constants.season.stats_season_year
}

const get_cache_info_for_pfr_season_value = create_exact_year_cache_info({
  get_year: (params) => get_default_params({ params }).year
})

const pfr_season_value_join = (options) => {
  data_view_join_function({
    ...options,
    additional_conditions: function ({
      table_name,
      params,
      splits,
      data_view_options
    }) {
      this.andOn(`${table_name}.seas_type`, '=', db.raw('?', ['REG']))

      if (!splits.includes('year')) {
        const year = get_valid_year(params.year)
        this.andOn(`${table_name}.year`, '=', year)
      }

      if (params.career_year) {
        this.andOn(
          `${table_name}.career_year`,
          '>=',
          Math.min(params.career_year[0], params.career_year[1])
        ).andOn(
          `${table_name}.career_year`,
          '<=',
          Math.max(params.career_year[0], params.career_year[1])
        )
      }
    }
  })
}

export default {
  player_pfr_season_value: {
    table_name: 'player_seasonlogs',
    column_name: 'pfr_season_value',
    join: pfr_season_value_join,
    supported_splits: ['year'],
    get_cache_info: get_cache_info_for_pfr_season_value
  }
}
