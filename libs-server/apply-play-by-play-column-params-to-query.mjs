import nfl_plays_column_params, {
  nfl_games_params
} from '#libs-shared/nfl-plays-column-params.mjs'
import * as table_constants from 'react-table/src/constants.mjs'
import {
  decompose_nfl_weeks,
  is_full_year_seas_type_coverage
} from '#libs-shared/nfl-week-identifier.mjs'
import resolve_nfl_week_id_from_year_param from '#libs-server/data-views/resolve-nfl-week-id-from-year-param.mjs'
import { apply_scope_to_query } from '#libs-server/data-views/apply-scope-to-query.mjs'

const nfl_games_param_keys = Object.keys(nfl_games_params)

export default function ({
  query,
  params,
  table_name = 'nfl_plays',
  skip_param_name = null,
  query_context = null
}) {
  // View-scope-aware time predicate emission. When a query_context is
  // supplied (data-views path), apply_scope_to_query owns the year /
  // seas_type / nfl_week_id predicates and inherits the view-level REG
  // default for columns that supply no time params of their own. The
  // per-key iteration below then skips those keys to avoid duplicates.
  //
  // For callers without a query_context (legacy entrypoints / plays-view),
  // fall back to the column-only self-resolve: when only year is supplied,
  // expand year (+ default REG seas_type) into nfl_week_id so the IN-list
  // branch emits the derived year/seas_type predicates.
  const scope_owned = Boolean(
    query_context &&
      query_context.nfl_week_ids &&
      query_context.nfl_week_ids.length &&
      skip_param_name !== 'nfl_week_id'
  )
  if (scope_owned) {
    apply_scope_to_query({
      query,
      table_name,
      query_context,
      column_params: params
    })
    params = { ...params }
    delete params.nfl_week_id
    delete params.year
    delete params.seas_type
  } else if (
    !params.nfl_week_id &&
    params.year &&
    skip_param_name !== 'nfl_week_id'
  ) {
    const resolved = resolve_nfl_week_id_from_year_param(params)
    if (resolved.length) {
      params = { ...params, nfl_week_id: resolved }
    }
  }
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
          const { years, seas_types } = decompose_nfl_weeks({
            nfl_weeks: column_values
          })
          const covers_full_year_seas_type = is_full_year_seas_type_coverage({
            nfl_weeks: column_values
          })
          if (!covers_full_year_seas_type) {
            query.whereIn(`${param_table}.${column_name}`, column_values)
          }
          // Only emit derived year IN when `year` is not set as a param of its
          // own -- the year column_param iteration emits it independently and
          // a duplicate predicate is cosmetic noise.
          if (years.length && params.year == null) {
            query.whereIn(`${param_table}.year`, years)
          }
          if (seas_types.length) {
            query.whereIn(`${param_table}.seas_type`, seas_types)
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
        if (!value || typeof value !== 'object' || Array.isArray(value))
          continue
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
