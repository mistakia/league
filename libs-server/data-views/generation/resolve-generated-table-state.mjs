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
// The client field registry IS readable from the server now, and the catalog
// carries it alongside each column's `consumes_params_extra`: columns
// advertising param keys went from 56 of 597 to 440, and `time_type`,
// `nfl_week_id`, `output`, `market_type` and `source_id` are all visible. That
// fixed most of the problem. A key-existence check that once rejected 123 of
// 186 saved views now rejects 11 of 189.
//
// It still does not ship, because of what those 11 turn out to be. Re-measured
// against the 189 production saved views, post-migration, over catalog-known
// columns, with the allowed set built as server `column_params` UNION client
// `column_params` UNION `consumes_params_extra` UNION the shared registries:
// 55 rejections, of which 43 are real params that the query builder actively
// honours and NO registry declares. Folding in `consumes_params_extra` raised
// coverage from 413 to 440 and moved the residual not at all, which is what
// established that these keys are hand-read rather than merely inherited.
//
//   - `sourceid` (17 uses) and `scoring_format_id` (20) are read directly out
//     of `params` by `player-projected-column-definitions.mjs`, which says in
//     as many words that the persisted key deliberately did not move.
//   - `output_column_params` / `output_match_column_params` (6) are WRITTEN by
//     `data-views-saved-view-migration.mjs` itself, so the check would reject a
//     key the system generates one layer up.
//
// That is a 78% false-positive rate, and the cause is a THIRD param source
// beyond the two this catalog reads: params consumed by hand inside a column
// definition's query builder, declared nowhere. A registry cannot see them, so
// no amount of widening the catalog reaches them, and a check at this rate does
// not get fixed -- it gets turned off, and takes the checks that DO work with
// it.
//
// So what is enforced remains what can be enforced correctly: every `column_id`
// against the full 597-column registry, and every param VALUE for which a
// definition is actually known.
//
// Making the key check shippable means giving those hand-read params a
// declaration, so that the query builder and the catalog draw on one source.
// Until then a fabricated param KEY reaches the query builder and is silently
// ignored there, exactly as it is today for a saved view.

import {
  get_data_view_generation_catalog,
  build_data_view_generation_catalog
} from './build-data-view-generation-catalog.mjs'
import { validate_output_param } from '#libs-server/validators.mjs'

export const RESOLVER_ERROR_CODES = {
  malformed_table_state: 'malformed_table_state',
  unknown_column_id: 'unknown_column_id',
  invalid_param_value: 'invalid_param_value',
  unknown_row_axis: 'unknown_row_axis'
}

// The complete row-axis vocabulary. `year` (30 uses) and `week` (11) are the
// only two values across all 189 production saved views, and
// `get-row-axis-label-suffix.mjs` handles exactly these two and nothing else.
export const ROW_AXES = ['year', 'week']

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
    // registry. Checking it against the REGISTRY would reject every rate column
    // in the corpus -- so it is checked against its own schema instead, the
    // same one the executor applies.
    //
    // It used to be skipped outright, and that was the defect: this resolver is
    // what `validate_table_state` returns, and it green-lit an `output` that
    // `preview_view` then refused. An agent that had just been told its
    // candidate was valid got a flat rejection from the next tool, with no
    // error naming `output` anywhere -- and the honest reading of that is that
    // the tools disagree, which is what sent one generation session reading
    // league source instead of fixing its own state.
    if (param_key === 'output') {
      const result = validate_output_param(value)
      if (result !== true) {
        for (const error of result) {
          errors.push({
            code: RESOLVER_ERROR_CODES.invalid_param_value,
            path: `${path}.params.${error.field}`,
            message: error.message
          })
        }
      }
      continue
    }

    const definition = resolve_param_definition({
      catalog_column,
      catalog,
      param_key
    })

    // Unknown here still means "declared in no registry", not "not real" --
    // some of these are params a column definition reads by hand. See the
    // header for the measurement.
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
  // provides. So an id named as an axis is exempt from the registry check --
  // which means the axis list is a WHITELIST, and reading it off the request
  // let the model exempt anything it liked by declaring it an axis. A measured
  // instance: `row_axes: ['player_fantasy_points_per_game_from_seasonlogs']`,
  // a measure column, accepted as a row dimension and rendered.
  //
  // The vocabulary is closed and known, so it is checked against ROW_AXES and
  // only the recognised ones grant the exemption. Adding an axis to the product
  // means adding it there, which is a one-line edit next to the constant that
  // says so.
  const declared_row_axes = Array.isArray(table_state.row_axes)
    ? table_state.row_axes
    : []

  for (const axis of declared_row_axes) {
    if (ROW_AXES.includes(axis)) continue
    errors.push({
      code: RESOLVER_ERROR_CODES.unknown_row_axis,
      path: 'row_axes',
      message: `'${axis}' is not a row axis -- the only axes are ${ROW_AXES.join(', ')}`
    })
  }

  const row_axes = new Set(
    declared_row_axes.filter((axis) => ROW_AXES.includes(axis))
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
