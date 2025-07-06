import * as table_constants from 'react-table/src/constants.mjs'

import COLUMN_GROUPS from './column-groups'
import from_format_player_logs from './from-format-player-logs'
import {
  common_column_params,
  named_scoring_formats,
  DEFAULT_SCORING_FORMAT_HASH
} from '@libs-shared'

const { single_year, single_year_offset } = common_column_params

const scoring_format_hash_param = {
  label: 'Scoring Format',
  values: Object.entries(named_scoring_formats).map(([key, format]) => ({
    value: format.hash,
    label: format.label
  })),
  data_type: table_constants.TABLE_DATA_TYPES.SELECT,
  default_value: DEFAULT_SCORING_FORMAT_HASH,
  single: true
}

const from_scoring_format_seasonlogs = (field) => ({
  ...from_format_player_logs(field),
  column_groups: [COLUMN_GROUPS.FANTASY_POINTS, COLUMN_GROUPS.SEASON],
  column_params: {
    year: single_year,
    year_offset: single_year_offset,
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
