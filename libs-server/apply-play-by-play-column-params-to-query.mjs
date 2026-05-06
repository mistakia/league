import nfl_plays_column_params, {
  nfl_games_params
} from '#libs-shared/nfl-plays-column-params.mjs'
import * as table_constants from 'react-table/src/constants.mjs'
import {
  decompose_nfl_weeks,
  is_full_reg_season_nfl_week_id_set
} from '#libs-shared/nfl-week-identifier.mjs'

const nfl_games_param_keys = Object.keys(nfl_games_params)

export default function ({
  query,
  params,
  table_name = 'nfl_plays',
  skip_param_name = null
}) {
  const column_param_keys = Object.keys(nfl_plays_column_params)
  let nfl_games_joined = false

  for (const column_param_key of column_param_keys) {
    if (column_param_key === 'year_offset') {
      continue
    }

    if (skip_param_name && column_param_key === skip_param_name) {
      continue
    }

    const param_value = params[column_param_key]

    if (typeof param_value === 'undefined' || param_value === null) {
      continue
    }

    const column_param_definition = nfl_plays_column_params[column_param_key]
    const column_name = column_param_definition.column_name || column_param_key
    const is_nfl_games_param = nfl_games_param_keys.includes(column_param_key)
    const param_table = is_nfl_games_param
      ? 'nfl_games'
      : column_param_definition.table || table_name
    const is_range =
      column_param_definition.data_type ===
      table_constants.TABLE_DATA_TYPES.RANGE

    if (is_nfl_games_param) {
      if (!nfl_games_joined) {
        query.join('nfl_games', 'nfl_games.esbid', '=', `${table_name}.esbid`)
        nfl_games_joined = true
      }
    }

    if (is_range) {
      const param_value_0 = Number(param_value[0])
      const param_value_1 = Number(param_value[1])

      if (isNaN(param_value_0) || isNaN(param_value_1)) {
        throw new Error(`Invalid number range for ${column_param_key}`)
      }

      query.whereBetween(`${param_table}.${column_name}`, [
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
      if (column_values.length) {
        if (column_param_key === 'nfl_week_id') {
          const { years } = decompose_nfl_weeks({ nfl_weeks: column_values })
          const covers_full_seasons = is_full_reg_season_nfl_week_id_set({
            nfl_weeks: column_values
          })
          if (!covers_full_seasons) {
            query.whereIn(`${param_table}.${column_name}`, column_values)
          }
          if (years.length) {
            query.whereIn(`${param_table}.year`, years)
          }
        } else {
          query.whereIn(`${param_table}.${column_name}`, column_values)
        }
      }
    } else if (
      column_param_definition.data_type ===
      table_constants.TABLE_DATA_TYPES.BOOLEAN
    ) {
      query.where(`${param_table}.${column_name}`, param_value)
    } else if (
      column_param_definition.data_type ===
      table_constants.TABLE_DATA_TYPES.OBJECT_PRESET
    ) {
      const column_specs = column_param_definition.column_specs
      if (!Array.isArray(column_specs) || column_specs.length === 0) {
        throw new Error(
          `Missing column_specs for object preset param ${column_param_key}`
        )
      }
      const spec_by_key = Object.fromEntries(
        column_specs.map((s) => [s.key, s])
      )
      const value_array = Array.isArray(param_value)
        ? param_value
        : [param_value]
      const conjunctions = []
      for (const value of value_array) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) continue
        const entries = []
        for (const [value_key, raw] of Object.entries(value)) {
          const spec = spec_by_key[value_key]
          if (!spec) {
            throw new Error(
              `Invalid key '${value_key}' for object preset param ${column_param_key}`
            )
          }
          const numeric = Number(raw)
          if (!Number.isFinite(numeric)) {
            throw new Error(
              `Invalid value for object preset key '${value_key}' in ${column_param_key}`
            )
          }
          entries.push([`${param_table}.${spec.column}`, numeric])
        }
        if (entries.length) conjunctions.push(entries)
      }
      if (conjunctions.length === 0) continue

      query.where((builder) => {
        for (const entries of conjunctions) {
          builder.orWhere((inner) => {
            for (const [col, numeric] of entries) inner.where(col, numeric)
          })
        }
      })
    }
  }
}
