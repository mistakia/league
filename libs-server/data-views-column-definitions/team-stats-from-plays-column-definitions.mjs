import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import data_view_join_function from '#libs-server/data-views/data-view-join-function.mjs'
import { add_team_stats_play_by_play_with_statement } from '#libs-server/data-views/add-team-stats-play-by-play-with-statement.mjs'
import { get_rate_type_sql } from '#libs-server/data-views/select-string.mjs'
import { get_cache_info_for_fields_from_plays } from '#libs-server/data-views/get-cache-info-for-fields-from-plays.mjs'
import get_stats_column_param_key from '#libs-server/data-views/get-stats-column-param-key.mjs'
import { nfl_plays_team_column_params } from '#libs-shared'

const generate_table_alias = ({ params = {} } = {}) => {
  const additional_keys = Object.keys(nfl_plays_team_column_params).sort()
  const key = get_stats_column_param_key({ params, additional_keys })
  return get_table_hash(`team_stats_from_plays__${key}`)
}

const team_stat_from_plays = ({
  select_string,
  stat_name,
  is_rate = false,
  rate_with_selects,
  supported_rate_types = [
    'per_game',
    'per_team_half',
    'per_team_quarter',
    'per_team_play',
    'per_team_pass_play',
    'per_team_rush_play',
    'per_team_drive',
    'per_team_series'
  ]
}) => ({
  table_alias: generate_table_alias,
  column_name: stat_name,
  with_select: () =>
    is_rate ? rate_with_selects : [`${select_string} AS ${stat_name}`],
  with_where: ({ table_name, params }) => {
    if (is_rate) {
      return `sum(${table_name}.${stat_name}_numerator) / NULLIF(sum(${table_name}.${stat_name}_denominator), 0)`
    }

    // should be handled in main where
    if (params.rate_type && params.rate_type.length) {
      return null
    }

    return `sum(${table_name}.${stat_name})`
  },
  main_where: ({
    table_name,
    params,
    column_id,
    column_index,
    rate_type_column_mapping
  }) => {
    if (is_rate) {
      return null
    }

    if (params.rate_type && params.rate_type.length) {
      const rate_type_table_name =
        rate_type_column_mapping[`${column_id}_${column_index}`]
      return get_rate_type_sql({
        table_name: `${table_name}_player_team_stats`,
        column_name: stat_name,
        rate_type_table_name
      })
    }

    return null
  },
  with: add_team_stats_play_by_play_with_statement,
  join_table_name: (args) => {
    const limit_to_player_active_games =
      args.params?.limit_to_player_active_games || false
    return limit_to_player_active_games
      ? `${args.table_name}_player_team_stats`
      : `${args.table_name}_team_stats`
  },
  join: (args) => {
    const limit_to_player_active_games =
      args.params?.limit_to_player_active_games || false
    data_view_join_function({
      ...args,
      join_year_on_year_split: true,
      join_on_team: !limit_to_player_active_games,
      table_name: limit_to_player_active_games
        ? `${args.table_name}_player_team_stats`
        : `${args.table_name}_team_stats`
    })
  },
  year_select: ({ table_name, column_params = {} }) => {
    const table_suffix = column_params.limit_to_player_active_games
      ? '_player_team_stats'
      : '_team_stats'
    if (!column_params.year_offset) {
      return `${table_name}${table_suffix}.year`
    }

    const year_offset = Array.isArray(column_params.year_offset)
      ? column_params.year_offset[0]
      : column_params.year_offset

    return `${table_name}${table_suffix}.year - ${year_offset}`
  },
  week_select: ({ table_name, column_params = {} }) => {
    const table_suffix = column_params.limit_to_player_active_games
      ? '_player_team_stats'
      : '_team_stats'
    return `${table_name}${table_suffix}.week`
  },
  use_having: true,
  supported_splits: ['year', 'week'],
  supported_rate_types,
  is_rate,
  get_cache_info: get_cache_info_for_fields_from_plays,
  is_team: true
})

