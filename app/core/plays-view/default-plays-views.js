import { current_season } from '@constants'

export const default_plays_view_view_id = 'DEFAULT_PLAYS_VIEW'

export const default_plays_views = {
  DEFAULT_PLAYS_VIEW: {
    view_id: 'DEFAULT_PLAYS_VIEW',
    view_username: 'system',
    view_name: 'All Plays',
    view_description: 'Browse and filter individual NFL plays',
    table_state: {
      sort: [
        {
          column_id: 'play_week',
          desc: true
        },
        {
          column_id: 'play_game_timestamp',
          desc: true
        },
        {
          column_id: 'play_esbid',
          desc: true
        },
        {
          column_id: 'play_sequence',
          desc: false
        }
      ],
      prefix_columns: [
        'play_year',
        'play_week',
        'play_off_team',
        'play_def_team',
        'play_quarter',
        'play_game_clock'
      ],
      columns: [
        'play_type',
        'play_down',
        'play_yards_to_go',
        'play_yds_gained',
        'play_epa',
        'play_passer',
        'play_rusher',
        'play_target'
      ],
      where: [
        {
          column_id: 'play_year',
          operator: '=',
          value: String(current_season.stats_season_year)
        },
        {
          column_id: 'play_type',
          operator: '!=',
          value: 'NOPL'
        }
      ]
    }
  },
  PASSING_PLAYS: {
    view_id: 'PASSING_PLAYS',
    view_username: 'system',
    view_name: 'Passing Plays',
    view_description: 'Passing play details and metrics',
    table_state: {
      sort: [
        {
          column_id: 'play_week',
          desc: true
        },
        {
          column_id: 'play_game_timestamp',
          desc: true
        },
        {
          column_id: 'play_esbid',
          desc: true
        },
        {
          column_id: 'play_sequence',
          desc: false
        }
      ],
      prefix_columns: [
        'play_year',
        'play_week',
        'play_off_team',
        'play_def_team',
        'play_quarter',
        'play_game_clock'
      ],
      columns: [
        'play_passer',
        'play_target',
        'play_pass_yds',
        'play_air_yards',
        'play_comp',
        'play_td',
        'play_epa',
        'play_cpoe'
      ],
      where: [
        {
          column_id: 'play_year',
          operator: '=',
          value: String(current_season.stats_season_year)
        },
        {
          column_id: 'play_type',
          operator: '=',
          value: 'PASS'
        }
      ]
    }
  },
  RUSHING_PLAYS: {
    view_id: 'RUSHING_PLAYS',
    view_username: 'system',
    view_name: 'Rushing Plays',
    view_description: 'Rushing play details and metrics',
    table_state: {
      sort: [
        {
          column_id: 'play_week',
          desc: true
        },
        {
          column_id: 'play_game_timestamp',
          desc: true
        },
        {
          column_id: 'play_esbid',
          desc: true
        },
        {
          column_id: 'play_sequence',
          desc: false
        }
      ],
      prefix_columns: [
        'play_year',
        'play_week',
        'play_off_team',
        'play_def_team',
        'play_quarter',
        'play_game_clock'
      ],
      columns: [
        'play_rusher',
        'play_rush_yds',
        'play_yards_after_contact',
        'play_broken_tackles',
        'play_run_location',
        'play_td',
        'play_epa',
        'play_successful'
      ],
      where: [
        {
          column_id: 'play_year',
          operator: '=',
          value: String(current_season.stats_season_year)
        },
        {
          column_id: 'play_type',
          operator: '=',
          value: 'RUSH'
        }
      ]
    }
  }
}
