import * as table_constants from 'react-table/src/constants.mjs'

import COLUMN_GROUPS from './column-groups'
import { constants } from '@libs-shared'

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
      values: constants.years,
      data_type: table_constants.TABLE_DATA_TYPES.SELECT,
      default_value: constants.season.current_year,
      single: true,
      enable_on_splits: ['year'],
      enable_multi_on_split: ['year']
    },
    year_offset: {
      data_type: table_constants.TABLE_DATA_TYPES.RANGE,
      label: 'Year + N',
      min: -30,
      max: 30,
      default_value: 0,
      is_single: true,
      enable_on_splits: ['year']
    }
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
