import { current_season } from '@constants'

const is_regular_season_finished =
  current_season.week > current_season.finalWeek

export const default_data_view_view_id = is_regular_season_finished
  ? 'SEASON_FANTASY_POINTS'
  : 'SEASON_PROJECTIONS'

export const default_data_views = {
  SEASON_FANTASY_POINTS: {
    view_id: 'SEASON_FANTASY_POINTS',
    view_username: 'system',
    view_name: 'Season Fantasy Points',
    view_description: 'Fantasy points and value metrics for the season',
    view_search_column_id: 'player_name',
    table_state: {
      sort: [
        {
          column_id: 'player_points_added_from_seasonlogs',
          desc: true
        }
      ],
      prefix_columns: ['player_name', 'player_nfl_teams', 'player_position'],
      columns: [
        {
          column_id: 'player_points_added_from_seasonlogs',
          params: {
            year: [current_season.year]
          }
        },
        {
          column_id: 'player_points_added_rank_from_seasonlogs',
          params: {
            year: [current_season.year]
          }
        },
        {
          column_id: 'player_points_added_position_rank_from_seasonlogs',
          params: {
            year: [current_season.year]
          }
        },
        {
          column_id: 'player_fantasy_points_from_plays',
          params: {
            year: [current_season.year],
            seas_type: ['REG']
          }
        },
        {
          column_id: 'player_fantasy_points_rank_from_seasonlogs',
          params: {
            year: [current_season.year]
          }
        },
        {
          column_id: 'player_fantasy_points_position_rank_from_seasonlogs',
          params: {
            year: [current_season.year]
          }
        },
        {
          column_id: 'player_fantasy_points_from_plays',
          params: {
            year: [current_season.year],
            seas_type: ['REG'],
            rate_type: ['per_player_play']
          }
        },
        {
          column_id: 'player_fantasy_points_from_plays',
          params: {
            year: [current_season.year],
            seas_type: ['REG'],
            rate_type: ['per_team_drive']
          }
        }
      ]
    }
  },
  SEASON_PROJECTIONS: {
    view_id: 'SEASON_PROJECTIONS',
    view_username: 'system',
    view_name: current_season.isOffseason
      ? 'Season Projections'
      : 'Rest of Season Projections',
    // TOOO
    view_description: current_season.isOffseason
      ? 'Season Projections'
      : 'Rest of Season Projections',
    view_search_column_id: 'player_name',
    table_state: {
      sort: [
        {
          column_id: current_season.isOffseason
            ? 'player_season_projected_points_added'
            : 'player_rest_of_season_projected_points_added',
          desc: true
        }
      ],
      prefix_columns: ['player_name', 'player_nfl_teams', 'player_position'],
      columns: [
        current_season.isOffseason
          ? 'player_season_projected_points_added'
          : 'player_rest_of_season_projected_points_added',
        current_season.isOffseason
          ? 'player_season_projected_points'
          : 'player_rest_of_season_projected_points',
        current_season.isOffseason
          ? 'player_season_projected_pass_atts'
          : 'player_rest_of_season_projected_pass_atts',
        current_season.isOffseason
          ? 'player_season_projected_pass_yds'
          : 'player_rest_of_season_projected_pass_yds',
        current_season.isOffseason
          ? 'player_season_projected_pass_tds'
          : 'player_rest_of_season_projected_pass_tds',
        current_season.isOffseason
          ? 'player_season_projected_pass_ints'
          : 'player_rest_of_season_projected_pass_ints',
        current_season.isOffseason
          ? 'player_season_projected_rush_atts'
          : 'player_rest_of_season_projected_rush_atts',
        current_season.isOffseason
          ? 'player_season_projected_rush_yds'
          : 'player_rest_of_season_projected_rush_yds',
        current_season.isOffseason
          ? 'player_season_projected_rush_tds'
          : 'player_rest_of_season_projected_rush_tds',
        current_season.isOffseason
          ? 'player_season_projected_fumbles_lost'
          : 'player_rest_of_season_projected_fumbles_lost',
        current_season.isOffseason
          ? 'player_season_projected_targets'
          : 'player_rest_of_season_projected_targets',
        current_season.isOffseason
          ? 'player_season_projected_recs'
          : 'player_rest_of_season_projected_recs',
        current_season.isOffseason
          ? 'player_season_projected_rec_yds'
          : 'player_rest_of_season_projected_rec_yds',
        current_season.isOffseason
          ? 'player_season_projected_rec_tds'
          : 'player_rest_of_season_projected_rec_tds'
      ]
    }
  },
  PASSING_STATS_BY_PLAY: {
    view_id: 'PASSING_STATS_BY_PLAY',
    view_username: 'system',
    view_name: 'Passing Stats by Play',
    view_description: 'Passing stats calculated per play',
    table_state: {
      sort: [
        {
          column_id: 'player_pass_yards_from_plays',
          desc: true
        }
      ],
      prefix_columns: ['player_name', 'player_nfl_teams', 'player_position'],
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
    view_username: 'system',
    view_name: 'Rushing Stats By Play',
    view_description: 'Rushing stats calculated per play',
    table_state: {
      sort: [
        {
          column_id: 'player_rush_yards_from_plays',
          desc: true
        }
      ],
      prefix_columns: ['player_name', 'player_nfl_teams', 'player_position'],
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
        'player_weighted_opportunity_from_plays',
        'player_high_value_touches_from_plays',
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
    view_username: 'system',
    view_name: 'Receiving Stats by Play',
    view_description: 'Receiving stats calculated per play',
    table_state: {
      sort: [
        {
          column_id: 'player_receiving_yards_from_plays',
          desc: true
        }
      ],
      prefix_columns: ['player_name', 'player_nfl_teams', 'player_position'],
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

// for (const key of Object.keys(default_data_views)) {
//   default_data_views[key].key = key

//   for (const column of default_data_views[key].table_state.columns) {
//     column.accessorKey = column.column_name
//   }
// }
