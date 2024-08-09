import get_table_hash from '#libs-server/get-table-hash.mjs'
import nfl_plays_column_params from '#libs-shared/nfl-plays-column-params.mjs'
import players_table_join_function from '#libs-server/players-table/players-table-join-function.mjs'
import { add_team_stats_play_by_play_with_statement } from '#libs-server/players-table/add-team-stats-play-by-play-with-statement.mjs'
import { get_rate_type_sql } from '#libs-server/players-table/select-string.mjs'

const generate_table_alias = ({ params = {} } = {}) => {
  const column_param_keys = Object.keys(nfl_plays_column_params).sort()
  const key = column_param_keys
    .map((key) => {
      const value = params[key]
      return Array.isArray(value)
        ? `${key}${value.sort().join('')}`
        : `${key}${value || ''}`
    })
    .join('')

  return get_table_hash(`team_stats_from_plays__${key}`)
}

const team_stat_from_plays = ({
  select_string,
  stat_name,
  is_rate = false,
  rate_with_selects
}) => ({
  table_alias: generate_table_alias,
  column_name: stat_name,
  with_select: () =>
    is_rate ? rate_with_selects : [`${select_string} AS ${stat_name}`],
  with_where: ({ table_name, params }) => {
    if (is_rate) {
      return `sum(${table_name}.${stat_name}_numerator) / sum(${table_name}.${stat_name}_denominator)`
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
  join_table_name: (args) => `${args.table_name}_player_team_stats`,
  join: (args) =>
    players_table_join_function({
      ...args,
      join_year_on_year_split: true,
      table_name: `${args.table_name}_player_team_stats`
    }),
  year_select: ({ table_name, column_params = {} }) => {
    if (!column_params.year_offset) {
      return `${table_name}_player_team_stats.year`
    }

    const year_offset = Array.isArray(column_params.year_offset)
      ? column_params.year_offset[0]
      : column_params.year_offset

    return `${table_name}_player_team_stats.year - ${year_offset}`
  },
  week_select: ({ table_name }) => `${table_name}_player_team_stats.week`,
  use_having: true,
  supported_splits: ['year', 'week'],
  supported_rate_types: ['per_game'],
  is_rate
})

export default {
  team_pass_yards_from_plays: team_stat_from_plays({
    select_string: `SUM(pass_yds)`,
    stat_name: 'team_pass_yds_from_plays'
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
    select_string: `SUM(CASE WHEN td = true THEN 1 ELSE 0 END)`,
    stat_name: 'team_pass_td_from_plays'
  }),
  team_pass_air_yards_from_plays: team_stat_from_plays({
    select_string: `SUM(dot)`,
    stat_name: 'team_pass_air_yds_from_plays'
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
    select_string: `SUM(CASE WHEN td = true AND bc_pid IS NOT NULL THEN 1 ELSE 0 END)`,
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
      `SUM(CASE WHEN succ = true THEN 1 ELSE 0 END) as team_success_rate_from_plays_numerator`,
      `COUNT(*) as team_success_rate_from_plays_denominator`
    ],
    stat_name: 'team_success_rate_from_plays',
    is_rate: true
  }),
  team_explosive_play_rate_from_plays: team_stat_from_plays({
    rate_with_selects: [
      `SUM(CASE WHEN pass_yds >= 20 OR rush_yds >= 10 THEN 1 ELSE 0 END) as team_explosive_play_rate_from_plays_numerator`,
      `COUNT(*) as team_explosive_play_rate_from_plays_denominator`
    ],
    stat_name: 'team_explosive_play_rate_from_plays',
    is_rate: true
  }),
  team_play_count_from_plays: team_stat_from_plays({
    select_string: `COUNT(*)`,
    stat_name: 'team_play_count_from_plays'
  })
}
