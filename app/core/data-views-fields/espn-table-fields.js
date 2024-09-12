import COLUMN_GROUPS from './column-groups'
import * as table_constants from 'react-table/src/constants.mjs'
import { common_column_params } from '@libs-shared'

const { career_year, single_year } = common_column_params

function create_espn_score_field({ score_type, label }) {
  return {
    column_title: `ESPN ${label} Score`,
    column_groups: [COLUMN_GROUPS.ESPN, COLUMN_GROUPS.RECEIVING],
    header_label: label,
    player_value_path: `espn_${score_type}_score`,
    size: 70,
    data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
    column_params: {
      year: {
        ...single_year,
        values: [2023, 2022, 2021, 2020, 2019, 2018, 2017]
      },
      career_year
    },
    splits: ['year']
  }
}

export default {
  player_espn_open_score: create_espn_score_field({
    score_type: 'open',
    label: 'OPEN'
  }),
  player_espn_catch_score: create_espn_score_field({
    score_type: 'catch',
    label: 'CATCH'
  }),
  player_espn_overall_score: create_espn_score_field({
    score_type: 'overall',
    label: 'OVR'
  }),
  player_espn_yac_score: create_espn_score_field({
    score_type: 'yac',
    label: 'YAC'
  })
}
