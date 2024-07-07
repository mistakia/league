import * as table_constants from 'react-table/src/constants.mjs'

import COLUMN_GROUPS from './column-groups'
import from_format_player_logs from './from-format-player-logs'
import { constants } from '@libs-shared'

const scoring_format_hash_param = {
  label: 'Scoring Format',
  values: [
    {
      value: '0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d',
      label: '0.5PPR / 4PTD / -1INT / 0.05PY / -1FUM (GENESIS LEAGUE)'
    },
    {
      value: 'ad64bf40cdfec0a1ebdf66453fa57687832f7556f3870251c044d5d270fc089e',
      label: 'PPR / 4PTD / -1INT / -1FUM'
    }
  ],
  data_type: table_constants.TABLE_DATA_TYPES.SELECT,
  default_value:
    '0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d',
  single: true
}

const from_scoring_format_seasonlogs = (field) => ({
  ...from_format_player_logs(field),
  column_groups: [COLUMN_GROUPS.FANTASY_POINTS, COLUMN_GROUPS.SEASON],
  column_params: {
    year: {
      values: constants.years,
      data_type: table_constants.TABLE_DATA_TYPES.SELECT,
      default_value: constants.season.stats_season_year,
      single: true,
      enable_multi_on_split: ['year']
    },
    scoring_format_hash: scoring_format_hash_param
  },
  splits: ['year']
})

const from_scoring_format_careerlogs = (field) => ({
  ...from_format_player_logs(field),
  column_groups: [COLUMN_GROUPS.FANTASY_POINTS, COLUMN_GROUPS.CAREER],
  column_params: {
    scoring_format_hash: scoring_format_hash_param
  }
})

export default {
  player_fantasy_points_from_seasonlogs: from_scoring_format_seasonlogs({
    column_title: 'Fantasy Points (By Season)',
    header_label: 'PTS',
    player_value_path: 'points_from_seasonlogs'
  }),
  player_fantasy_points_per_game_from_seasonlogs:
    from_scoring_format_seasonlogs({
      column_title: 'Fantasy Points Per Game (By Season)',
      header_label: 'PTS/G',
      player_value_path: 'points_per_game_from_seasonlogs'
    }),
  player_fantasy_games_played_from_seasonlogs: from_scoring_format_seasonlogs({
    column_title: 'Games Played (By Season)',
    header_label: 'GP',
    player_value_path: 'games_from_seasonlogs'
  }),
  player_fantasy_points_rank_from_seasonlogs: from_scoring_format_seasonlogs({
    column_title: 'Fantasy Points Rank (By Season)',
    header_label: 'RNK',
    player_value_path: 'points_rnk_from_seasonlogs'
  }),
  player_fantasy_points_position_rank_from_seasonlogs:
    from_scoring_format_seasonlogs({
      column_title: 'Fantasy Points Position Rank (By Season)',
      header_label: 'POS RNK',
      player_value_path: 'points_pos_rnk_from_seasonlogs'
    }),

  player_fantasy_points_from_careerlogs: from_scoring_format_careerlogs({
    column_title: 'Fantasy Points (Career)',
    header_label: 'PTS',
    player_value_path: 'points_from_careerlogs'
  }),
  player_fantasy_points_per_game_from_careerlogs:
    from_scoring_format_careerlogs({
      column_title: 'Fantasy Points Per Game (Career)',
      header_label: 'PTS/G',
      player_value_path: 'points_per_game_from_careerlogs'
    }),
  player_fantasy_games_played_from_careerlogs: from_scoring_format_careerlogs({
    column_title: 'Games Played (Career)',
    header_label: 'GP',
    player_value_path: 'games_from_careerlogs'
  }),
  player_fantasy_top_1_seasons_from_careerlogs: from_scoring_format_careerlogs({
    column_title: 'Top 1 Season (Career)',
    header_label: 'TOP 1',
    player_value_path: 'top_1_from_careerlogs'
  }),
  player_fantasy_top_3_seasons_from_careerlogs: from_scoring_format_careerlogs({
    column_title: 'Top 3 Seasons (Career)',
    header_label: 'TOP 3',
    player_value_path: 'top_3_from_careerlogs'
  }),
  player_fantasy_top_6_seasons_from_careerlogs: from_scoring_format_careerlogs({
    column_title: 'Top 6 Seasons (Career)',
    header_label: 'TOP 6',
    player_value_path: 'top_6_from_careerlogs'
  }),
  player_fantasy_top_12_seasons_from_careerlogs: from_scoring_format_careerlogs(
    {
      column_title: 'Top 12 Seasons (Career)',
      header_label: 'TOP 12',
      player_value_path: 'top_12_from_careerlogs'
    }
  ),
  player_fantasy_top_24_seasons_from_careerlogs: from_scoring_format_careerlogs(
    {
      column_title: 'Top 24 Seasons (Career)',
      header_label: 'TOP 24',
      player_value_path: 'top_24_from_careerlogs'
    }
  ),
  player_fantasy_top_36_seasons_from_careerlogs: from_scoring_format_careerlogs(
    {
      column_title: 'Top 36 Seasons (Career)',
      header_label: 'TOP 36',
      player_value_path: 'top_36_from_careerlogs'
    }
  )
}
