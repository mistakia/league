import COLUMN_GROUPS from './column-groups'
import * as table_constants from 'react-table/src/constants.mjs'
import { common_column_params } from '#libs-shared'
import { current_season } from '@constants'

const { single_year } = common_column_params

const create_player_adp_field = (props) => ({
  ...props,
  column_groups: [COLUMN_GROUPS.ADP],
  size: 70,
  data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
  column_params: {
    year: {
      ...single_year,
      default_value: current_season.year
    },
    adp_source_id: {
      values: [
        'SLEEPER',
        'ESPN',
        'YAHOO',
        'MFL',
        'NFL',
        'CBS',
        'UNDERDOG',
        'DRAFTKINGS',
        'RTS'
      ],
      data_type: table_constants.TABLE_DATA_TYPES.SELECT,
      single: true,
      default_value: 'SLEEPER',
      label: 'ADP Source'
    },
    contest_style: {
      values: ['MANAGED', 'BEST_BALL'],
      data_type: table_constants.TABLE_DATA_TYPES.SELECT,
      single: true,
      default_value: 'MANAGED',
      label: 'Contest Style'
    },
    scoring_class: {
      values: ['STANDARD', 'PPR', 'HALF_PPR'],
      data_type: table_constants.TABLE_DATA_TYPES.SELECT,
      single: true,
      default_value: 'PPR',
      label: 'Scoring'
    },
    num_qb: {
      values: [1, 2],
      data_type: table_constants.TABLE_DATA_TYPES.SELECT,
      single: true,
      default_value: 1,
      label: 'QB Count'
    },
    duration: {
      values: ['REDRAFT', 'DYNASTY'],
      data_type: table_constants.TABLE_DATA_TYPES.SELECT,
      single: true,
      default_value: 'REDRAFT',
      label: 'Duration'
    },
    draft_pool: {
      values: ['ALL', 'ROOKIE'],
      data_type: table_constants.TABLE_DATA_TYPES.SELECT,
      single: true,
      default_value: 'ALL',
      label: 'Draft Pool'
    }
  },
  row_axes: ['year']
})

export default {
  player_adp: create_player_adp_field({
    column_title: 'Average Draft Position (ADP)',
    header_label: 'ADP',
    player_value_path: 'adp',
    reverse_percentiles: true
  }),
  // Min Pick / Max Pick are populated only by the dormant MFL/CBS importers
  // (last run 2024-09-02); they are empty for the live sources (Sleeper,
  // Underdog). The ADP StdDev / Sample Size / % Drafted columns were removed
  // 2026-06-29 because no importer has ever populated their backing columns.
  player_adp_min: create_player_adp_field({
    column_title: 'Minimum Draft Position',
    header_label: 'Min Pick',
    player_value_path: 'adp_min',
    reverse_percentiles: true
  }),
  player_adp_max: create_player_adp_field({
    column_title: 'Maximum Draft Position',
    header_label: 'Max Pick',
    player_value_path: 'adp_max',
    reverse_percentiles: true
  })
}
