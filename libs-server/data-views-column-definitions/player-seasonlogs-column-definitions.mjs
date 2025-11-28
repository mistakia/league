import db from '#db'
import { current_season } from '#constants'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import data_view_join_function from '#libs-server/data-views/data-view-join-function.mjs'
import { create_exact_year_cache_info } from '#libs-server/data-views/cache-info-utils.mjs'
import { single_year, seas_type } from '#libs-shared/common-column-params.mjs'

const get_default_params = ({ params = {} } = {}) => {
  const year = params.single_year || current_season.stats_season_year
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

const player_seasonlogs_join = (join_arguments) => {
  const additional_conditions = function ({ params, table_name, splits }) {
    const { single_year: year, seas_type: seasType } = get_default_params({
      params
    })

    this.andOn(db.raw(`${table_name}.seas_type = '${seasType}'`))

    if (!splits.includes('year')) {
      this.andOn(db.raw(`${table_name}.year = ${year}`))
    }
  }

  return data_view_join_function({
    ...join_arguments,
    join_table_clause: `player_seasonlogs as ${join_arguments.table_name}`,
    additional_conditions,
    skip_week_split_join: true // Skip automatic week join for week splits
  })
}

export default {
  player_career_year: {
    table_name: 'player_seasonlogs',
    column_name: 'career_year',
    table_alias: player_seasonlogs_table_alias,
    join: player_seasonlogs_join,
    main_select: ({ column_index, table_name }) => [
      `${table_name}.career_year as career_year_${column_index}`
    ],
    main_where: ({ table_name }) => `${table_name}.career_year`,
    main_group_by: ({ table_name }) => [`${table_name}.career_year`],
    supported_splits: ['year', 'week'],
    column_params: {
      single_year,
      seas_type
    },
    get_cache_info: get_cache_info_for_player_seasonlogs
  }
}
