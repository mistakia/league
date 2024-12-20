import * as table_constants from 'react-table/src/constants.mjs'

import COLUMN_GROUPS from './column-groups'
import {
  nfl_plays_column_params,
  rate_type_column_param,
  nfl_plays_team_column_params
} from '@libs-shared'

const from_play_field = (field) => ({
  data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
  column_params: {
    ...nfl_plays_team_column_params,
    rate_type: rate_type_column_param.offensive_rate_type_param,
    ...nfl_plays_column_params
  },
  size: 70,
  fixed: 2,
  splits: ['year', 'week'],
  ...field
})

export default {
  team_pass_yards_from_plays: from_play_field({
    column_title: 'Team Passing Yards (By Play)',
    column_groups: [COLUMN_GROUPS.TEAM_STATS, COLUMN_GROUPS.PASSING],
    header_label: 'YDS',
    player_value_path: 'team_pass_yds_from_plays'
  }),
  team_pass_attempts_from_plays: from_play_field({
    column_title: 'Team Passing Attempts (By Play)',
    column_groups: [COLUMN_GROUPS.TEAM_STATS, COLUMN_GROUPS.PASSING],
    header_label: 'ATT',
    player_value_path: 'team_pass_att_from_plays'
  }),
  // TODO prevent showing rate_type param for this field
  team_pass_rate_over_expected_from_plays: from_play_field({
    column_title: 'Team Passing Rate Over Expected (By Play)',
    column_groups: [COLUMN_GROUPS.TEAM_STATS, COLUMN_GROUPS.PASSING],
    header_label: 'PROE',
    player_value_path: 'team_pass_rate_over_expected_from_plays'
  }),
  // TODO prevent showing rate_type param for this field
  team_completion_percentage_over_expected_from_plays: from_play_field({
    column_title: 'Team Completion Percentage Over Expected (By Play)',
    column_groups: [COLUMN_GROUPS.TEAM_STATS, COLUMN_GROUPS.PASSING],
    header_label: 'CPOE',
    player_value_path: 'team_completion_percentage_over_expected_from_plays'
  }),
  team_pass_completions_from_plays: from_play_field({
    column_title: 'Team Passing Completions (By Play)',
    column_groups: [COLUMN_GROUPS.TEAM_STATS, COLUMN_GROUPS.PASSING],
    header_label: 'COMP',
    player_value_path: 'team_pass_comp_from_plays'
  }),
  team_pass_touchdowns_from_plays: from_play_field({
    column_title: 'Team Passing Touchdowns (By Play)',
    column_groups: [COLUMN_GROUPS.TEAM_STATS, COLUMN_GROUPS.PASSING],
    header_label: 'TD',
    player_value_path: 'team_pass_td_from_plays'
  }),
  team_pass_air_yards_from_plays: from_play_field({
    column_title: 'Team Passing Air Yards (By Play)',
    column_groups: [COLUMN_GROUPS.TEAM_STATS, COLUMN_GROUPS.PASSING],
    header_label: 'AY',
    player_value_path: 'team_pass_air_yds_from_plays'
  }),
  team_yards_after_catch_from_plays: from_play_field({
    column_title: 'Team Yards After Catch (By Play)',
    column_groups: [COLUMN_GROUPS.TEAM_STATS, COLUMN_GROUPS.RECEIVING],
    header_label: 'YAC',
    player_value_path: 'team_yards_after_catch_from_plays'
  }),
  team_rush_yards_from_plays: from_play_field({
    column_title: 'Team Rushing Yards (By Play)',
    column_groups: [COLUMN_GROUPS.TEAM_STATS, COLUMN_GROUPS.RUSHING],
    header_label: 'YDS',
    player_value_path: 'team_rush_yds_from_plays'
  }),
  team_rush_attempts_from_plays: from_play_field({
    column_title: 'Team Rushing Attempts (By Play)',
    column_groups: [COLUMN_GROUPS.TEAM_STATS, COLUMN_GROUPS.RUSHING],
    header_label: 'ATT',
    player_value_path: 'team_rush_att_from_plays'
  }),
  team_rush_touchdowns_from_plays: from_play_field({
    column_title: 'Team Rushing Touchdowns (By Play)',
    column_groups: [COLUMN_GROUPS.TEAM_STATS, COLUMN_GROUPS.RUSHING],
    header_label: 'TD',
    player_value_path: 'team_rush_td_from_plays'
  }),
  team_expected_points_added_from_plays: from_play_field({
    column_title: 'Team Expected Points Added (By Play)',
    column_groups: [COLUMN_GROUPS.TEAM_STATS, COLUMN_GROUPS.ADVANCED],
    header_label: 'EPA',
    player_value_path: 'team_ep_added_from_plays'
  }),
  team_win_percentage_added_from_plays: from_play_field({
    column_title: 'Team Win Percentage Added (By Play)',
    column_groups: [COLUMN_GROUPS.TEAM_STATS, COLUMN_GROUPS.ADVANCED],
    header_label: 'WPA',
    player_value_path: 'team_wp_added_from_plays'
  }),
  team_success_rate_from_plays: from_play_field({
    column_title: 'Team Success Rate (By Play)',
    column_groups: [COLUMN_GROUPS.TEAM_STATS, COLUMN_GROUPS.ADVANCED],
    header_label: 'SR',
    player_value_path: 'team_success_rate_from_plays'
  }),
  team_expected_points_success_rate_from_plays: from_play_field({
    column_title: 'Team Expected Points Success Rate (By Play)',
    column_groups: [COLUMN_GROUPS.TEAM_STATS, COLUMN_GROUPS.ADVANCED],
    header_label: 'EPSR',
    player_value_path: 'team_expected_points_success_rate_from_plays'
  }),
  team_explosive_play_rate_from_plays: from_play_field({
    column_title: 'Team Explosive Play Rate (By Play)',
    column_groups: [COLUMN_GROUPS.TEAM_STATS, COLUMN_GROUPS.ADVANCED],
    header_label: 'EPR',
    player_value_path: 'team_explosive_play_rate_from_plays'
  }),
  team_play_count_from_plays: from_play_field({
    column_title: 'Team Total Play Count (By Play)',
    column_groups: [COLUMN_GROUPS.TEAM_STATS],
    header_label: 'PLAYS',
    player_value_path: 'team_play_count_from_plays'
  }),
  team_series_count_from_plays: from_play_field({
    column_title: 'Team Series Count (By Play)',
    column_groups: [COLUMN_GROUPS.TEAM_STATS],
    header_label: 'SERIES',
    player_value_path: 'team_series_count_from_plays'
  }),
  team_drive_count_from_plays: from_play_field({
    column_title: 'Team Drive Count (By Play)',
    column_groups: [COLUMN_GROUPS.TEAM_STATS],
    header_label: 'DRIVES',
    player_value_path: 'team_drive_count_from_plays'
  }),
  team_offensive_play_count_from_plays: from_play_field({
    column_title: 'Team Offensive Play Count (By Play)',
    column_groups: [COLUMN_GROUPS.TEAM_STATS],
    header_label: 'OFF PLAYS',
    player_value_path: 'team_offensive_play_count_from_plays'
  }),
  team_yards_created_from_plays: from_play_field({
    column_title: 'Team Yards Created (By Play)',
    column_groups: [COLUMN_GROUPS.TEAM_STATS, COLUMN_GROUPS.RUSHING],
    header_label: 'YC',
    player_value_path: 'team_yards_created_from_plays'
  }),
  team_yards_blocked_from_plays: from_play_field({
    column_title: 'Team Yards Blocked (By Play)',
    column_groups: [COLUMN_GROUPS.TEAM_STATS, COLUMN_GROUPS.RUSHING],
    header_label: 'YB',
    player_value_path: 'team_yards_blocked_from_plays'
  }),

  team_series_conversion_rate_from_plays: from_play_field({
    column_title: 'Team Series Conversion Rate (By Play)',
    column_groups: [COLUMN_GROUPS.TEAM_STATS, COLUMN_GROUPS.EFFICIENCY],
    header_label: 'SCR',
    player_value_path: 'team_series_conversion_rate_from_plays'
  })
}
