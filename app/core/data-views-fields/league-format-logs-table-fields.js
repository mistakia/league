import COLUMN_GROUPS from './column-groups'
import * as table_constants from 'react-table/src/constants.mjs'

import {
  common_column_params,
  named_league_formats,
  DEFAULT_LEAGUE_FORMAT_HASH
} from '@libs-shared'

const { single_year, single_year_offset } = common_column_params

const league_format_hash_param = {
  label: 'League Format',
  values: Object.entries(named_league_formats).map(([key, format]) => ({
    value: format.hash,
    label: format.label
  })),
  data_type: table_constants.TABLE_DATA_TYPES.SELECT,
  default_value: DEFAULT_LEAGUE_FORMAT_HASH,
  single: true
}

const from_format_player_logs = (field) => ({
  data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
  size: 70,
  fixed: 2,
  ...field
})

const from_league_format_seasonlogs = (field) => ({
  ...from_format_player_logs(field),
  column_groups: [COLUMN_GROUPS.FANTASY_LEAGUE, COLUMN_GROUPS.SEASON],
  column_params: {
    year: single_year,
    league_format_hash: league_format_hash_param,
    year_offset: single_year_offset
  },
  splits: ['year']
})

const from_league_format_careerlogs = (field) => ({
  ...from_format_player_logs(field),
  column_groups: [COLUMN_GROUPS.FANTASY_LEAGUE, COLUMN_GROUPS.CAREER],
  column_params: {
    league_format_hash: league_format_hash_param
  }
})

