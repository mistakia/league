import * as table_constants from 'react-table/src/constants.mjs'

import COLUMN_GROUPS from './column-groups'
import from_format_player_logs from './from-format-player-logs'
import {
  common_column_params,
  named_scoring_formats,
  DEFAULT_SCORING_FORMAT_ID
} from '@libs-shared'

const { single_year, single_year_offset } = common_column_params

const scoring_format_id_param = {
  label: 'Scoring Format',
  values: Object.values(named_scoring_formats).map((format) => ({
    value: format.id,
    label: format.label
  })),
  data_type: table_constants.TABLE_DATA_TYPES.SELECT,
  default_value: DEFAULT_SCORING_FORMAT_ID,
  single: true
}

const from_scoring_format_seasonlogs = (field) => ({
  ...from_format_player_logs(field),
  column_groups: [COLUMN_GROUPS.FANTASY_POINTS, COLUMN_GROUPS.SEASON],
  column_params: {
    year: single_year,
    year_offset: single_year_offset,
    scoring_format_id: scoring_format_id_param
  },
  row_axes: ['year']
})

const from_scoring_format_careerlogs = (field) => ({
  ...from_format_player_logs(field),
  column_groups: [COLUMN_GROUPS.FANTASY_POINTS, COLUMN_GROUPS.CAREER],
  column_params: {
    scoring_format_id: scoring_format_id_param
  }
})

// The four non-rank fantasy points fields were removed from this file alone in
// 6ce38f740 (2024-08-03), leaving the server definitions and the shared
// description index carrying them. That is the drift the player-table parity
// spec exists to prevent, on the one registry pair it did not cover: the columns
// stayed queryable over the API and became unselectable in the UI, and a saved
// view still holding one threw "Field not found for column_id" on every render
// (signal 124653). Restored with the player_value_paths the server aliases them
// as -- `${column_name}_from_{season,career}logs` per
// player-scoring-format-logs-column-definitions.mjs.
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
  player_fantasy_points_rank_from_seasonlogs: from_scoring_format_seasonlogs({
    column_title: 'Fantasy Points Rank (By Season)',
    header_label: 'RNK',
    player_value_path: 'points_rnk_from_seasonlogs',
    reverse_percentiles: true
  }),
  player_fantasy_points_position_rank_from_seasonlogs:
    from_scoring_format_seasonlogs({
      column_title: 'Fantasy Points Position Rank (By Season)',
      header_label: 'POS RNK',
      player_value_path: 'points_pos_rnk_from_seasonlogs',
      reverse_percentiles: true
    }),
  player_fantasy_points_per_game_rank_from_seasonlogs:
    from_scoring_format_seasonlogs({
      column_title: 'Fantasy Points Per Game Rank (By Season)',
      header_label: 'PPG RNK',
      player_value_path: 'points_per_game_rnk_from_seasonlogs',
      reverse_percentiles: true
    }),
  player_fantasy_points_per_game_position_rank_from_seasonlogs:
    from_scoring_format_seasonlogs({
      column_title: 'Fantasy Points Per Game Position Rank (By Season)',
      header_label: 'PPG POS RNK',
      player_value_path: 'points_per_game_pos_rnk_from_seasonlogs',
      reverse_percentiles: true
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
