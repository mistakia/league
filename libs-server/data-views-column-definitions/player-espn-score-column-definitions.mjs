import db from '#db'
import data_view_join_function from '#libs-server/data-views/data-view-join-function.mjs'
import { constants } from '#libs-shared'

const get_default_params = ({ params = {} } = {}) => {
  let year = params.year || constants.season.stats_season_year
  if (Array.isArray(year)) {
    year = year[0]
  }
  return { year: Number(year) }
}

const get_valid_year = (year) => {
  const parsed_year = Number(year)
  return parsed_year >= 2017 && parsed_year <= 2023 ? parsed_year : 2023
}

const get_cache_info_for_espn_score = ({ params = {} } = {}) => {
  const { year } = get_default_params({ params })
  if (year === constants.season.year) {
    return {
      cache_ttl: 1000 * 60 * 60 * 6, // 6 hours
      // TODO should expire before the next game starts
      cache_expire_at: null
    }
  } else {
    return {
      cache_ttl: 1000 * 60 * 60 * 24 * 30, // 30 days
      cache_expire_at: null
    }
  }
}

const espn_score_join = (options) => {
  data_view_join_function({
    ...options,
    additional_conditions: function ({
      table_name,
      params,
      splits,
      year_split_join_clause
    }) {
      this.andOn(`${table_name}.seas_type`, '=', db.raw('?', ['REG']))

      if (!splits.includes('year') && !year_split_join_clause) {
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

const create_espn_score_columns = (column_name) => ({
  table_name: 'player_seasonlogs',
  column_name,
  join: espn_score_join,
  supported_splits: ['year'],
  get_cache_info: get_cache_info_for_espn_score
})

export default {
  player_espn_open_score: create_espn_score_columns('espn_open_score'),
  player_espn_catch_score: create_espn_score_columns('espn_catch_score'),
  player_espn_overall_score: create_espn_score_columns('espn_overall_score'),
  player_espn_yac_score: create_espn_score_columns('espn_yac_score')
}
