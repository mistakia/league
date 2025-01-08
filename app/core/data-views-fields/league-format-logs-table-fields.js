import COLUMN_GROUPS from './column-groups'
import * as table_constants from 'react-table/src/constants.mjs'

import { common_column_params } from '@libs-shared'

const { single_year, single_year_offset } = common_column_params

const league_format_hash_param = {
  label: 'League Format',
  values: [
    {
      value: '1985e1968b75707ebcab9da620176a0b218c5c1bd28d00cbbc4d1744a1631d0b',
      label: '10 Team / SFLEX / 1 FLX / 0.5PPR / 4PTD (GENESIS LEAGUE)'
    },
    {
      value: '97b8d7d2b53c7401b93bfad1fbe97aeb1a582e376b2fcb34868a8628d7fbe48a',
      label: '12 Team / SFLEX / 1 FLX / PPR / 4PTD'
    }
  ],
  data_type: table_constants.TABLE_DATA_TYPES.SELECT,
  default_value:
    '1985e1968b75707ebcab9da620176a0b218c5c1bd28d00cbbc4d1744a1631d0b',
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
  player_points_added_from_seasonlogs: from_league_format_seasonlogs({
    column_title: 'Points Added (Season)',
    header_label: 'Pts+',
    player_value_path: 'points_added_from_seasonlogs'
  }),
  player_points_added_per_game_from_seasonlogs: from_league_format_seasonlogs({
    column_title: 'Points Added Per Game (Season)',
    header_label: 'Pts+/G',
    player_value_path: 'points_added_per_game_from_seasonlogs'
  }),
  player_points_added_rank_from_seasonlogs: from_league_format_seasonlogs({
    column_title: 'Points Added Rank (Season)',
    header_label: 'Pts+ Rnk',
    player_value_path: 'points_added_rnk_from_seasonlogs',
    reverse_percentiles: true
  }),
  player_points_added_position_rank_from_seasonlogs:
    from_league_format_seasonlogs({
      column_title: 'Points Added Position Rank (Season)',
      header_label: 'Pts+ Pos Rnk',
      player_value_path: 'points_added_pos_rnk_from_seasonlogs',
      reverse_percentiles: true
    }),

  player_startable_games_from_careerlogs: from_league_format_careerlogs({
    column_title: 'Startable Games (Career)',
    header_label: 'SG',
    player_value_path: 'startable_games_from_careerlogs'
  }),
  player_points_added_from_careerlogs: from_league_format_careerlogs({
    column_title: 'Points Added (Career)',
    header_label: 'Pts+',
    player_value_path: 'points_added_from_careerlogs'
  }),
  player_points_added_per_game_from_careerlogs: from_league_format_careerlogs({
    column_title: 'Points Added Per Game (Career)',
    header_label: 'Pts+/G',
    player_value_path: 'points_added_per_game_from_careerlogs'
  }),
  player_best_season_points_added_per_game_from_careerlogs:
    from_league_format_careerlogs({
      column_title: 'Best Season Points Added Per Game (Career)',
      header_label: 'Best Pts+/G',
      player_value_path: 'best_season_points_added_per_game_from_careerlogs'
    }),
  player_best_season_earned_salary_from_careerlogs:
    from_league_format_careerlogs({
      column_title: 'Best Season Earned Salary (Career)',
      header_label: 'Earned Salary',
      player_value_path: 'best_season_earned_salary_from_careerlogs'
    }),
  player_points_added_first_three_seasons_from_careerlogs:
    from_league_format_careerlogs({
      column_title: 'Points Added First 3 Seasons (Career)',
      header_label: 'Pts+ 1st 3',
      player_value_path: 'points_added_first_three_seas_from_careerlogs'
    }),
  player_points_added_first_four_seasons_from_careerlogs:
    from_league_format_careerlogs({
      column_title: 'Points Added First 4 Seasons (Career)',
      header_label: 'Pts+ 1st 4',
      player_value_path: 'points_added_first_four_seas_from_careerlogs'
    }),
  player_points_added_first_five_seasons_from_careerlogs:
    from_league_format_careerlogs({
      column_title: 'Points Added First 5 Seasons (Career)',
      header_label: 'Pts+ 1st 5',
      player_value_path: 'points_added_first_five_seas_from_careerlogs'
    }),
  player_points_added_first_season_from_careerlogs:
    from_league_format_careerlogs({
      column_title: 'Points Added First Season (Career)',
      header_label: 'Pts+ Rookie',
      player_value_path: 'points_added_first_seas_from_careerlogs'
    }),
  player_points_added_second_season_from_careerlogs:
    from_league_format_careerlogs({
      column_title: 'Points Added Second Season (Career)',
      header_label: 'Pts+ 2nd Year',
      player_value_path: 'points_added_second_seas_from_careerlogs'
    }),
  player_points_added_third_season_from_careerlogs:
    from_league_format_careerlogs({
      column_title: 'Points Added Third Season (Career)',
      header_label: 'Pts+ 3rd Year',
      player_value_path: 'points_added_third_seas_from_careerlogs'
    }),
  player_draft_rank_from_careerlogs: from_league_format_careerlogs({
    column_title: 'Draft Class Rank',
    header_label: 'Draft Rnk',
    player_value_path: 'draft_rank_from_careerlogs',
    reverse_percentiles: true
  })
}
