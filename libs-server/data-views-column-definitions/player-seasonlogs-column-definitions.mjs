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

// career_year is only materialized for seasons a player has actually appeared
// in (the career-game-counts generator skips the upcoming season), so under a
// current-season row the column renders blank before the season's first game.
// When the query's year scope includes the current season, project the value a
// player enters the season with: distinct seasons played before the current
// year, plus one. Only emitted when the current season is in scope, so
// past-year-only queries stay byte-identical. Cast the projection to smallint
// so the emitted column keeps career_year's int2 type (node-pg would otherwise
// surface a count's bigint as a string).
const get_career_year_select_expression = ({
  table_name,
  params = {},
  data_view_options = {}
} = {}) => {
  const year_range = data_view_options.year_range
  const year_reference = data_view_options.query_context?.year_reference
  const current_year_in_scope =
    Array.isArray(year_range) && year_range.includes(current_season.year)
  const column_year_is_current =
    !current_year_in_scope &&
    get_default_params({ params }).single_year === current_season.year
  const row_year =
    current_year_in_scope && year_reference
      ? year_reference
      : column_year_is_current
        ? String(current_season.year)
        : null
  if (row_year === null) {
    return `${table_name}.career_year`
  }
  const projected_career_year = `(SELECT (count(DISTINCT projected.season_year) + 1)::smallint FROM player_seasonlogs as projected WHERE projected.pid = player.pid AND projected.season_type = 'REG' AND projected.season_year < ${current_season.year})`
  return `COALESCE(${table_name}.career_year, CASE WHEN ${row_year} = ${current_season.year} THEN ${projected_career_year} END)`
}

export default {
  player_career_year: {
    column_name: 'career_year',
    table_alias: player_seasonlogs_table_alias,
    source: player_seasonlogs_source,
    main_select: ({ column_index, table_name, params, data_view_options }) => [
      `${get_career_year_select_expression({
        table_name,
        params,
        data_view_options
      })} as career_year_${column_index}`
    ],
    main_where: ({ table_name }) => `${table_name}.career_year`,
    main_group_by: ({ table_name, params, data_view_options }) => [
      get_career_year_select_expression({
        table_name,
        params,
        data_view_options
      })
    ],
    column_params: {
      year: single_year,
      seas_type
    },
    get_cache_info: get_cache_info_for_player_seasonlogs
  }
}
