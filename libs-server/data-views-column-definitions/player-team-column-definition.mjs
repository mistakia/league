import {
  get_per_game_cte_table_name,
  add_per_game_cte,
  join_per_game_cte
} from '#libs-server/data-views/rate-type/rate-type-per-game.mjs'
import { constants } from '#libs-shared'

const get_default_params = ({ params = {} } = {}) => {
  let year = params.year || []
  if (!Array.isArray(year)) {
    year = [year]
  }

  let week = params.week || []
  if (!Array.isArray(week)) {
    week = [week]
  }
  return { year, week }
}

const get_cache_info = () => ({
  cache_ttl: 1000 * 60 * 60 * 24 * 7, // 1 week
  cache_expire_at: null
})

export default {
  player_nfl_teams: {
    is_array_column: true,
    table_alias: ({ params = {}, splits = [] } = {}) => {
      const { year } = get_default_params({ params })
      if (
        (year.length === 1 && year[0] !== constants.season.year) ||
        splits.length
      ) {
        return get_per_game_cte_table_name({ params })
      }
      return 'player'
    },
    main_select: ({ table_name, params, column_index, splits }) => {
      const { year } = get_default_params({ params })
      if (
        (year.length === 1 && year[0] !== constants.season.year) ||
        splits.length
      ) {
        return [`${table_name}.teams as player_nfl_teams_${column_index}`]
      }
      return [`player.current_nfl_team as player_nfl_teams_${column_index}`]
    },
    main_where: ({ table_name, params, column_index, splits }) => {
      const { year } = get_default_params({ params })
      if (
        (year.length === 1 && year[0] !== constants.season.year) ||
        splits.length
      ) {
        return `${table_name}.teams`
      }
      return 'player.current_nfl_team'
    },
    main_group_by: ({ table_name, params, column_index, splits }) => {
      const { year } = get_default_params({ params })
      if (
        (year.length === 1 && year[0] !== constants.season.year) ||
        splits.length
      ) {
        return [`${table_name}.teams`]
      }
      return ['player.current_nfl_team']
    },
    join: ({
      query,
      table_name,
      params,
      splits,
      data_view_options,
      year_split_join_clause
    }) => {
      const already_added_for_per_game_rate_type =
        data_view_options.rate_type_tables[table_name]
      if (already_added_for_per_game_rate_type) {
        return
      }
      const { year } = get_default_params({ params })
      if (
        (year.length === 1 && year[0] !== constants.season.year) ||
        splits.length
      ) {
        add_per_game_cte({
          players_query: query,
          params,
          rate_type_table_name: table_name,
          splits
        })
        join_per_game_cte({
          players_query: query,
          rate_type_table_name: table_name,
          splits,
          year_split_join_clause,
          params
        })
      }
    },
    get_cache_info,
    supported_splits: ['year', 'week']
  }
}
