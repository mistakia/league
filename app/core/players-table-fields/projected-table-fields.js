import COLUMN_GROUPS from './column-groups'
import * as table_constants from 'react-table/src/constants.mjs'
import { stat_in_year_week } from '@libs-shared'

export default function ({ week }) {
  return {
    player_rest_of_season_projected_points_added: {
      column_title: 'Projected Points Added (Rest-Of-Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.REST_OF_SEASON_PROJECTION,
        COLUMN_GROUPS.FANTASY_LEAGUE
      ],
      header_label: 'Pts+',
      player_value_path: stat_in_year_week('points_added')({
        params: { week: 'ros' }
      }),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_season_projected_points_added: {
      column_title: 'Projected Points Added (Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.SEASON_PROJECTION,
        COLUMN_GROUPS.FANTASY_LEAGUE
      ],
      header_label: 'Pts+',
      player_value_path: stat_in_year_week('points_added')(),
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_week_projected_points_added: {
      column_title: 'Projected Points Added (Week)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.WEEK_PROJECTION,
        COLUMN_GROUPS.FANTASY_LEAGUE
      ],
      header_label: 'Pts+',
      player_value_path: stat_in_year_week('points_added')({
        params: { week }
      }),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },

    player_week_projected_points: {
      column_title: 'Projected Points (Week)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.WEEK_PROJECTION,
        COLUMN_GROUPS.FANTASY_POINTS
      ],
      header_label: 'Pts',
      player_value_path: stat_in_year_week('proj_fan_pts')({
        params: { week: Math.max(1, week) }
      }),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_rest_of_season_projected_points: {
      column_title: 'Projected Points (Rest-Of-Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.REST_OF_SEASON_PROJECTION,
        COLUMN_GROUPS.FANTASY_POINTS
      ],
      header_label: 'Pts',
      player_value_path: stat_in_year_week('proj_fan_pts')({
        params: { week: 'ros' }
      }),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_season_projected_points: {
      column_title: 'Projected Points (Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.SEASON_PROJECTION,
        COLUMN_GROUPS.FANTASY_POINTS
      ],
      header_label: 'Pts',
      player_value_path: stat_in_year_week('proj_fan_pts')(),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },

    player_week_projected_pass_yds: {
      column_title: 'Projected Passing Yards (Week)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.WEEK_PROJECTION,
        COLUMN_GROUPS.PASSING
      ],
      header_label: 'YDS',
      player_value_path: stat_in_year_week('proj_pass_yds')({
        params: { week }
      }),
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_week_projected_pass_tds: {
      column_title: 'Projected Passing Touchdowns (Week)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.WEEK_PROJECTION,
        COLUMN_GROUPS.PASSING
      ],
      header_label: 'TD',
      player_value_path: stat_in_year_week('proj_pass_tds')({
        params: { week }
      }),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_week_projected_pass_ints: {
      column_title: 'Projected Interceptions (Week)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.WEEK_PROJECTION,
        COLUMN_GROUPS.PASSING
      ],
      header_label: 'INT',
      player_value_path: stat_in_year_week('proj_pass_ints')({
        params: { week }
      }),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },

    player_season_projected_pass_yds: {
      column_title: 'Projected Passing Yards (Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.SEASON_PROJECTION,
        COLUMN_GROUPS.PASSING
      ],
      header_label: 'YDS',
      player_value_path: stat_in_year_week('proj_pass_yds')(),
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_season_projected_pass_tds: {
      column_title: 'Projected Passing Touchdowns (Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.SEASON_PROJECTION,
        COLUMN_GROUPS.PASSING
      ],
      header_label: 'TD',
      player_value_path: stat_in_year_week('proj_pass_tds')(),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_season_projected_pass_ints: {
      column_title: 'Projected Interceptions (Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.SEASON_PROJECTION,
        COLUMN_GROUPS.PASSING
      ],
      header_label: 'INT',
      player_value_path: stat_in_year_week('proj_pass_ints')(),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },

    player_rest_of_season_projected_pass_yds: {
      column_title: 'Projected Passing Yards (Rest-Of-Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.REST_OF_SEASON_PROJECTION,
        COLUMN_GROUPS.PASSING
      ],
      header_label: 'YDS',
      player_value_path: stat_in_year_week('proj_pass_yds')({
        params: { week: 'ros' }
      }),
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_rest_of_season_projected_pass_tds: {
      column_title: 'Projected Passing Touchdowns (Rest-Of-Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.REST_OF_SEASON_PROJECTION,
        COLUMN_GROUPS.PASSING
      ],
      header_label: 'TD',
      player_value_path: stat_in_year_week('proj_pass_tds')({
        params: { week: 'ros' }
      }),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_rest_of_season_projected_pass_ints: {
      column_title: 'Projected Interceptions (Rest-Of-Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.REST_OF_SEASON_PROJECTION,
        COLUMN_GROUPS.PASSING
      ],
      header_label: 'INT',
      player_value_path: stat_in_year_week('proj_pass_ints')({
        params: { week: 'ros' }
      }),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },

    player_week_projected_rush_atts: {
      column_title: 'Projected Rushing Attempts (Week)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.WEEK_PROJECTION,
        COLUMN_GROUPS.RUSHING
      ],
      header_label: 'ATT',
      player_value_path: stat_in_year_week('proj_rush_atts')({
        params: { week }
      }),
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_week_projected_rush_yds: {
      column_title: 'Projected Rushing Yards (Week)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.WEEK_PROJECTION,
        COLUMN_GROUPS.RUSHING
      ],
      header_label: 'YDS',
      player_value_path: stat_in_year_week('proj_rush_yds')({
        params: { week }
      }),
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_week_projected_rush_tds: {
      column_title: 'Projected Rushing Touchdowns (Week)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.WEEK_PROJECTION,
        COLUMN_GROUPS.RUSHING
      ],
      header_label: 'TD',
      player_value_path: stat_in_year_week('proj_rush_tds')({
        params: { week }
      }),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_week_projected_fumbles_lost: {
      column_title: 'Projected Fumbles (Week)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.WEEK_PROJECTION,
        COLUMN_GROUPS.RUSHING
      ],
      header_label: 'FUM',
      player_value_path: stat_in_year_week('proj_fum_lost')({
        params: { week }
      }),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },

    player_season_projected_rush_atts: {
      column_title: 'Projected Rushing Attempts (Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.SEASON_PROJECTION,
        COLUMN_GROUPS.RUSHING
      ],
      header_label: 'ATT',
      player_value_path: stat_in_year_week('proj_rush_atts')(),
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_season_projected_rush_yds: {
      column_title: 'Projected Rushing Yards (Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.SEASON_PROJECTION,
        COLUMN_GROUPS.RUSHING
      ],
      header_label: 'YDS',
      player_value_path: stat_in_year_week('proj_rush_yds')(),
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_season_projected_rush_tds: {
      column_title: 'Projected Rushing Touchdowns (Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.SEASON_PROJECTION,
        COLUMN_GROUPS.RUSHING
      ],
      header_label: 'TD',
      player_value_path: stat_in_year_week('proj_rush_tds')(),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_season_projected_fumbles_lost: {
      column_title: 'Projected Fumbles (Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.SEASON_PROJECTION,
        COLUMN_GROUPS.RUSHING
      ],
      header_label: 'FUM',
      player_value_path: stat_in_year_week('proj_fum_lost')(),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },

    player_rest_of_season_projected_rush_atts: {
      column_title: 'Projected Rushing Attempts (Rest-Of-Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.REST_OF_SEASON_PROJECTION,
        COLUMN_GROUPS.RUSHING
      ],
      header_label: 'ATT',
      player_value_path: stat_in_year_week('proj_rush_atts')({
        params: { week: 'ros' }
      }),
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_rest_of_season_projected_rush_yds: {
      column_title: 'Projected Rushing Yards (Rest-Of-Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.REST_OF_SEASON_PROJECTION,
        COLUMN_GROUPS.RUSHING
      ],
      header_label: 'YDS',
      player_value_path: stat_in_year_week('proj_rush_yds')({
        params: { week: 'ros' }
      }),
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_rest_of_season_projected_rush_tds: {
      column_title: 'Projected Rushing Touchdowns (Rest-Of-Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.REST_OF_SEASON_PROJECTION,
        COLUMN_GROUPS.RUSHING
      ],
      header_label: 'TD',
      player_value_path: stat_in_year_week('proj_rush_tds')({
        params: { week: 'ros' }
      }),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_rest_of_season_projected_fumbles_lost: {
      column_title: 'Projected Fumbles (Rest-Of-Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.REST_OF_SEASON_PROJECTION,
        COLUMN_GROUPS.RUSHING
      ],
      header_label: 'FUM',
      player_value_path: stat_in_year_week('proj_fum_lost')({
        params: { week: 'ros' }
      }),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },

    player_week_projected_targets: {
      column_title: 'Projected Targets (Week)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.WEEK_PROJECTION,
        COLUMN_GROUPS.RECEIVING
      ],
      header_label: 'TGT',
      player_value_path: stat_in_year_week('proj_trg')({ params: { week } }),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_week_projected_recs: {
      column_title: 'Projected Receptions (Week)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.WEEK_PROJECTION,
        COLUMN_GROUPS.RECEIVING
      ],
      header_label: 'REC',
      player_value_path: stat_in_year_week('proj_recs')({ params: { week } }),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_week_projected_rec_yds: {
      column_title: 'Projected Receiving Yards (Week)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.WEEK_PROJECTION,
        COLUMN_GROUPS.RECEIVING
      ],
      header_label: 'YDS',
      player_value_path: stat_in_year_week('proj_rec_yds')({
        params: { week }
      }),
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_week_projected_rec_tds: {
      column_title: 'Projected Receiving Touchdowns (Week)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.WEEK_PROJECTION,
        COLUMN_GROUPS.RECEIVING
      ],
      header_label: 'TD',
      player_value_path: stat_in_year_week('proj_rec_tds')({
        params: { week }
      }),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },

    player_season_projected_targets: {
      column_title: 'Projected Targets (Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.SEASON_PROJECTION,
        COLUMN_GROUPS.RECEIVING
      ],
      header_label: 'TGT',
      player_value_path: stat_in_year_week('proj_trg')(),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_season_projected_recs: {
      column_title: 'Projected Receptions (Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.SEASON_PROJECTION,
        COLUMN_GROUPS.RECEIVING
      ],
      header_label: 'REC',
      player_value_path: stat_in_year_week('proj_recs')(),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_season_projected_rec_yds: {
      column_title: 'Projected Receiving Yards (Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.SEASON_PROJECTION,
        COLUMN_GROUPS.RECEIVING
      ],
      header_label: 'YDS',
      player_value_path: stat_in_year_week('proj_rec_yds')(),
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_season_projected_rec_tds: {
      column_title: 'Projected Receiving Touchdowns (Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.SEASON_PROJECTION,
        COLUMN_GROUPS.RECEIVING
      ],
      header_label: 'TD',
      player_value_path: stat_in_year_week('proj_rec_tds')(),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },

    player_rest_of_season_projected_targets: {
      column_title: 'Projected Targets (Rest-Of-Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.REST_OF_SEASON_PROJECTION,
        COLUMN_GROUPS.RECEIVING
      ],
      header_label: 'TGT',
      player_value_path: stat_in_year_week('proj_trg')({
        params: { week: 'ros' }
      }),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_rest_of_season_projected_recs: {
      column_title: 'Projected Receptions (Rest-Of-Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.REST_OF_SEASON_PROJECTION,
        COLUMN_GROUPS.RECEIVING
      ],
      header_label: 'REC',
      player_value_path: stat_in_year_week('proj_recs')({
        params: { week: 'ros' }
      }),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_rest_of_season_projected_rec_yds: {
      column_title: 'Projected Receiving Yards (Rest-Of-Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.REST_OF_SEASON_PROJECTION,
        COLUMN_GROUPS.RECEIVING
      ],
      header_label: 'YDS',
      player_value_path: stat_in_year_week('proj_rec_yds')({
        params: { week: 'ros' }
      }),
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_rest_of_season_projected_rec_tds: {
      column_title: 'Projected Receiving Touchdowns (Rest-Of-Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.REST_OF_SEASON_PROJECTION,
        COLUMN_GROUPS.RECEIVING
      ],
      header_label: 'TD',
      player_value_path: stat_in_year_week('proj_rec_tds')({
        params: { week: 'ros' }
      }),
      fixed: 1,
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    }
  }
}
