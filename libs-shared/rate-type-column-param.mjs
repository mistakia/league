import * as table_constants from 'react-table/src/constants.mjs'

export default {
  data_type: table_constants.TABLE_DATA_TYPES.SELECT,
  values: [
    {
      value: null,
      label: 'None'
    },
    {
      value: 'per_game',
      label: 'Per Game'
    }
  ],
  default_value: null,
  single: true
}