export default {
  team_pass_yards_from_plays: team_stat_from_plays({
    select_string: `SUM(pass_yds)`,
    stat_name: 'team_pass_yds_from_plays'
  }),
  team_pass_rate_over_expected_from_plays: team_stat_from_plays({
    select_string: `AVG(pass_oe)`,
    stat_name: 'team_pass_rate_over_expected_from_plays',
    supported_rate_types: []
  }),
  team_completion_percentage_over_expected_from_plays: team_stat_from_plays({
    select_string: `AVG(cpoe)`,
    stat_name: 'team_completion_percentage_over_expected_from_plays',
    supported_rate_types: []
  }),
  team_pass_attempts_from_plays: team_stat_from_plays({
    select_string: `SUM(CASE WHEN psr_pid IS NOT NULL AND (sk IS NULL OR sk = false) THEN 1 ELSE 0 END)`,
    stat_name: 'team_pass_att_from_plays'
  }),
  team_pass_completions_from_plays: team_stat_from_plays({
    select_string: `SUM(CASE WHEN comp = true THEN 1 ELSE 0 END)`,
    stat_name: 'team_pass_comp_from_plays'
  }),
  team_pass_touchdowns_from_plays: team_stat_from_plays({
    select_string: `SUM(CASE WHEN pass_td = true THEN 1 ELSE 0 END)`,
    stat_name: 'team_pass_td_from_plays'
  }),
  team_pass_air_yards_from_plays: team_stat_from_plays({
    select_string: `SUM(dot)`,
    stat_name: 'team_pass_air_yds_from_plays'
  }),
  team_yards_after_catch_from_plays: team_stat_from_plays({
    select_string: `SUM(yards_after_catch)`,
    stat_name: 'team_yards_after_catch_from_plays'
  }),
  team_rush_yards_from_plays: team_stat_from_plays({
    select_string: `SUM(rush_yds)`,
    stat_name: 'team_rush_yds_from_plays'
  }),
  team_rush_attempts_from_plays: team_stat_from_plays({
    select_string: `COUNT(CASE WHEN bc_pid IS NOT NULL THEN 1 ELSE NULL END)`,
    stat_name: 'team_rush_att_from_plays'
  }),
  team_rush_touchdowns_from_plays: team_stat_from_plays({
    select_string: `SUM(CASE WHEN rush_td = true THEN 1 ELSE 0 END)`,
    stat_name: 'team_rush_td_from_plays'
  }),
  team_expected_points_added_from_plays: team_stat_from_plays({
    select_string: `SUM(epa)`,
    stat_name: 'team_ep_added_from_plays'
  }),
  team_win_percentage_added_from_plays: team_stat_from_plays({
    select_string: `SUM(wpa)`,
    stat_name: 'team_wp_added_from_plays'
  }),
  team_success_rate_from_plays: team_stat_from_plays({
    rate_with_selects: [
      `SUM(CASE WHEN successful_play = true THEN 1 ELSE 0 END) as team_success_rate_from_plays_numerator`,
      `COUNT(*) as team_success_rate_from_plays_denominator`
    ],
    stat_name: 'team_success_rate_from_plays',
    is_rate: true,
    supported_rate_types: []
  }),
  team_expected_points_success_rate_from_plays: team_stat_from_plays({
    rate_with_selects: [
      `SUM(CASE WHEN ep_succ = true THEN 1 ELSE 0 END) as team_expected_points_success_rate_from_plays_numerator`,
      `COUNT(*) as team_expected_points_success_rate_from_plays_denominator`
    ],
    stat_name: 'team_expected_points_success_rate_from_plays',
    is_rate: true,
    supported_rate_types: []
  }),
  team_explosive_play_rate_from_plays: team_stat_from_plays({
    rate_with_selects: [
      `SUM(CASE WHEN pass_yds >= 20 OR rush_yds >= 10 THEN 1 ELSE 0 END) as team_explosive_play_rate_from_plays_numerator`,
      `COUNT(*) as team_explosive_play_rate_from_plays_denominator`
    ],
    stat_name: 'team_explosive_play_rate_from_plays',
    is_rate: true,
    supported_rate_types: []
  }),
  team_play_count_from_plays: team_stat_from_plays({
    select_string: `COUNT(*)`,
    stat_name: 'team_play_count_from_plays'
  }),
  team_series_count_from_plays: team_stat_from_plays({
    select_string: `COUNT(DISTINCT CONCAT(esbid, '_', series_seq))`,
    stat_name: 'team_series_count_from_plays'
  }),
  team_drive_count_from_plays: team_stat_from_plays({
    select_string: `COUNT(DISTINCT CONCAT(esbid, '_', drive_seq))`,
    stat_name: 'team_drive_count_from_plays'
  }),
  team_offensive_play_count_from_plays: team_stat_from_plays({
    select_string: `COUNT(CASE WHEN play_type IN ('PASS', 'RUSH') THEN 1 ELSE NULL END)`,
    stat_name: 'team_offensive_play_count_from_plays'
  }),

  team_yards_created_from_plays: team_stat_from_plays({
    select_string: `SUM(yards_created)`,
    stat_name: 'team_yards_created_from_plays'
  }),
  team_yards_blocked_from_plays: team_stat_from_plays({
    select_string: `SUM(yards_blocked)`,
    stat_name: 'team_yards_blocked_from_plays'
  }),

  team_series_conversion_rate_from_plays: team_stat_from_plays({
    rate_with_selects: [
      `COUNT(DISTINCT CASE WHEN series_result IN ('FIRST_DOWN', 'TOUCHDOWN') THEN CONCAT(esbid, '_', series_seq) END) as team_series_conversion_rate_from_plays_numerator`,
      `COUNT(DISTINCT CASE WHEN series_result NOT IN ('QB_KNEEL', 'END_OF_HALF') THEN CONCAT(esbid, '_', series_seq) END) as team_series_conversion_rate_from_plays_denominator`
    ],
    stat_name: 'team_series_conversion_rate_from_plays',
    is_rate: true,
    supported_rate_types: []
  })
}
