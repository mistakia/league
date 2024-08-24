import * as table_constants from 'react-table/src/constants.mjs'

import COLUMN_GROUPS from './column-groups'
import { nfl_plays_column_params, rate_type_column_param } from '@libs-shared'

const from_play_field = (field) => ({
  data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
  column_params: {
    rate_type: rate_type_column_param.player_rate_type_param,
    ...nfl_plays_column_params
  },
  size: 70,
  fixed: 2,
  splits: ['year', 'week'],
  ...field
})

const from_defensive_play_field = (field) => ({
  ...from_play_field(field),
  column_params: {
    rate_type: rate_type_column_param.defensive_rate_type_param,
    ...nfl_plays_column_params
  }
})

const from_share_field = (field) => ({
  data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
  column_params: nfl_plays_column_params,
  size: 70,
  splits: ['year', 'week'],
  ...field
})

export default {
  player_pass_yards_from_plays: from_play_field({
    column_title: 'Passing Yards (By Play)',
    column_groups: [COLUMN_GROUPS.PASSING],
    header_label: 'YDS',
    player_value_path: 'pass_yds_from_plays'
  }),
  player_pass_attempts_from_plays: from_play_field({
    column_title: 'Passing Attempts (By Play)',
    column_groups: [COLUMN_GROUPS.PASSING],
    header_label: 'ATT',
    player_value_path: 'pass_atts_from_plays'
  }),
  player_pass_touchdowns_from_plays: from_play_field({
    column_title: 'Passing Touchdowns (By Play)',
    column_groups: [COLUMN_GROUPS.PASSING],
    header_label: 'TD',
    player_value_path: 'pass_tds_from_plays'
  }),
  player_pass_interceptions_from_plays: from_play_field({
    column_title: 'Passing Interceptions (By Play)',
    column_groups: [COLUMN_GROUPS.PASSING],
    header_label: 'INT',
    player_value_path: 'pass_ints_from_plays'
  }),
  player_dropped_passing_yards_from_plays: from_play_field({
    column_title: 'Dropped Passing Yards (By Play)',
    column_groups: [COLUMN_GROUPS.PASSING],
    header_label: 'DRP YDS',
    player_value_path: 'drop_pass_yds_from_plays'
  }),
  player_pass_completion_percentage_from_plays: from_play_field({
    column_title: 'Passing Completion Percentage (By Play)',
    column_groups: [COLUMN_GROUPS.PASSING, COLUMN_GROUPS.EFFICIENCY],
    header_label: 'COMP%',
    player_value_path: 'pass_comp_pct_from_plays',
    fixed: 1
  }),
  player_pass_touchdown_percentage_from_plays: from_play_field({
    column_title: 'Passing Touchdown Percentage (By Play)',
    column_groups: [COLUMN_GROUPS.PASSING, COLUMN_GROUPS.EFFICIENCY],
    header_label: 'TD%',
    player_value_path: 'pass_td_pct_from_plays',
    fixed: 1
  }),
  player_pass_interception_percentage_from_plays: from_play_field({
    column_title: 'Passing Interception Percentage (By Play)',
    column_groups: [COLUMN_GROUPS.PASSING, COLUMN_GROUPS.EFFICIENCY],
    header_label: 'INT%',
    player_value_path: 'pass_int_pct_from_plays',
    fixed: 1
  }),
  player_pass_interception_worthy_percentage_from_plays: from_play_field({
    column_title: 'Passing Interception Worthy Percentage (By Play)',
    column_groups: [COLUMN_GROUPS.PASSING, COLUMN_GROUPS.EFFICIENCY],
    header_label: 'BAD%',
    player_value_path: 'pass_int_worthy_pct_from_plays',
    fixed: 1
  }),
  player_pass_yards_after_catch_from_plays: from_play_field({
    column_title: 'Passing Yards After Catch (By Play)',
    column_groups: [
      COLUMN_GROUPS.PASSING,
      COLUMN_GROUPS.EFFICIENCY,
      COLUMN_GROUPS.AFTER_CATCH
    ],
    header_label: 'YAC',
    player_value_path: 'pass_yds_after_catch_from_plays'
  }),
  player_pass_yards_after_catch_per_completion_from_plays: from_play_field({
    column_title: 'Passing Yards After Catch Per Completion (By Play)',
    column_groups: [
      COLUMN_GROUPS.PASSING,
      COLUMN_GROUPS.EFFICIENCY,
      COLUMN_GROUPS.AFTER_CATCH
    ],
    header_label: 'YAC/C',
    player_value_path: 'pass_yds_after_catch_per_comp_from_plays',
    fixed: 1
  }),
  player_pass_yards_per_pass_attempt_from_plays: from_play_field({
    column_title: 'Passing Yards Per Pass Attempt (By Play)',
    column_groups: [COLUMN_GROUPS.PASSING, COLUMN_GROUPS.EFFICIENCY],
    header_label: 'Y/A',
    player_value_path: 'pass_yds_per_att_from_plays',
    fixed: 1
  }),
  player_pass_depth_per_pass_attempt_from_plays: from_play_field({
    column_title: 'Passing Depth of Target Per Pass Attempt (By Play)',
    column_groups: [COLUMN_GROUPS.PASSING],
    header_label: 'DOT',
    player_value_path: 'pass_depth_per_att_from_plays',
    fixed: 1
  }),
  player_pass_air_yards_from_plays: from_play_field({
    column_title: 'Passing Air Yards (By Play)',
    column_groups: [COLUMN_GROUPS.PASSING],
    header_label: 'AY',
    player_value_path: 'pass_air_yds_from_plays'
  }),
  player_completed_air_yards_per_completion_from_plays: from_play_field({
    column_title: 'Completed Air Yards Per Completion (By Play)',
    column_groups: [COLUMN_GROUPS.PASSING],
    header_label: 'CAY/C',
    player_value_path: 'comp_air_yds_per_comp_from_plays'
  }),
  player_passing_air_conversion_ratio_from_plays: from_play_field({
    column_title: 'Passing Air Conversion Ratio (By Play)',
    column_groups: [COLUMN_GROUPS.PASSING],
    header_label: 'PACR',
    player_value_path: 'pass_air_conv_ratio_from_plays',
    fixed: 1
  }),
  player_sacked_from_plays: from_play_field({
    column_title: 'Sacks (By Play)',
    column_groups: [COLUMN_GROUPS.PASSING],
    header_label: 'SK',
    player_value_path: 'sacked_from_plays'
  }),
  player_sacked_yards_from_plays: from_play_field({
    column_title: 'Sack Yards (By Play)',
    column_groups: [COLUMN_GROUPS.PASSING],
    header_label: 'SK YDS',
    player_value_path: 'sacked_yds_from_plays'
  }),
  player_sacked_percentage_from_plays: from_play_field({
    column_title: 'Sack Percentage (By Play)',
    column_groups: [COLUMN_GROUPS.PASSING],
    header_label: 'SK%',
    player_value_path: 'sacked_pct_from_plays',
    fixed: 1
  }),
  player_quarterback_hits_percentage_from_plays: from_play_field({
    column_title: 'QB Hits Percentage (By Play)',
    column_groups: [COLUMN_GROUPS.PASSING],
    header_label: 'HIT%',
    player_value_path: 'qb_hit_pct_from_plays',
    fixed: 1
  }),
  player_quarterback_pressures_percentage_from_plays: from_play_field({
    column_title: 'QB Pressures Percentage (By Play)',
    column_groups: [COLUMN_GROUPS.PASSING],
    header_label: 'PRSS%',
    player_value_path: 'qb_press_pct_from_plays',
    fixed: 1
  }),
  player_quarterback_hurries_percentage_from_plays: from_play_field({
    column_title: 'QB Hurries Percentage (By Play)',
    column_groups: [COLUMN_GROUPS.PASSING],
    header_label: 'HRRY%',
    player_value_path: 'qb_hurry_pct_from_plays',
    fixed: 1
  }),
  player_pass_net_yards_per_attempt_from_plays: from_play_field({
    column_title: 'Passing Net Yards Per Attempt (By Play)',
    column_groups: [COLUMN_GROUPS.PASSING],
    header_label: 'NY/A',
    player_value_path: 'pass_net_yds_per_att_from_plays',
    fixed: 1
  }),
  player_rush_yards_from_plays: from_play_field({
    column_title: 'Rushing Yards (By Play)',
    column_groups: [COLUMN_GROUPS.RUSHING],
    header_label: 'YDS',
    player_value_path: 'rush_yds_from_plays'
  }),
  player_rush_touchdowns_from_plays: from_play_field({
    column_title: 'Rushing Touchdowns (By Play)',
    column_groups: [COLUMN_GROUPS.RUSHING],
    header_label: 'TD',
    player_value_path: 'rush_tds_from_plays'
  }),
  player_rush_yds_per_attempt_from_plays: from_play_field({
    column_title: 'Rushing Yards Per Attempt (By Play)',
    column_groups: [COLUMN_GROUPS.RUSHING],
    header_label: 'Y/A',
    player_value_path: 'rush_yds_per_att_from_plays',
    fixed: 1
  }),
  player_rush_attempts_from_plays: from_play_field({
    column_title: 'Rushing Attempts (By Play)',
    column_groups: [COLUMN_GROUPS.RUSHING],
    header_label: 'ATT',
    player_value_path: 'rush_atts_from_plays'
  }),
  player_rush_first_downs_from_plays: from_play_field({
    column_title: 'Rushing First Downs (By Play)',
    column_groups: [COLUMN_GROUPS.RUSHING],
    header_label: 'FD',
    player_value_path: 'rush_first_downs_from_plays'
  }),
  player_positive_rush_attempts_from_plays: from_play_field({
    column_title: 'Positive Yardage Rush Attempts (By Play)',
    column_groups: [COLUMN_GROUPS.RUSHING],
    header_label: 'POS',
    player_value_path: 'positive_rush_atts_from_plays'
  }),
  player_rush_yards_after_contact_from_plays: from_play_field({
    column_title: 'Rushing Yards After Contact (By Play)',
    column_groups: [COLUMN_GROUPS.RUSHING],
    header_label: 'YAC',
    player_value_path: 'rush_yds_after_contact_from_plays'
  }),
  player_rush_yards_after_contact_per_attempt_from_plays: from_play_field({
    column_title: 'Rushing Yards After Contact Per Attempt (By Play)',
    column_groups: [COLUMN_GROUPS.RUSHING],
    header_label: 'YAC/A',
    player_value_path: 'rush_yds_after_contact_per_att_from_plays',
    fixed: 1
  }),
  player_rush_first_down_percentage_from_plays: from_play_field({
    column_title: 'Rushing First Down Percentage (By Play)',
    column_groups: [COLUMN_GROUPS.RUSHING],
    header_label: 'FD%',
    player_value_path: 'rush_first_down_pct_from_plays',
    fixed: 1
  }),
  player_weighted_opportunity_from_plays: from_play_field({
    column_title: 'Weighted Opportunity (By Play)',
    column_groups: [COLUMN_GROUPS.OPPURTUNITY],
    header_label: 'WO',
    player_value_path: 'weighted_opportunity_from_plays',
    fixed: 2
  }),
  player_rush_attempts_share_from_plays: from_share_field({
    column_title: 'Share of Team Rushing Attempts (By Play)',
    column_groups: [COLUMN_GROUPS.RUSHING],
    header_label: 'ATT%',
    player_value_path: 'rush_att_share_from_plays',
    fixed: 1
  }),
  player_rush_yards_share_from_plays: from_share_field({
    column_title: 'Share of Team Rushing Yardage (By Play)',
    column_groups: [COLUMN_GROUPS.RUSHING],
    header_label: 'YDS%',
    player_value_path: 'rush_yds_share_from_plays',
    fixed: 1
  }),
  player_rush_first_down_share_from_plays: from_share_field({
    column_title: 'Share of Team Rushing First Downs (By Play)',
    column_groups: [COLUMN_GROUPS.RUSHING],
    header_label: 'TM FD%',
    player_value_path: 'rush_first_down_share_from_plays',
    fixed: 1
  }),
  player_opportunity_share_from_plays: from_share_field({
    column_title: 'Share of Team Opportunities (By Play)',
    column_groups: [COLUMN_GROUPS.OPPURTUNITY],
    header_label: 'OPP%',
    player_value_path: 'opportunity_share_from_plays',
    fixed: 1
  }),
  player_fumbles_from_plays: from_play_field({
    column_title: 'Fumbles (By Play)',
    column_groups: [COLUMN_GROUPS.RUSHING],
    header_label: 'FMB',
    player_value_path: 'fumbles_from_plays'
  }),
  player_fumbles_lost_from_plays: from_play_field({
    column_title: 'Fumbles Lost (By Play)',
    column_groups: [COLUMN_GROUPS.RUSHING],
    header_label: 'FL',
    player_value_path: 'fumbles_lost_from_plays'
  }),
  player_fumble_percentage_from_plays: from_play_field({
    column_title: 'Fumble Percentage (By Play)',
    column_groups: [COLUMN_GROUPS.RUSHING],
    header_label: 'FUM%',
    player_value_path: 'fumble_pct_from_plays',
    fixed: 1
  }),
  player_positive_rush_percentage_from_plays: from_play_field({
    column_title: 'Positive Rushing Yardage Percentage (By Play)',
    column_groups: [COLUMN_GROUPS.RUSHING],
    header_label: 'POS%',
    player_value_path: 'positive_rush_pct_from_plays',
    fixed: 1
  }),
  player_successful_rush_percentage_from_plays: from_play_field({
    column_title: 'Successful Rush Percentage (By Play)',
    column_groups: [COLUMN_GROUPS.RUSHING],
    header_label: 'SUCC%',
    player_value_path: 'succ_rush_pct_from_plays',
    fixed: 1
  }),
  player_broken_tackles_from_plays: from_play_field({
    column_title: 'Broken Tackles (By Play)',
    column_groups: [COLUMN_GROUPS.RUSHING],
    header_label: 'BT',
    player_value_path: 'broken_tackles_from_plays'
  }),
  player_broken_tackles_per_rush_attempt_from_plays: from_play_field({
    column_title: 'Broken Tackles Per Rush Attempt (By Play)',
    column_groups: [COLUMN_GROUPS.RUSHING],
    header_label: 'BT/A',
    player_value_path: 'broken_tackles_per_rush_att_from_plays',
    fixed: 1
  }),
  player_receptions_from_plays: from_play_field({
    column_title: 'Receptions (By Play)',
    column_groups: [COLUMN_GROUPS.RECEIVING],
    header_label: 'REC',
    player_value_path: 'recs_from_plays'
  }),
  player_receiving_yards_from_plays: from_play_field({
    column_title: 'Receiving Yards (By Play)',
    column_groups: [COLUMN_GROUPS.RECEIVING],
    header_label: 'YDS',
    player_value_path: 'rec_yds_from_plays'
  }),
  player_receiving_touchdowns_from_plays: from_play_field({
    column_title: 'Receiving Touchdowns (By Play)',
    column_groups: [COLUMN_GROUPS.RECEIVING],
    header_label: 'TD',
    player_value_path: 'rec_tds_from_plays'
  }),
  player_drops_from_plays: from_play_field({
    column_title: 'Drops (By Play)',
    column_groups: [COLUMN_GROUPS.RECEIVING],
    header_label: 'DRP',
    player_value_path: 'drops_from_plays'
  }),
  player_dropped_receiving_yards_from_plays: from_play_field({
    column_title: 'Dropped Receiving Yards (By Play)',
    column_groups: [COLUMN_GROUPS.RECEIVING],
    header_label: 'DRP YDS',
    player_value_path: 'drop_rec_yds_from_plays'
  }),
  player_targets_from_plays: from_play_field({
    column_title: 'Targets (By Play)',
    column_groups: [COLUMN_GROUPS.RECEIVING],
    header_label: 'TGT',
    player_value_path: 'trg_from_plays'
  }),
  player_deep_targets_from_plays: from_play_field({
    column_title: 'Deep Targets (By Play)',
    column_groups: [COLUMN_GROUPS.RECEIVING],
    header_label: 'DEEP',
    player_value_path: 'deep_trg_from_plays'
  }),
  player_deep_targets_percentage_from_plays: from_play_field({
    column_title: 'Deep Target Percentage (By Play)',
    column_groups: [COLUMN_GROUPS.RECEIVING],
    header_label: 'DEEP%',
    player_value_path: 'deep_trg_pct_from_plays',
    fixed: 1
  }),
  player_air_yards_per_target_from_plays: from_play_field({
    column_title: 'Air Yards Per Target / Average Depth of Target (By Play)',
    column_groups: [COLUMN_GROUPS.RECEIVING],
    header_label: 'AY/T',
    player_value_path: 'air_yds_per_trg_from_plays',
    fixed: 1
  }),
  player_air_yards_from_plays: from_play_field({
    column_title: 'Air Yards (By Play)',
    column_groups: [COLUMN_GROUPS.RECEIVING],
    header_label: 'AY',
    player_value_path: 'air_yds_from_plays'
  }),
  player_receiving_first_down_from_plays: from_play_field({
    column_title: 'Receiving First Downs (By Play)',
    column_groups: [COLUMN_GROUPS.RECEIVING],
    header_label: 'FD',
    player_value_path: 'recv_first_down_from_plays'
  }),
  player_receiving_first_down_percentage_from_plays: from_play_field({
    column_title: 'Receiving First Down Percentage (By Play)',
    column_groups: [COLUMN_GROUPS.RECEIVING],
    header_label: 'FD%',
    player_value_path: 'recv_first_down_pct_from_plays',
    fixed: 1
  }),
  player_air_yards_share_from_plays: from_share_field({
    column_title: 'Share of Team Air Yards (By Play)',
    column_groups: [COLUMN_GROUPS.RECEIVING],
    header_label: 'AY%',
    player_value_path: 'air_yds_share_from_plays',
    fixed: 1
  }),
  player_target_share_from_plays: from_share_field({
    column_title: 'Share of Team Targets (By Play)',
    column_groups: [COLUMN_GROUPS.RECEIVING],
    header_label: 'TGT%',
    player_value_path: 'trg_share_from_plays',
    fixed: 1
  }),
  player_weighted_opportunity_rating_from_plays: from_share_field({
    column_title: 'Weighted Opportunity Rating (By Play)',
    column_groups: [COLUMN_GROUPS.RECEIVING],
    header_label: 'WOPR',
    player_value_path: 'weighted_opp_rating_from_plays',
    fixed: 2
  }),
  player_receiving_first_down_share_from_plays: from_share_field({
    column_title: 'Share of Team Receiving First Downs (By Play)',
    column_groups: [COLUMN_GROUPS.RECEIVING],
    header_label: 'TM FD%',
    player_value_path: 'recv_first_down_share_from_plays',
    fixed: 1
  }),
  player_receiver_air_conversion_ratio_from_plays: from_play_field({
    column_title: 'Receiver Air Conversion Ratio (By Play)',
    column_groups: [COLUMN_GROUPS.RECEIVING],
    header_label: 'RACR',
    player_value_path: 'rec_air_conv_ratio_from_plays',
    fixed: 1
  }),
  player_receiving_yards_per_reception_from_plays: from_play_field({
    column_title: 'Receiving Yards Per Reception (By Play)',
    column_groups: [COLUMN_GROUPS.RECEIVING],
    header_label: 'Y/R',
    player_value_path: 'rec_yds_per_rec_from_plays',
    fixed: 1
  }),
  player_receiving_yards_per_target_from_plays: from_play_field({
    column_title: 'Receiving Yards Per Target (By Play)',
    column_groups: [COLUMN_GROUPS.RECEIVING],
    header_label: 'Y/T',
    player_value_path: 'rec_yds_per_trg_from_plays',
    fixed: 1
  }),
  player_receiving_yards_after_catch_per_reception_from_plays: from_play_field({
    column_title: 'Receiving Yards After Catch Per Reception (By Play)',
    column_groups: [COLUMN_GROUPS.RECEIVING],
    header_label: 'YAC/R',
    player_value_path: 'rec_yds_after_catch_per_rec_from_plays',
    fixed: 1
  }),

  player_solo_tackles_from_plays: from_defensive_play_field({
    column_title: 'Solo Tackles (By Play)',
    column_groups: [COLUMN_GROUPS.TACKLES],
    header_label: 'SOLO',
    player_value_path: 'solo_tackles_from_plays'
  }),
  player_tackle_assists_from_plays: from_defensive_play_field({
    column_title: 'Tackle Assists (By Play)',
    column_groups: [COLUMN_GROUPS.TACKLES],
    header_label: 'AST',
    player_value_path: 'tackle_assists_from_plays'
  }),
  player_combined_tackles_from_plays: from_defensive_play_field({
    column_title: 'Combined Tackles (By Play)',
    column_groups: [COLUMN_GROUPS.TACKLES],
    header_label: 'COMB',
    player_value_path: 'combined_tackles_from_plays'
  })
}
