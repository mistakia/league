import COLUMN_GROUPS from './column-groups'
import * as table_constants from 'react-table/src/constants.mjs'
import { common_column_params } from '@libs-shared'

const { single_year, career_year } = common_column_params

export default {
  player_pfr_season_value: {
    column_title: 'PFR Season Value',
    header_label: 'PFR Value (Season)',
    size: 80,
    data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
    player_value_path: 'pfr_season_value',
    column_groups: [COLUMN_GROUPS.PFR, COLUMN_GROUPS.SEASON],
    column_params: {
      year: single_year,
      career_year
    }
  }
}
