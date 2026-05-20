import {
  get_per_game_cte_table_name,
  join_per_game_cte
} from '#libs-server/data-views/rate-type/rate-type-per-game.mjs'
import { register_per_game_cte } from '#libs-server/data-views/register-per-game-cte.mjs'
import { get_cache_info_for_fields_from_plays } from '#libs-server/data-views/get-cache-info-for-fields-from-plays.mjs'

const games_played_join = ({
  data_view_options,
  table_name,
  query,
  params,
  splits
}) => {
  if (data_view_options.query_context?.applied_output_ctes?.has(table_name)) {
    return
  }
  register_per_game_cte({ query, params, splits, data_view_options })
  join_per_game_cte({
    players_query: query,
    rate_type_table_name: table_name,
    splits,
    params,
    data_view_options
  })
}

export default {
  player_games_played: {
    table_alias: get_per_game_cte_table_name,
    column_name: 'rate_type_total_count',
    register_ctes: register_per_game_cte,
    join: games_played_join,
    source: { grain: 'player_year' },
    select_as: () => 'games_played',
    get_cache_info: get_cache_info_for_fields_from_plays
  }
}
