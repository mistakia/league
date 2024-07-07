import * as table_constants from 'react-table/src/constants.mjs'

const from_format_player_logs = (field) => ({
  data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
  size: 70,
  ...field
})

export default from_format_player_logs
