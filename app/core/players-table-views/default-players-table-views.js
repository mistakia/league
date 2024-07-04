import { constants } from '@libs-shared'

export const default_players_table_views = {
  SEASON_PROJECTIONS: {
    view_id: 'SEASON_PROJECTIONS',
    view_name: constants.season.isOffseason
      ? 'Season Projections'
      : 'Rest of Season Projections',
    // TOOO
    view_description: constants.season.isOffseason
      ? 'Season Projections'
      : 'Rest of Season Projections',
    view_filters: ['player_position'],
    view_search_column_id: 'player_name',
    table_state: {
      sort: [
        {
          column_id: constants.season.isOffseason
            ? 'player_season_projected_points_added'
            : 'player_rest_of_season_projected_points_added',
          desc: true
        }
      ],
      prefix_columns: ['player_name', 'player_position'],
      columns: [
        constants.season.isOffseason
          ? 'player_season_projected_points_added'
          : 'player_rest_of_season_projected_points_added',
        constants.season.isOffseason
          ? 'player_season_projected_points'
          : 'player_rest_of_season_projected_points',
        constants.season.isOffseason
          ? 'player_season_projected_pass_yds'
          : 'player_rest_of_season_projected_pass_yds',
        constants.season.isOffseason
          ? 'player_season_projected_pass_tds'
          : 'player_rest_of_season_projected_pass_tds',
        constants.season.isOffseason
          ? 'player_season_projected_pass_ints'
          : 'player_rest_of_season_projected_pass_ints',
        constants.season.isOffseason
          ? 'player_season_projected_rush_atts'
          : 'player_rest_of_season_projected_rush_atts',
        constants.season.isOffseason
          ? 'player_season_projected_rush_yds'
          : 'player_rest_of_season_projected_rush_yds',
        constants.season.isOffseason
          ? 'player_season_projected_rush_tds'
          : 'player_rest_of_season_projected_rush_tds',
        constants.season.isOffseason
          ? 'player_season_projected_fumbles_lost'
          : 'player_rest_of_season_projected_fumbles_lost',
        constants.season.isOffseason
          ? 'player_season_projected_targets'
          : 'player_rest_of_season_projected_targets',
        constants.season.isOffseason
          ? 'player_season_projected_recs'
          : 'player_rest_of_season_projected_recs',
        constants.season.isOffseason
          ? 'player_season_projected_rec_yds'
          : 'player_rest_of_season_projected_rec_yds',
        constants.season.isOffseason
          ? 'player_season_projected_rec_tds'
          : 'player_rest_of_season_projected_rec_tds'
      ]
    }
  },
  // WEEK_PROJECTIONS: {
  //   view_id: 'WEEK_PROJECTIONS',
  //   name: 'Week Projections',
  //   order_by: 'player_week_projected_points_added',
  //   fields: [
  //     'opponent',
  //     'opponent_strength',
  //     'player_week_projected_points_added',
  //     'player_week_projected_points',
  //     'player_week_projected_pass_yds',
  //     'player_week_projected_pass_tds',
  //     'player_week_projected_pass_ints',
  //     'opponent_pass_pa',
  //     'opponent_pass_pc',
  //     'opponent_pass_py',
  //     'opponent_pass_tdp',
  //     'opponent_pass_ints',
  //     'player_week_projected_rush_atts',
  //     'player_week_projected_rush_yds',
  //     'player_week_projected_rush_tds',
  //     'player_week_projected_fumbles_lost',
  //     'opponent_rush_ra',
  //     'opponent_rush_ry',
  //     'opponent_rush_tdr',
  //     'player_week_projected_targets',
  //     'player_week_projected_recs',
  //     'player_week_projected_rec_yds',
  //     'player_week_projected_rec_tds',
  //     'opponent_recv_trg',
  //     'opponent_recv_rec',
  //     'opponent_recv_recy',
  //     'opponent_recv_tdrec'
  //   ]
  // },
  PASSING_STATS_BY_PLAY: {
    view_id: 'PASSING_STATS_BY_PLAY',
    view_name: 'Passing Stats by Play',
    view_description: 'Passing stats calculated per play',
    view_filters: ['player_position'],
    table_state: {
      sort: [
        {
          column_id: 'player_pass_yards_from_plays',
          desc: true
        }
      ],
      prefix_columns: ['player_name', 'player_position'],
      columns: [
        'player_pass_yards_from_plays',
        'player_pass_touchdowns_from_plays',
        'player_pass_interceptions_from_plays',
        'player_dropped_passing_yards_from_plays',
        'player_pass_completion_percentage_from_plays',
        'player_pass_touchdown_percentage_from_plays',
        'player_pass_interception_percentage_from_plays',
        'player_pass_interception_worthy_percentage_from_plays',
        'player_pass_yards_after_catch_from_plays',
        'player_pass_yards_after_catch_per_completion_from_plays',
        'player_pass_yards_per_pass_attempt_from_plays',
        'player_pass_depth_per_pass_attempt_from_plays',
        'player_pass_air_yards_from_plays',
        'player_completed_air_yards_per_completion_from_plays',
        'player_passing_air_conversion_ratio_from_plays',
        'player_sacked_from_plays',
        'player_sacked_yards_from_plays',
        'player_sacked_percentage_from_plays',
        'player_quarterback_hits_percentage_from_plays',
        'player_quarterback_pressures_percentage_from_plays',
        'player_quarterback_hurries_percentage_from_plays',
        'player_pass_net_yards_per_attempt_from_plays'
      ]
    }
  },
  RUSHING_STATS_BY_PLAY: {
    view_id: 'RUSHING_STATS_BY_PLAY',
    view_name: 'Rushing Stats By Play',
    view_description: 'Rushing stats calculated per play',
    view_filters: ['player_position'],
    table_state: {
      sort: [
        {
          column_id: 'player_rush_yards_from_plays',
          desc: true
        }
      ],
      prefix_columns: ['player_name', 'player_position'],
      columns: [
        // fantasy_points
        'player_rush_yards_from_plays',
        'player_rush_attempts_from_plays',
        'player_rush_touchdowns_from_plays',
        'player_rush_first_downs_from_plays',
        'player_rush_yds_per_attempt_from_plays',
        'player_positive_rush_attempts_from_plays',
        'player_rush_yards_after_contact_from_plays',
        'player_rush_yards_after_contact_per_attempt_from_plays',
        'player_rush_attempts_share_from_plays',
        'player_rush_yards_share_from_plays',
        'player_fumble_percentage_from_plays',
        'player_positive_rush_percentage_from_plays',
        'player_successful_rush_percentage_from_plays',
        'player_broken_tackles_from_plays',
        'player_broken_tackles_per_rush_attempt_from_plays'
      ]
    }
  },

  RECEIVING_STATS_BY_PLAY: {
    view_id: 'RECEIVING_STATS_BY_PLAY',
    view_name: 'Receiving Stats by Play',
    view_description: 'Receiving stats calculated per play',
    view_filters: ['player_position'],
    table_state: {
      sort: [
        {
          column_id: 'player_receiving_yards_from_plays',
          desc: true
        }
      ],
      prefix_columns: ['player_name', 'player_position'],
      columns: [
        // fantasy points
        'player_receiving_yards_from_plays',
        'player_receptions_from_plays',
        'player_receiving_touchdowns_from_plays',
        'player_drops_from_plays',
        'player_dropped_receiving_yards_from_plays',
        'player_targets_from_plays',
        'player_deep_targets_percentage_from_plays',
        'player_air_yards_per_target_from_plays',
        'player_air_yards_from_plays',
        'player_air_yards_share_from_plays',
        'player_target_share_from_plays',
        'player_weighted_opportunity_rating_from_plays',
        'player_receiver_air_conversion_ratio_from_plays',
        'player_receiving_yards_per_reception_from_plays',
        'player_receiving_yards_per_target_from_plays',
        'player_receiving_yards_after_catch_per_reception_from_plays'
      ]
    }
  }
}

// for (const key of Object.keys(default_players_table_views)) {
//   default_players_table_views[key].key = key

//   for (const column of default_players_table_views[key].table_state.columns) {
//     column.accessorKey = column.column_name
//   }
// }
