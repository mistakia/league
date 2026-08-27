// Strict resolution of a GENERATED `table_state`: reject anything the registry
// does not provide, before it renders.
//
// This is deliberately the opposite of the path a saved view takes, and the two
// must not be merged.
//
// SILENT DROP IS CORRECT FOR A SAVED VIEW AND WRONG FOR A GENERATED ONE. A view
// saved in 2023 can name a column that has since been renamed away; dropping it
// and rendering the rest is the kindest thing to do, and every consumer does it:
// react-table skips a `column_id` that misses `all_columns`
// (`table/table.js:429-471`), the percentile selector skips it, and
// `apply-play-by-play-column-params-to-query.mjs` iterates the PARAM REGISTRY
// rather than the request -- so a param key the request supplies and the
// registry does not know is not skipped loudly, it is never looked at.
//
// Apply that same tolerance to fresh model output and a fabricated column id
// produces a rendered table, with a wrong answer, and no error anywhere. The
// user cannot tell the difference between "the model answered your question"
// and "the model invented three columns that were dropped on the way to the
// screen". That is the dominant correctness risk in this whole feature, and it
// is why this module exists as a separate gate rather than as a stricter mode
// on the shared one.
//
// WHAT IT DOES NOT CHECK, AND WHY NOT. There is no check that a param KEY
// exists, and that absence is measured rather than an oversight.
//
// The param vocabulary is not server-side. Only 56 of 597 column definitions
// declare `column_params`; for the rest it lives in the CLIENT field registry
// (`app/core/data-views-fields/`), where 31 of 33 modules import React or
// `@components` for their cell renderers and none of it can be loaded here. A
// key-existence check built on the server-visible registries alone rejected
// 123 of the 186 production saved views over 3,219 errors, on real keys --
// `time_type` (732 uses), `source_id` (700), `market_type` (700) -- which are
// the very head of real param usage. A check with that false-positive rate does
// not get fixed, it gets turned off, and it takes the checks that DO work with
// it.
//
// So what is enforced is what can be enforced correctly: every `column_id`
// against the full 597-column registry, and every param VALUE for which a
// definition is actually known. On the same corpus that pair produces 10
// findings, all of them real -- stale column ids in old saved views, and four
// `nfl_week_id` values outside the canonical identifier set.
//
// Closing the key gap means making the client field registry importable by
// splitting each module's data half from its render half. That is a 31-file
// refactor in a contended area and it is its own task. Until it lands, a
// fabricated param KEY reaches the query builder and is silently ignored there,
// exactly as it is today for a saved view.

import {
  get_data_view_generation_catalog,
  build_data_view_generation_catalog
} from './build-data-view-generation-catalog.mjs'

export const RESOLVER_ERROR_CODES = {
  malformed_table_state: 'malformed_table_state',
  unknown_column_id: 'unknown_column_id',
  invalid_param_value: 'invalid_param_value'
}

// A column entry is either a bare id or `{ column_id, params }`. Both shapes are
// live in production saved views, so both are accepted here.
const read_column_id = (column) =>
  typeof column === 'string'
    ? column
    : column && typeof column === 'object'
      ? column.column_id || column.id || column.column_name
      : null

const read_column_params = (column) =>
  column && typeof column === 'object' && column.params ? column.params : {}

/**
 * The set of param keys a column may carry, and the definition behind each.
 *
 * A column's OWN declaration wins over the shared registry for the same key --
 * `seas_type` is PFF's three-value vocabulary on a PFF column and the NFL's
 * everywhere else, and checking a PFF value against the NFL set would reject a
 * correct request.
 */
const resolve_param_definition = ({ catalog_column, catalog, param_key }) => {
  const override = catalog_column?.param_overrides?.[param_key]
  if (override) return override

  if (catalog_column?.param_keys?.includes(param_key)) {
    return catalog.params[param_key] || { param_key }
  }

  return catalog.params[param_key] || null
}

const is_dynamic_value = (value) =>
  value !== null && typeof value === 'object' && 'dynamic_type' in value

/**
 * Whether one supplied value is admissible for a param definition.
 *
 * Returns null when admissible, or a reason string. A param that enumerates no
 * values is not checked -- a free NUMBER or TEXT param has no set to be outside
 * of, and inventing one here would reject correct requests.
 */
const check_param_value = ({ definition, value }) => {
  if (is_dynamic_value(value)) {
    const declared = definition.dynamic_types || []
    return declared.includes(value.dynamic_type)
      ? null
      : `dynamic_type '${value.dynamic_type}' is not one of ${declared.join(', ') || 'any (this param declares no dynamic values)'}`
  }

  if (definition.data_type === 'RANGE') {
    const bounds = [value].flat()
    for (const bound of bounds) {
      if (typeof bound !== 'number') {
        return `a RANGE param takes numbers, got ${JSON.stringify(bound)}`
      }
      if (definition.min !== undefined && bound < definition.min) {
        return `${bound} is below the minimum ${definition.min}`
      }
      if (definition.max !== undefined && bound > definition.max) {
        return `${bound} is above the maximum ${definition.max}`
      }
    }
    return null
  }

  if (!definition.values) return null

  const declared_dynamic = definition.dynamic_types || []
  const supplied = Array.isArray(value) ? value : [value]
  for (const entry of supplied) {
    if (is_dynamic_value(entry)) {
      if (!declared_dynamic.includes(entry.dynamic_type)) {
        return `dynamic_type '${entry.dynamic_type}' is not one of ${declared_dynamic.join(', ') || 'any'}`
      }
      continue
    }
    // The older persisted shape writes a dynamic value as the bare token
    // ('last_n_years') where the current one writes { dynamic_type }. Saved
    // views are immutable and carry the old spelling forever, so both are read.
    if (declared_dynamic.includes(entry)) continue
    // Loose comparison on purpose: a year arrives as 2024 from the model and
    // 2024 or '2024' from a saved view, and both select the same rows.
    const admitted = definition.values.some(
      // eslint-disable-next-line eqeqeq
      (permitted) => permitted == entry
    )
    if (!admitted) {
      const shown = definition.values.slice(0, 12).join(', ')
      return `'${entry}' is not one of the ${definition.values.length} permitted values (${shown}${definition.values.length > 12 ? ', ...' : ''})`
    }
  }

  return null
}

