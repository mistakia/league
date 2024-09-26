import * as table_constants from 'react-table/src/constants.mjs'
import { nfl_plays_column_params, rate_type_column_param } from '@libs-shared'
import COLUMN_GROUPS from './column-groups'

export default {
  player_snaps: {
    column_title: 'Player Snaps (By Play)',
    header_label: 'Snaps',
    player_value_path: 'player_snaps',
    size: 60,
    data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
    column_groups: [COLUMN_GROUPS.OPPORTUNITY],
    column_params: {
      rate_type: rate_type_column_param.offensive_rate_type_param,
      ...nfl_plays_column_params
    },
    splits: ['year', 'week']
  }
}
