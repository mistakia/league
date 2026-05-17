import db from '#db'
import {
  get_per_player_play_cte_table_name,
  add_per_player_play_cte,
  join_per_player_play_cte
} from '#libs-server/data-views/rate-type/rate-type-per-player-play.mjs'
import { get_cache_info_for_fields_from_plays } from '#libs-server/data-views/get-cache-info-for-fields-from-plays.mjs'
import { get_rate_type_sql } from '#libs-server/data-views/select-string.mjs'

const apply_player_snaps_attach = ({
  query_context,
  params,
  table_alias,
  splits
}) => {
  if (query_context.applied_output_ctes?.has(table_alias)) {
    return
  }

  const { players_query, data_view_options } = query_context

  add_per_player_play_cte({
    players_query,
    params,
    rate_type_table_name: table_alias,
    splits,
    data_view_options
  })

  join_per_player_play_cte({
    players_query,
    rate_type_table_name: table_alias,
    splits,
    params,
    data_view_options
  })
}

const player_snaps_source = {
  grain: 'player_year',
  attach: apply_player_snaps_attach
}

export default {
  player_snaps: {
    table_alias: get_per_player_play_cte_table_name,
    source: player_snaps_source,
    column_name: 'player_snaps',
    select_as: () => 'player_snaps',
    measure_source: 'snaps',
    measure_expr: () => '1',
    supports_output: {
      periods: [
        'game',
        'season',
        'team_play',
        'team_pass_play',
        'team_rush_play',
        'team_half',
        'team_quarter',
        'team_drive',
        'team_series'
      ],
      aggregations: ['rate', 'count']
    },
    main_select: ({ table_name, column_index, rate_type_table_name }) => {
      const select_expression = rate_type_table_name
        ? get_rate_type_sql({
            table_name,
            column_name: 'rate_type_total_count',
            rate_type_table_name
          })
        : `${table_name}.rate_type_total_count`
      return [db.raw(`${select_expression} as player_snaps_${column_index}`)]
    },
    main_group_by: ({ table_name, rate_type_table_name }) => {
      const group_bys = [db.raw(`${table_name}.rate_type_total_count`)]
      if (rate_type_table_name) {
        group_bys.push(db.raw(`${rate_type_table_name}.rate_type_total_count`))
      }
      return group_bys
    },
    main_where: ({ table_name, rate_type_table_name }) => {
      const where_expression = rate_type_table_name
        ? get_rate_type_sql({
            table_name,
            column_name: 'rate_type_total_count',
            rate_type_table_name
          })
        : `${table_name}.rate_type_total_count`
      return db.raw(where_expression)
    },
    get_cache_info: get_cache_info_for_fields_from_plays,
    supported_rate_types: [
      'per_game',
      'per_team_half',
      'per_team_quarter',
      'per_team_play',
      'per_team_pass_play',
      'per_team_rush_play',
      'per_team_drive',
      'per_team_series'
    ]
  }
}
