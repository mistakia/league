import * as table_constants from 'react-table/src/constants.mjs'

import COLUMN_GROUPS from './column-groups'
import {
  nfl_plays_column_params,
  rate_type_column_param,
  named_scoring_formats,
  DEFAULT_SCORING_FORMAT_HASH
} from '@libs-shared'

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

export default {
  player_fantasy_points_from_plays: {
    data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
    column_params: {
      scoring_format_hash: scoring_format_hash_param,
      rate_type: rate_type_column_param.offensive_player_rate_type_param,
      ...nfl_plays_column_params
    },
    size: 70,
    splits: ['year', 'week'],
    column_title: 'Fantasy Points (By Play)',
    column_groups: [COLUMN_GROUPS.FANTASY_POINTS],
    header_label: 'FP',
    player_value_path: 'fantasy_points_from_plays',
    fixed: 1
  }
}
