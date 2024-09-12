import * as table_constants from 'react-table/src/constants.mjs'

import COLUMN_GROUPS from './column-groups'
import { constants, common_column_params } from '@libs-shared'

const { single_year, single_year_offset } = common_column_params

const shared_properties = {
  data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
  size: 70,
  column_groups: [COLUMN_GROUPS.KEEPTRADECUT],
  column_params: {
    date: {
      disable_on_splits: true,
      data_type: table_constants.TABLE_DATA_TYPES.DATE,
      default_value: null,
      default_label: 'Latest',
      datepicker_props: {
        disableFuture: true
      }
    },
    year: {
      ...single_year,
      default_value: constants.year,
      enable_on_splits: ['year']
    },
    year_offset: single_year_offset
  },
  splits: ['year']
}

export default {
  player_keeptradecut_value: {
    ...shared_properties,
    column_title: 'KeepTradeCut Value',
    header_label: 'Value',
    player_value_path: 'player_keeptradecut_value'
  },
  player_keeptradecut_overall_rank: {
    ...shared_properties,
    column_title: 'KeepTradeCut Overall Rank',
    header_label: 'OVR',
    player_value_path: 'player_keeptradecut_overall_rank'
  },
  player_keeptradecut_position_rank: {
    ...shared_properties,
    column_title: 'KeepTradeCut Position Rank',
    header_label: 'Pos',
    player_value_path: 'player_keeptradecut_position_rank'
  }
}
