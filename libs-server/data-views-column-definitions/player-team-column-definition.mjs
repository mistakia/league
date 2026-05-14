import {
  get_per_game_cte_table_name,
  add_per_game_cte,
  join_per_game_cte
} from '#libs-server/data-views/rate-type/rate-type-per-game.mjs'
import { create_static_cache_info } from '#libs-server/data-views/cache-info-utils.mjs'
import resolve_nfl_week_id_from_year_param from '#libs-server/data-views/resolve-nfl-week-id-from-year-param.mjs'

const get_default_params = ({ params = {} } = {}) => {
  const nfl_week_id = resolve_nfl_week_id_from_year_param(params)

  let career_year = params.career_year || []
  if (!Array.isArray(career_year)) career_year = [career_year]

  let career_game = params.career_game || []
  if (!Array.isArray(career_game)) career_game = [career_game]

  return { nfl_week_id, career_year, career_game }
}

const should_use_cte = ({ params = {}, splits = [] } = {}) => {
  const { nfl_week_id, career_year, career_game } = get_default_params({
    params
  })
  return (
    nfl_week_id.length > 0 ||
    career_year.length > 0 ||
    career_game.length > 0 ||
    splits.length > 0
  )
}

const get_cache_info = create_static_cache_info()

export default {
  player_nfl_teams: {
    is_where_column_array: ({ params = {}, splits = [] } = {}) =>
      should_use_cte({ params, splits }),
    table_alias: ({ params = {}, splits = [] } = {}) => {
      if (should_use_cte({ params, splits })) {
        return get_per_game_cte_table_name({ params })
      }
      return 'player'
    },
    main_select: ({ table_name, params, column_index, splits }) => {
      if (should_use_cte({ params, splits })) {
        return [`${table_name}.teams as player_nfl_teams_${column_index}`]
      }
      return [`player.current_nfl_team as player_nfl_teams_${column_index}`]
    },
    main_where: ({ table_name, params, column_index, splits }) => {
      if (should_use_cte({ params, splits })) {
        return `${table_name}.teams`
      }
      return 'player.current_nfl_team'
    },
    main_group_by: ({ table_name, params, column_index, splits }) => {
      if (should_use_cte({ params, splits })) {
        return [`${table_name}.teams`]
      }
      return ['player.current_nfl_team']
    },
    join: ({ query, table_name, params, splits, data_view_options }) => {
      const already_added_for_per_game_rate_type =
        data_view_options.query_context?.applied_output_ctes?.has(table_name)
      if (already_added_for_per_game_rate_type) {
        return
      }
      if (should_use_cte({ params, splits })) {
        add_per_game_cte({
          players_query: query,
          params,
          rate_type_table_name: table_name,
          splits,
          data_view_options
        })
        join_per_game_cte({
          players_query: query,
          rate_type_table_name: table_name,
          splits,
          params,
          data_view_options
        })
      }
    },
    get_cache_info,
    supported_splits: ['year', 'week'],
    granularity: ['player_year', 'player_year_week']
  }
}
