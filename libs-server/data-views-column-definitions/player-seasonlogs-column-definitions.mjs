import { current_season } from '#constants'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import { create_exact_year_cache_info } from '#libs-server/data-views/cache-info-utils.mjs'
import { single_year, seas_type } from '#libs-shared/common-column-params.mjs'

const get_default_params = ({ params = {} } = {}) => {
  let year_param = params.year || [current_season.stats_season_year]
  if (!Array.isArray(year_param)) {
    year_param = [year_param]
  }
  const year = year_param[0] || current_season.stats_season_year
  const seas_type_param = params.seas_type || 'REG'
  return { single_year: Number(year), seas_type: seas_type_param }
}

const get_cache_info_for_player_seasonlogs = create_exact_year_cache_info({
  get_year: (params) => get_default_params({ params }).single_year
})

const player_seasonlogs_table_alias = ({ params = {} }) => {
  const { single_year: year, seas_type: seasType } = get_default_params({
    params
  })

  return get_table_hash(`player_seasonlogs_${year}_${seasType}`)
}

const player_seasonlogs_source = {
  table: 'player_seasonlogs',
  grain: 'player_year',
  key_columns: { pid: 'pid', year: 'season_year' },
  year_default: (params) => [get_default_params({ params }).single_year],
  extra_predicates: (params) => [
    { column: 'season_type', value: get_default_params({ params }).seas_type }
  ]
}

export default {
  player_career_year: {
    column_name: 'career_year',
    table_alias: player_seasonlogs_table_alias,
    source: player_seasonlogs_source,
    main_select: ({ column_index, table_name }) => [
      `${table_name}.career_year as career_year_${column_index}`
    ],
    main_where: ({ table_name }) => `${table_name}.career_year`,
    main_group_by: ({ table_name }) => [`${table_name}.career_year`],
    column_params: {
      year: single_year,
      seas_type
    },
    get_cache_info: get_cache_info_for_player_seasonlogs
  }
}
