import * as table_constants from 'react-table/src/constants.mjs'
import { common_column_params } from '@libs-shared'

const { year, week, year_offset } = common_column_params

export default {
  player_games_played: {
    column_title: 'Games Played',
    header_label: 'GP',
    player_value_path: 'games_played',
    size: 40,
    date_type: table_constants.TABLE_DATA_TYPES.NUMBER,
    column_params: {
      year,
      week,
      year_offset
    },
    splits: ['year']
  }
}
