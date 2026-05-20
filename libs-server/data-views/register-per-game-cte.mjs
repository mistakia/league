import {
  get_per_game_cte_table_name,
  add_per_game_cte
} from '#libs-server/data-views/rate-type/rate-type-per-game.mjs'

// Two-set guard: applied_output_ctes signals Tier-3 plugin ownership (also gates
// join emission); registered_per_game_ctes prevents duplicate WITH injection.
export const register_per_game_cte = ({
  query,
  params,
  splits,
  data_view_options
}) => {
  const table_name = get_per_game_cte_table_name({ params })
  const query_context = data_view_options.query_context
  if (!query_context) return
  if (!query_context.registered_per_game_ctes) {
    query_context.registered_per_game_ctes = new Set()
  }
  if (query_context.applied_output_ctes?.has(table_name)) return
  if (query_context.registered_per_game_ctes.has(table_name)) return
  add_per_game_cte({
    players_query: query,
    params,
    rate_type_table_name: table_name,
    splits,
    query_context
  })
  query_context.registered_per_game_ctes.add(table_name)
}
