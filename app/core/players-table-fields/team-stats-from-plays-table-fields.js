import * as table_constants from 'react-table/src/constants.mjs'

import COLUMN_GROUPS from './column-groups'
import { nfl_plays_column_params, rate_type_column_param } from '@libs-shared'

const from_play_field = (field) => ({
  data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
  column_params: {
    rate_type: rate_type_column_param,
    ...nfl_plays_column_params
  },
  size: 70,
  fixed: 2,
  splits: ['year'],
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
  })
}