export default {
  player_startable_games_from_seasonlogs: from_league_format_seasonlogs({
    column_title: 'Startable Games (Season)',
    header_label: 'SG',
    player_value_path: 'startable_games_from_seasonlogs'
  }),
  player_earned_salary_from_seasonlogs: from_league_format_seasonlogs({
    column_title: 'Earned Salary (Season)',
    header_label: 'Earned Salary',
    player_value_path: 'earned_salary_from_seasonlogs'
  }),
  player_points_added_earned_from_seasonlogs: from_league_format_seasonlogs({
    column_title: 'Points Added Earned (Season)',
    header_label: 'Pts+ Earned',
    player_value_path: 'points_added_earned_from_seasonlogs'
  }),
  player_points_added_earned_per_game_from_seasonlogs:
    from_league_format_seasonlogs({
      column_title: 'Points Added Earned Per Game (Season)',
      header_label: 'Pts+ Earned/G',
      player_value_path: 'points_added_earned_per_game_from_seasonlogs'
    }),
  player_points_added_earned_rank_from_seasonlogs:
    from_league_format_seasonlogs({
      column_title: 'Points Added Earned Rank (Season)',
      header_label: 'Pts+ Earned Rnk',
      player_value_path: 'points_added_earned_rank_from_seasonlogs',
      reverse_percentiles: true
    }),
  player_points_added_earned_position_rank_from_seasonlogs:
    from_league_format_seasonlogs({
      column_title: 'Points Added Earned Position Rank (Season)',
      header_label: 'Pts+ Earned Pos Rnk',
      player_value_path: 'points_added_earned_position_rank_from_seasonlogs',
      reverse_percentiles: true
    }),
  player_points_added_earned_per_game_rank_from_seasonlogs:
    from_league_format_seasonlogs({
      column_title: 'Points Added Earned Per Game Rank (Season)',
      header_label: 'Pts+ Earned/G Rnk',
      player_value_path: 'points_added_earned_per_game_rank_from_seasonlogs',
      reverse_percentiles: true
    }),
  player_points_added_earned_per_game_position_rank_from_seasonlogs:
    from_league_format_seasonlogs({
      column_title: 'Points Added Earned Per Game Position Rank (Season)',
      header_label: 'Pts+ Earned/G Pos Rnk',
      player_value_path:
        'points_added_earned_per_game_position_rank_from_seasonlogs',
      reverse_percentiles: true
    }),
  player_points_added_net_from_seasonlogs: from_league_format_seasonlogs({
    column_title: 'Points Added Net (Season)',
    header_label: 'Pts+ Net',
    player_value_path: 'points_added_net_from_seasonlogs'
  }),
  player_points_added_net_per_game_from_seasonlogs:
    from_league_format_seasonlogs({
      column_title: 'Points Added Net Per Game (Season)',
      header_label: 'Pts+ Net/G',
      player_value_path: 'points_added_net_per_game_from_seasonlogs'
    }),

  player_startable_games_from_careerlogs: from_league_format_careerlogs({
    column_title: 'Startable Games (Career)',
    header_label: 'SG',
    player_value_path: 'startable_games_from_careerlogs'
  }),
  player_points_added_earned_from_careerlogs: from_league_format_careerlogs({
    column_title: 'Points Added Earned (Career)',
    header_label: 'Pts+ Earned',
    player_value_path: 'points_added_earned_from_careerlogs'
  }),
  player_points_added_earned_per_game_from_careerlogs:
    from_league_format_careerlogs({
      column_title: 'Points Added Earned Per Game (Career)',
      header_label: 'Pts+ Earned/G',
      player_value_path: 'points_added_earned_per_game_from_careerlogs'
    }),
  player_best_season_points_added_earned_per_game_from_careerlogs:
    from_league_format_careerlogs({
      column_title: 'Best Season Points Added Earned Per Game (Career)',
      header_label: 'Best Pts+ Earned/G',
      player_value_path:
        'best_season_points_added_earned_per_game_from_careerlogs'
    }),
  player_best_season_earned_salary_from_careerlogs:
    from_league_format_careerlogs({
      column_title: 'Best Season Earned Salary (Career)',
      header_label: 'Earned Salary',
      player_value_path: 'best_season_earned_salary_from_careerlogs'
    }),
  player_points_added_earned_first_three_seasons_from_careerlogs:
    from_league_format_careerlogs({
      column_title: 'Points Added Earned First 3 Seasons (Career)',
      header_label: 'Pts+ Earned 1st 3',
      player_value_path:
        'points_added_earned_first_three_seasons_from_careerlogs'
    }),
  player_points_added_earned_first_four_seasons_from_careerlogs:
    from_league_format_careerlogs({
      column_title: 'Points Added Earned First 4 Seasons (Career)',
      header_label: 'Pts+ Earned 1st 4',
      player_value_path:
        'points_added_earned_first_four_seasons_from_careerlogs'
    }),
  player_points_added_earned_first_five_seasons_from_careerlogs:
    from_league_format_careerlogs({
      column_title: 'Points Added Earned First 5 Seasons (Career)',
      header_label: 'Pts+ Earned 1st 5',
      player_value_path:
        'points_added_earned_first_five_seasons_from_careerlogs'
    }),
  player_points_added_earned_first_season_from_careerlogs:
    from_league_format_careerlogs({
      column_title: 'Points Added Earned First Season (Career)',
      header_label: 'Pts+ Earned Rookie',
      player_value_path: 'points_added_earned_first_season_from_careerlogs'
    }),
  player_points_added_earned_second_season_from_careerlogs:
    from_league_format_careerlogs({
      column_title: 'Points Added Earned Second Season (Career)',
      header_label: 'Pts+ Earned 2nd Year',
      player_value_path: 'points_added_earned_second_season_from_careerlogs'
    }),
  player_points_added_earned_third_season_from_careerlogs:
    from_league_format_careerlogs({
      column_title: 'Points Added Earned Third Season (Career)',
      header_label: 'Pts+ Earned 3rd Year',
      player_value_path: 'points_added_earned_third_season_from_careerlogs'
    }),
  player_points_added_net_from_careerlogs: from_league_format_careerlogs({
    column_title: 'Points Added Net (Career)',
    header_label: 'Pts+ Net',
    player_value_path: 'points_added_net_from_careerlogs'
  }),
  player_points_added_net_per_game_from_careerlogs:
    from_league_format_careerlogs({
      column_title: 'Points Added Net Per Game (Career)',
      header_label: 'Pts+ Net/G',
      player_value_path: 'points_added_net_per_game_from_careerlogs'
    }),
  player_draft_rank_from_careerlogs: from_league_format_careerlogs({
    column_title: 'Draft Class Rank',
    header_label: 'Draft Rnk',
    player_value_path: 'draft_rank_from_careerlogs',
    reverse_percentiles: true
  })
}
