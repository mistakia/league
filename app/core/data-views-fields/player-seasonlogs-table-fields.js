import { constants, common_column_params } from '@libs-shared'
import COLUMN_GROUPS from './column-groups'
import * as table_constants from 'react-table/src/constants.mjs'

const { single_year } = common_column_params

const seasonlog_field = (props) => ({
  ...props,
  column_groups: [COLUMN_GROUPS.CAREER],
  size: 70,
  data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
  column_params: {
    year: single_year
  }
})

export default function ({ is_logged_in }) {
  const fields = {
    player_career_year: seasonlog_field({
      column_title: 'Career Year',
      header_label: 'Career Yr',
      player_value_path: 'career_year'
    })
  }

  if (!is_logged_in) {
    Object.keys(fields).forEach((key) => {
      fields[key].hidden = true
    })
  }

  return fields
}