const check_params = ({ params, catalog_column, catalog, path, errors }) => {
  for (const [param_key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null) continue

    // `output` is the aggregation contract, not a filter param, and it is
    // declared by the column through `supports_output` rather than by the param
    // registry. Checking it against the registry would reject every rate column
    // in the corpus.
    if (param_key === 'output') continue

    const definition = resolve_param_definition({
      catalog_column,
      catalog,
      param_key
    })

    // Unknown here means "not visible from the server", not "not real" -- see
    // the header. Nothing is reported, because the alternative was measured and
    // it was a two-thirds false-positive rate.
    if (!definition) continue

    const reason = check_param_value({ definition, value })
    if (reason) {
      errors.push({
        code: RESOLVER_ERROR_CODES.invalid_param_value,
        path: `${path}.params.${param_key}`,
        message: `${param_key}: ${reason}`
      })
    }
  }
}

/**
 * Resolve a generated `table_state` against the live registry.
 *
 * Returns rather than throws, because the caller feeds the errors back to the
 * model for exactly one repair round and needs them as data.
 *
 * @param {object} params
 * @param {object} params.table_state
 * @param {object} [params.catalog] - injected for tests and controls
 * @returns {{ ok: boolean, errors: Array<{code: string, path: string, message: string}>, table_state: object }}
 */
export const resolve_generated_table_state = ({
  table_state,
  catalog = get_data_view_generation_catalog()
}) => {
  const errors = []

  if (!table_state || typeof table_state !== 'object') {
    return {
      ok: false,
      errors: [
        {
          code: RESOLVER_ERROR_CODES.malformed_table_state,
          path: 'table_state',
          message: 'table_state must be an object'
        }
      ],
      table_state
    }
  }

  const columns_by_id = new Map(
    catalog.columns.map((column) => [column.column_id, column])
  )

  // A row axis is a legitimate sort and filter key and is NOT a registry
  // column: a view split by year sorts on `year`, which no column definition
  // provides. Reading the axes off the request rather than from a fixed list is
  // deliberate -- the axis vocabulary is the caller's own declaration, so a
  // hardcoded {year, week} here would reject the next axis the product adds.
  const row_axes = new Set(
    Array.isArray(table_state.row_axes) ? table_state.row_axes : []
  )

  const check_column_entry = ({ entry, path }) => {
    const column_id = read_column_id(entry)

    if (!column_id) {
      errors.push({
        code: RESOLVER_ERROR_CODES.malformed_table_state,
        path,
        message: `carries no column_id (${JSON.stringify(entry)})`
      })
      return
    }

    if (row_axes.has(column_id)) return

    const catalog_column = columns_by_id.get(column_id)
    if (!catalog_column) {
      errors.push({
        code: RESOLVER_ERROR_CODES.unknown_column_id,
        path,
        message: `'${column_id}' is not a column the registry provides`
      })
      return
    }

    check_params({
      params: read_column_params(entry),
      catalog_column,
      catalog,
      path,
      errors
    })
  }

  for (const [key, entries] of [
    ['columns', table_state.columns],
    ['prefix_columns', table_state.prefix_columns]
  ]) {
    if (entries === undefined) continue
    if (!Array.isArray(entries)) {
      errors.push({
        code: RESOLVER_ERROR_CODES.malformed_table_state,
        path: key,
        message: `${key} must be an array`
      })
      continue
    }
    entries.forEach((entry, index) =>
      check_column_entry({ entry, path: `${key}[${index}]` })
    )
  }

  // A where clause and a sort both name a column, and both reach the SQL
  // builder. A fabricated id in either is the same defect wearing a different
  // key -- and a `where` naming an unknown column is the worse half, because it
  // silently widens the result set rather than narrowing it.
  for (const [key, entries] of [
    ['where', table_state.where],
    ['sort', table_state.sort]
  ]) {
    if (entries === undefined) continue
    if (!Array.isArray(entries)) {
      errors.push({
        code: RESOLVER_ERROR_CODES.malformed_table_state,
        path: key,
        message: `${key} must be an array`
      })
      continue
    }
    entries.forEach((entry, index) =>
      check_column_entry({ entry, path: `${key}[${index}]` })
    )
  }

  return { ok: errors.length === 0, errors, table_state }
}

/**
 * The errors as one block of prose for the repair round.
 *
 * Kept beside the resolver rather than at the call site so the repair prompt
 * and the verdict cannot drift apart.
 *
 * @param {object} params
 * @param {Array<object>} params.errors
 * @returns {string}
 */
export const format_resolver_errors = ({ errors }) =>
  errors.map((error) => `- ${error.path}: ${error.message}`).join('\n')

export { build_data_view_generation_catalog }
