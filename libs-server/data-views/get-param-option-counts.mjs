import debug from 'debug'

import db from '#db'
import {
  nfl_plays_column_params,
  serialize_preset_value
} from '#libs-shared'
import * as table_constants from 'react-table/src/constants.mjs'
import apply_play_by_play_column_params_to_query from '#libs-server/apply-play-by-play-column-params-to-query.mjs'

const log = debug('param-option-counts')

const STATEMENT_TIMEOUT_MS = 10000

const collect_other_params = ({ table_state, target_param_name }) => {
  const params = {}
  const where = Array.isArray(table_state?.where) ? table_state.where : []
  for (const where_item of where) {
    const where_params = where_item?.params
    if (!where_params || typeof where_params !== 'object') continue
    for (const key of Object.keys(where_params)) {
      if (key === target_param_name) continue
      if (!Object.prototype.hasOwnProperty.call(nfl_plays_column_params, key)) {
        continue
      }
      params[key] = where_params[key]
    }
  }
  return params
}

export default async function get_param_option_counts({
  table_state,
  target_param_name
}) {
  const generated_at = new Date().toISOString()

  const target_definition = nfl_plays_column_params[target_param_name]
  if (!target_definition) {
    throw new Error(`Unknown target_param_name: ${target_param_name}`)
  }
  if (
    target_definition.data_type !==
    table_constants.TABLE_DATA_TYPES.OBJECT_PRESET
  ) {
    throw new Error(
      `target_param_name ${target_param_name} is not an object preset`
    )
  }
  const column_specs = target_definition.column_specs
  if (!Array.isArray(column_specs) || column_specs.length === 0) {
    throw new Error(
      `Missing column_specs for object preset param ${target_param_name}`
    )
  }

  const other_params = collect_other_params({ table_state, target_param_name })
  const param_table = target_definition.table || 'nfl_plays'

  // Restrict GROUP BY to keys actually used by preset_values so the query
  // matches the existing covering indexes (e.g. off_personnel_counts_idx on
  // rb/te/wr). Including unused spec columns falls off the index path and
  // forces a full Seq Scan across all year partitions.
  const preset_values = Array.isArray(target_definition.preset_values)
    ? target_definition.preset_values
    : []
  const preset_keys_used = new Set()
  for (const preset of preset_values) {
    if (!preset || !preset.value || typeof preset.value !== 'object') continue
    for (const key of Object.keys(preset.value)) preset_keys_used.add(key)
  }
  const active_specs = column_specs.filter((spec) =>
    preset_keys_used.has(spec.key)
  )
  if (active_specs.length === 0) {
    return { counts: {}, generated_at }
  }
  const select_exprs = active_specs.map(
    (spec) => `${param_table}.${spec.column}`
  )

  try {
    const query = db(param_table)
      .select(...select_exprs)
      .count('* as count')
      .groupBy(...select_exprs)

    apply_play_by_play_column_params_to_query({
      query,
      params: other_params,
      table_name: param_table,
      skip_param_name: target_param_name
    })

    const rows = await db.transaction(async (trx) => {
      await trx.raw(`SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`)
      return query.transacting(trx)
    })

    const counts = {}
    for (const row of rows) {
      const value_object = {}
      for (const spec of active_specs) {
        const v = row[spec.column]
        if (v === null || v === undefined) continue
        value_object[spec.key] = Number(v)
      }
      const signature = serialize_preset_value(value_object)
      if (!signature) continue
      counts[signature] = Number(row.count)
    }

    return { counts, generated_at }
  } catch (err) {
    log('get_param_option_counts failed for %s: %s', target_param_name, err.message)
    return { counts: {}, generated_at }
  }
}

export { collect_other_params }
