import COLUMN_GROUPS from './column-groups'
import * as table_constants from 'react-table/src/constants.mjs'
import { common_column_params, constants } from '@libs-shared'

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
        values: Array.from(
          { length: constants.season.stats_season_year - 2016 },
          (_, i) => constants.season.stats_season_year - i
        )
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
