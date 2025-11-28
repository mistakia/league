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
    adp_type: {
      values: [
        'STANDARD_REDRAFT',
        'PPR_REDRAFT',
        'HALF_PPR_REDRAFT',
        'STANDARD_SUPERFLEX_REDRAFT',
        'PPR_SUPERFLEX_REDRAFT',
        'HALF_PPR_SUPERFLEX_REDRAFT',
        'STANDARD_DYNASTY',
        'PPR_DYNASTY',
        'HALF_PPR_DYNASTY',
        'STANDARD_SUPERFLEX_DYNASTY',
        'PPR_SUPERFLEX_DYNASTY',
        'HALF_PPR_SUPERFLEX_DYNASTY',
        'STANDARD_ROOKIE',
        'PPR_ROOKIE',
        'HALF_PPR_ROOKIE',
        'STANDARD_SUPERFLEX_ROOKIE',
        'PPR_SUPERFLEX_ROOKIE',
        'HALF_PPR_SUPERFLEX_ROOKIE',
        'BESTBALL'
      ],
      data_type: table_constants.TABLE_DATA_TYPES.SELECT,
      single: true,
      default_value: 'PPR_REDRAFT',
      label: 'ADP Type'
    }
  },
  splits: ['year']
})

export default {
  player_adp: create_player_adp_field({
    column_title: 'Average Draft Position (ADP)',
    header_label: 'ADP',
    player_value_path: 'adp',
    reverse_percentiles: true
  }),
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
  }),
  player_adp_stddev: create_player_adp_field({
    column_title: 'ADP Standard Deviation',
    header_label: 'ADP StdDev',
    player_value_path: 'adp_stddev'
  }),
  player_adp_sample_size: create_player_adp_field({
    column_title: 'ADP Sample Size',
    header_label: 'Sample Size',
    player_value_path: 'adp_sample_size'
  }),
  player_percent_drafted: create_player_adp_field({
    column_title: 'Percent Drafted',
    header_label: '% Drafted',
    player_value_path: 'percent_drafted',
    data_type: table_constants.TABLE_DATA_TYPES.PERCENT
  })
}
