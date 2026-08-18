import * as table_constants from 'react-table/src/constants.mjs'

import COLUMN_GROUPS from './column-groups'
import { common_column_params } from '#libs-shared'
import { current_season } from '#constants'
import { format_month_day } from './month-day.mjs'

const { single_year, single_year_offset } = common_column_params

const shared_properties = {
  data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
  size: 70,
  column_groups: [COLUMN_GROUPS.KEEPTRADECUT],
  column_params: {
    date: {
      disable_on_row_axes: true,
      data_type: table_constants.TABLE_DATA_TYPES.DATE,
      default_label: 'Latest',
      datepicker_props: {
        disableFuture: true
      }
    },
    year: {
      ...single_year,
      default_value: current_season.year,
      enable_on_row_axes: ['year']
    },
    year_offset: single_year_offset,
    // Year-axis only: under a week axis the week branch of the join wins and
    // this is ignored, so the control hides itself there too. Stored as a bare
    // `MM-DD`; format_value is what renders `03-01` as `Mar 1` rather than
    // falling through format_column_params to String(value). The component is
    // assigned in ./index.js -- no fields file imports React.
    as_of_month_day: {
      label: 'As of month/day',
      short_label: 'As of',
      default_label: 'Opening day',
      enable_on_row_axes: ['year'],
      show_key_in_short: true,
      format_value: ({ value }) => format_month_day(value) || String(value)
    }
  },
  row_axes: ['year']
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
    player_value_path: 'player_keeptradecut_overall_rank',
    reverse_percentiles: true
  },
  player_keeptradecut_position_rank: {
    ...shared_properties,
    column_title: 'KeepTradeCut Position Rank',
    header_label: 'Pos',
    player_value_path: 'player_keeptradecut_position_rank',
    reverse_percentiles: true
  }
}
