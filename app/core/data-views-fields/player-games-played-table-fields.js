import * as table_constants from 'react-table/src/constants.mjs'
import { common_column_params } from '@libs-shared'

const { nfl_week_id, year_offset, career_year } = common_column_params

export default {
  player_games_played: {
    column_title: 'Games Played',
    header_label: 'GP',
    player_value_path: 'games_played',
    size: 50,
    data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
    column_params: {
      nfl_week_id,
      year_offset,
      career_year
    },
    row_axes: ['year']
  }
}
