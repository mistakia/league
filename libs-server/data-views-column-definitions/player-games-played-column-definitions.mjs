import db from '#db'
import {
  get_per_game_cte_table_name,
  add_per_game_cte,
  join_per_game_cte
} from '#libs-server/data-views/rate-type/rate-type-per-game.mjs'
import { get_cache_info_for_fields_from_plays } from '#libs-server/data-views/get-cache-info-for-fields-from-plays.mjs'

const games_played_join = ({
  data_view_options,
  table_name,
  query,
  params,
  splits,
  year_split_join_clause
}) => {
  const already_added_for_per_game_rate_type =
    data_view_options.rate_type_tables[table_name]
  if (already_added_for_per_game_rate_type) {
    return
  }

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

export default {
  player_games_played: {
    table_alias: get_per_game_cte_table_name,
    join: games_played_join,
    supported_splits: ['year'],
    select_as: () => 'games_played',
    main_select: ({ table_name, column_index }) => {
      return [
        db.raw(
          `${table_name}.rate_type_total_count as games_played_${column_index}`
        )
      ]
    },
    main_group_by: ({ table_name }) => {
      return [db.raw(`${table_name}.rate_type_total_count`)]
    },
    main_where: ({ table_name }) => {
      return db.raw(`${table_name}.rate_type_total_count`)
    },
    get_cache_info: get_cache_info_for_fields_from_plays
  }
}
