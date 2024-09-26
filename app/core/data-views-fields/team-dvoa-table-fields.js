import COLUMN_GROUPS from './column-groups'
import * as table_constants from 'react-table/src/constants.mjs'
import {
  common_column_params,
  nfl_plays_team_column_params
} from '@libs-shared'

const { single_year } = common_column_params
const { team_unit, matchup_opponent_type } = nfl_plays_team_column_params

const create_dvoa_field = ({
  column_title,
  header_label,
  player_value_path,
  dvoa_type
}) => ({
  column_title,
  column_groups: [COLUMN_GROUPS.DVOA],
  header_label,
  player_value_path,
  size: 70,
  data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
  column_params: {
    year: {
      ...single_year,
      values: [2024, 2023, 2022, 2021, 2020]
    },
    team_unit,
    matchup_opponent_type,
    ...(dvoa_type
      ? {
          dvoa_type: {
            values: dvoa_type,
            data_type: table_constants.TABLE_DATA_TYPES.SELECT,
            default_value: 'total_dvoa',
            single: true
          }
        }
      : {})
  },
  splits: ['year']
})

export default {
  team_unit_adjusted_line_yards: create_dvoa_field({
    column_title: 'Team Adjusted Line Yards',
    header_label: 'Adj Line Yards',
    player_value_path: 'team_adjusted_line_yards'
  }),
  team_unit_power_success: create_dvoa_field({
    column_title: 'Team Power Success',
    header_label: 'Power Success',
    player_value_path: 'team_power_success'
  }),
  team_unit_stuffed_rate: create_dvoa_field({
    column_title: 'Team Stuffed Rate',
    header_label: 'Stuffed Rate',
    player_value_path: 'team_stuffed_rate'
  }),
  team_unit_rushing_second_level_yards: create_dvoa_field({
    column_title: 'Team Second Level Rushing Yards',
    header_label: 'Second Level Yards',
    player_value_path: 'team_second_level_yards'
  }),
  team_unit_rushing_open_field_yards: create_dvoa_field({
    column_title: 'Team Open Field Rushing Yards',
    header_label: 'Open Field Yards',
    player_value_path: 'team_open_field_yards'
  }),
  team_unit_dvoa: create_dvoa_field({
    column_title: 'Team Unit DVOA',
    header_label: 'DVOA',
    player_value_path: 'team_unit_dvoa',
    dvoa_type: [
      'total_dvoa',
      'pass_dvoa',
      'rush_dvoa',
      'home_dvoa',
      'road_dvoa',
      'all_first_down_dvoa',
      'second_and_short_dvoa',
      'second_and_mid_dvoa',
      'second_and_long_dvoa',
      'all_second_down_dvoa',
      'third_and_short_dvoa',
      'third_and_mid_dvoa',
      'third_and_long_dvoa',
      'all_third_down_dvoa',
      'all_plays_dvoa',
      'back_zone_dvoa',
      'deep_zone_dvoa',
      'front_zone_dvoa',
      'mid_zone_dvoa',
      'red_zone_dvoa',
      'red_zone_pass_dvoa',
      'red_zone_rush_dvoa',
      'goal_to_go_dvoa',
      'losing_9_plus_dvoa',
      'tie_or_losing_1_to_8_dvoa',
      'winning_1_to_8_dvoa',
      'winning_9_plus_dvoa',
      'late_and_close_dvoa',
      'first_quarter_dvoa',
      'second_quarter_dvoa',
      'third_quarter_dvoa',
      'fourth_quarter_ot_dvoa',
      'first_half_dvoa',
      'second_half_dvoa',
      'shotgun_dvoa',
      'not_shotgun_dvoa',
      'shotgun_difference_dvoa',
      'first_down_pass_dvoa',
      'first_down_rush_dvoa',
      'first_down_all_dvoa',
      'second_down_pass_dvoa',
      'second_down_rush_dvoa',
      'second_down_all_dvoa',
      'third_fourth_down_pass_dvoa',
      'third_fourth_down_rush_dvoa',
      'third_fourth_down_all_dvoa',
      'all_downs_pass_dvoa',
      'all_downs_rush_dvoa',
      'all_downs_dvoa',
      'team_rush_left_end_dvoa',
      'team_rush_left_tackle_dvoa',
      'team_rush_mid_guard_dvoa',
      'team_rush_right_tackle_dvoa',
      'team_rush_right_end_dvoa'
    ]
  })
}
