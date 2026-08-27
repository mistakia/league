import * as table_constants from 'react-table/src/constants.mjs'

import data_view_column_definitions from '#libs-server/data-views-column-definitions/index.mjs'
import {
  data_view_fields_index,
  nfl_plays_column_params,
  nfl_plays_team_column_params,
  common_column_params
} from '#libs-shared'

// The model-facing vocabulary for data view generation: every queryable column
// id with its prose description, and every param key with its data type and
// enumerated values.
//
// Derived in process, never committed. A checked-in catalog artifact would rot
// against the registries the moment either moved, and the rot would be silent
// -- the generator would keep offering a column id the server no longer
// answers. Building it from the registries themselves makes that drift
// impossible rather than merely detectable.
//
// The two inputs disagree by construction: the queryable registry and the
// description index are hand-maintained separately, so some columns carry no
// description and some descriptions name no column. This module reports that
// gap (`coverage`) and does not repair it -- policing it is the drift gate's
// job.
//
// One limit worth stating, because it bounds what the catalog can promise:
// per-column param applicability is only partly server-side. A column
// definition may declare `column_params`, and most do not -- the full
// per-column vocabulary lives in the CLIENT field registry
// (app/core/data-views-fields/), which imports React components and so cannot
// be read from the server. The catalog therefore carries the shared param
// registry in full plus per-column keys wherever the server declares them, and
// a caller must not read a missing `param_keys` as "this column takes no
// params".

const DATA_TYPE_NAMES = Object.fromEntries(
  Object.entries(table_constants.TABLE_DATA_TYPES).map(([name, value]) => [
    value,
    name
  ])
)

// The param registries a column definition can draw a key from. Later entries
// win a key collision, which matches the spread order the column definitions
// themselves use.
const default_param_registries = [
  common_column_params,
  nfl_plays_team_column_params,
  nfl_plays_column_params
]

// A param's `values` are either bare scalars or `{ value, label, group }`
// options. The model needs the scalars -- those are what a `table_state`
// carries -- so both shapes normalize to a scalar list.
const normalize_param_values = (values) => {
  if (!Array.isArray(values)) {
    return null
  }

  return values.map((entry) =>
    entry && typeof entry === 'object' && 'value' in entry ? entry.value : entry
  )
}

// Undefined keys are dropped rather than emitted as nulls: this object is
// serialized into a prompt, and an absent key costs nothing where `"min":
// null` costs tokens on every one of the 246 params.
const compact = (object) =>
  Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined)
  )

export const normalize_param_definition = ({ param_key, definition }) => {
  const values = normalize_param_values(definition.values)

  return compact({
    param_key,
    data_type: DATA_TYPE_NAMES[definition.data_type],
    label: definition.label,
    // `single` and `is_single` are the same claim spelled two ways across the
    // registries; a caller only needs to know whether the value is scalar.
    single: definition.single || definition.is_single ? true : undefined,
    default_value: definition.default_value,
    values: values || undefined,
    value_count: values ? values.length : undefined,
    min: definition.min,
    max: definition.max,
    preset_labels: Array.isArray(definition.preset_values)
      ? definition.preset_values.map((preset) => preset.label)
      : undefined,
    dynamic_types: Array.isArray(definition.dynamic_values)
      ? definition.dynamic_values.map((dynamic) => dynamic.dynamic_type)
      : undefined
  })
}

const build_shared_params = ({ param_registries }) => {
  const params = {}

  for (const registry of param_registries) {
    for (const [param_key, definition] of Object.entries(registry)) {
      if (!definition || typeof definition !== 'object') {
        continue
      }
      params[param_key] = normalize_param_definition({ param_key, definition })
    }
  }

  return params
}

// A column may bind a key to its own definition rather than the shared one --
// `seas_type` is PFF's three-value vocabulary on PFF columns and the NFL's
// everywhere else. Emitting the difference per column keeps the shared
// registry honest instead of letting one family's spelling stand for all.
const build_column_params = ({ definition, shared_params }) => {
  if (!definition.column_params) {
    return {}
  }

  const param_keys = []
  const param_overrides = {}

  for (const [param_key, param_definition] of Object.entries(
    definition.column_params
  )) {
    if (!param_definition || typeof param_definition !== 'object') {
      continue
    }

    param_keys.push(param_key)

    const normalized = normalize_param_definition({
      param_key,
      definition: param_definition
    })
    const shared = shared_params[param_key]

    if (!shared || JSON.stringify(shared) !== JSON.stringify(normalized)) {
      param_overrides[param_key] = normalized
    }
  }

  return compact({
    param_keys: param_keys.length ? param_keys : undefined,
    param_overrides: Object.keys(param_overrides).length
      ? param_overrides
      : undefined
  })
}

export const build_data_view_generation_catalog = ({
  column_definitions = data_view_column_definitions,
  field_descriptions = data_view_fields_index,
  param_registries = default_param_registries
} = {}) => {
  const shared_params = build_shared_params({ param_registries })

  const columns = []
  let described_column_count = 0

  for (const [column_id, definition] of Object.entries(column_definitions)) {
    if (!definition || typeof definition !== 'object') {
      continue
    }

    const description = field_descriptions[column_id]
    if (description) {
      described_column_count += 1
    }

    columns.push(
      compact({
        column_id,
        description: description || undefined,
        // How a numeric measure may aggregate to a row. Declared by the
        // column, so it is the one per-column param vocabulary the server
        // holds in full.
        supports_output: definition.supports_output,
        ...build_column_params({ definition, shared_params })
      })
    )
  }

  const orphaned_description_ids = Object.keys(field_descriptions).filter(
    (column_id) => !column_definitions[column_id]
  )

  return {
    columns,
    params: shared_params,
    coverage: {
      column_count: columns.length,
      described_column_count,
      undescribed_column_ids: columns
        .filter((column) => !column.description)
        .map((column) => column.column_id),
      orphaned_description_ids
    }
  }
}

let cached_catalog = null

// Built once and held: the registries are ESM singletons evaluated at import,
// so nothing about the catalog can change without a restart.
export const get_data_view_generation_catalog = () => {
  if (!cached_catalog) {
    cached_catalog = build_data_view_generation_catalog()
  }

  return cached_catalog
}

export default get_data_view_generation_catalog
