import nfl_plays_column_params from '#libs-shared/nfl-plays-column-params.mjs'
import * as table_constants from 'react-table/src/constants.mjs'

export default function ({ query, params, table_name = 'nfl_plays' }) {
  const column_param_keys = Object.keys(nfl_plays_column_params)
  for (const column_param_key of column_param_keys) {
    if (column_param_key === 'year_offset') {
      continue
    }

    let param_value = params[column_param_key]

    if (typeof param_value === 'undefined' || param_value === null) {
      continue
    }

    // if year params and year_offset are set, adjust the year params to include the year for the year_offset
    if (column_param_key === 'year' && params.year_offset) {
      // convert param_value to an array
      param_value = Array.isArray(param_value) ? param_value : [param_value]

      const year_offset = Number(
        Array.isArray(params.year_offset)
          ? params.year_offset[0]
          : params.year_offset
      )

      // Add year_offset to each item in the array and ensure uniqueness
      const adjusted_years = param_value.map(
        (year) => Number(year) + year_offset
      )
      param_value = [...new Set([...param_value, ...adjusted_years])]
    }

    const column_param_definition = nfl_plays_column_params[column_param_key]
    const param_table = column_param_definition.table || table_name
    const is_range =
      column_param_definition.data_type ===
      table_constants.TABLE_DATA_TYPES.RANGE
    if (is_range) {
      const param_value_0 = Number(param_value[0])
      const param_value_1 = Number(param_value[1])

      if (isNaN(param_value_0) || isNaN(param_value_1)) {
        throw new Error(`Invalid number range for ${column_param_key}`)
      }

      query.whereBetween(`${param_table}.${column_param_key}`, [
        Math.min(param_value_0, param_value_1),
        Math.max(param_value_0, param_value_1)
      ])
    } else if (
      column_param_definition.data_type ===
      table_constants.TABLE_DATA_TYPES.SELECT
    ) {
      const column_values = Array.isArray(param_value)
        ? param_value
        : [param_value]
      query.whereIn(`${param_table}.${column_param_key}`, column_values)
    } else if (
      column_param_definition.data_type ===
      table_constants.TABLE_DATA_TYPES.BOOLEAN
    ) {
      query.where(`${param_table}.${column_param_key}`, param_value)
    }
  }
}
