import * as table_constants from 'react-table/src/constants.mjs'

import data_view_column_definitions from '#libs-server/data-views-column-definitions/index.mjs'
import {
  data_view_fields_index,
  nfl_plays_column_params,
  nfl_plays_team_column_params,
  common_column_params
} from '#libs-shared'
import { read_client_column_params } from './read-client-column-params.mjs'

// Read at module load rather than inside the builder so every consumer of the
// catalog stays synchronous. The client registries are ESM singletons evaluated
// once at import, so there is nothing to re-read later.
const {
  column_params_by_id: client_column_params,
  carve_out_modules: client_carve_out_modules,
  failed_modules: client_failed_modules
} = await read_client_column_params()

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
// Per-column param vocabulary comes from BOTH registries. The server column
// definitions declare `column_params` on a minority of columns; the client
// field registry (app/core/data-views-fields/) declares them on most, and is
// the only place the params a user actually reaches for -- `time_type`,
// `nfl_week_id`, `output`, `market_type` -- are written down. See
// `read-client-column-params.mjs` for why that registry was unreadable from the
// server until now, and for the five modules still carved out of it.

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
const build_column_params = ({
  column_id,
  definition,
  shared_params,
  column_params_from_client
}) => {
  // `consumes_params_extra` is the third declared source, and the only one that
  // is keys rather than definitions: a plays-backed column lists every
  // `nfl_plays_column_params` key `apply_play_by_play_column_params_to_query`
  // may read from it, so the output aggregator can hash per-column filter
  // divergence. The column accepts each of those keys, which is exactly what
  // this catalog is for, so they resolve against the shared registry.
  const params_from_consumes = Object.fromEntries(
    (Array.isArray(definition.consumes_params_extra)
      ? definition.consumes_params_extra
      : []
    )
      .filter((param_key) => shared_params[param_key])
      .map((param_key) => [param_key, shared_params[param_key]])
  )

  // The server definition wins a key collision: it is what actually answers the
  // query, so where the registries spell a param differently the executable
  // spelling is the honest one to advertise.
  const column_params = {
    ...params_from_consumes,
    ...column_params_from_client[column_id],
    ...definition.column_params
  }

  if (!Object.keys(column_params).length) {
    return {}
  }

  const param_keys = []
  const param_overrides = {}

  for (const [param_key, param_definition] of Object.entries(column_params)) {
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
  param_registries = default_param_registries,
  column_params_from_client = client_column_params
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
        ...build_column_params({
          column_id,
          definition,
          shared_params,
          column_params_from_client
        })
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
      orphaned_description_ids,
      // What share of columns advertise any param vocabulary at all. This is
      // the number the whole exercise moves, and it is reported rather than
      // asserted so a regression shows up as a count instead of as a quietly
      // worse generation result.
      columns_with_param_keys: columns.filter((column) => column.param_keys)
        .length,
      // The client modules still unreadable from the server. Their columns can
      // only advertise what the server restates, so this list bounds what the
      // catalog still cannot see.
      client_carve_out_modules,
      // Modules that were expected to load and did not. Always empty in a
      // healthy tree; a non-empty list means the catalog is degraded and the
      // param-coverage ratchet is the thing that will say so out loud.
      client_failed_modules
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
