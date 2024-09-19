import * as table_constants from 'react-table/src/constants.mjs'
import { nfl_plays_column_params, rate_type_column_param } from '@libs-shared'
import COLUMN_GROUPS from './column-groups'

export default {
  player_routes: {
    column_title: 'Player Routes (By Play)',
    header_label: 'RTE',
    player_value_path: 'player_routes',
    size: 60,
    data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
    column_groups: [COLUMN_GROUPS.OPPURTUNITY],
    column_params: {
      rate_type: rate_type_column_param.offensive_rate_type_param,
      ...nfl_plays_column_params
    },
    splits: ['year', 'week']
  }
}
