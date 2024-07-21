import * as table_constants from 'react-table/src/constants.mjs'

import COLUMN_GROUPS from './column-groups'
import { nfl_plays_column_params, rate_type_column_param } from '@libs-shared'

const scoring_format_hash_param = {
  label: 'Scoring Format',
  values: [
    {
      value: 'ad64bf40cdfec0a1ebdf66453fa57687832f7556f3870251c044d5d270fc089e',
      label: 'PPR / 4PTD / -1INT / -1FUM'
    }
  ],
  data_type: table_constants.TABLE_DATA_TYPES.SELECT,
  default_value:
    'ad64bf40cdfec0a1ebdf66453fa57687832f7556f3870251c044d5d270fc089e',
  single: true
}

export default {
  player_fantasy_points_from_plays: {
    data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
    column_params: {
      scoring_format_hash: scoring_format_hash_param,
      rate_type: rate_type_column_param,
      ...nfl_plays_column_params
    },
    size: 70,
    splits: ['year'],
    column_title: 'Fantasy Points (By Play)',
    column_groups: [COLUMN_GROUPS.FANTASY_POINTS],
    header_label: 'FP',
    player_value_path: 'fantasy_points_from_plays',
    fixed: 3
  }
}
