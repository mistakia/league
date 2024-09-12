import COLUMN_GROUPS from './column-groups'
import * as table_constants from 'react-table/src/constants.mjs'
import { common_column_params } from '#libs-shared'

const { single_year, single_week } = common_column_params

const create_practice_field = (props) => ({
  ...props,
  column_groups: [COLUMN_GROUPS.PRACTICE],
  size: 70,
  data_type: table_constants.TABLE_DATA_TYPES.TEXT,
  column_params: {
    year: single_year,
    single_week
  },
  splits: ['year', 'week']
})

export default {
  player_practice_status: create_practice_field({
    column_title: 'Practice Status',
    header_label: 'Status',
    player_value_path: 'practice_status'
  }),
  player_practice_injury: create_practice_field({
    column_title: 'Practice Injury',
    header_label: 'Injury',
    player_value_path: 'practice_injury'
  }),
  player_practice_designation_monday: create_practice_field({
    column_title: 'Monday Practice Designation',
    header_label: 'Mon',
    player_value_path: 'player_practice_designation_m'
  }),
  player_practice_designation_tuesday: create_practice_field({
    column_title: 'Tuesday Practice Designation',
    header_label: 'Tue',
    player_value_path: 'player_practice_designation_tu'
  }),
  player_practice_designation_wednesday: create_practice_field({
    column_title: 'Wednesday Practice Designation',
    header_label: 'Wed',
    player_value_path: 'player_practice_designation_w'
  }),
  player_practice_designation_thursday: create_practice_field({
    column_title: 'Thursday Practice Designation',
    header_label: 'Thu',
    player_value_path: 'player_practice_designation_th'
  }),
  player_practice_designation_friday: create_practice_field({
    column_title: 'Friday Practice Designation',
    header_label: 'Fri',
    player_value_path: 'player_practice_designation_f'
  }),
  player_practice_designation_saturday: create_practice_field({
    column_title: 'Saturday Practice Designation',
    header_label: 'Sat',
    player_value_path: 'player_practice_designation_s'
  }),
  player_practice_designation_sunday: create_practice_field({
    column_title: 'Sunday Practice Designation',
    header_label: 'Sun',
    player_value_path: 'player_practice_designation_su'
  })
}
