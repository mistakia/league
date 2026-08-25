import { parse_url_params_to_table_state } from 'react-table/src/utils/parse-url-params-to-table-state.mjs'
import { SHARE_LINK_URL_SCHEMA } from 'react-table/src/constants.mjs'

import {
  migrate_entries_array,
  migrate_sort_array
} from '#libs-shared/data-views-nfl-week-migration.mjs'
import {
  apply_column_id_rename,
  apply_dvoa_type_value_renames,
  apply_table_state_value_renames,
  SHORT_URL_KEY_ALIASES
} from '#libs-shared/data-views-saved-view-migration.mjs'

// Every rename rule this parser applies is declared for the short_url surface
// in TABLE_STATE_RENAMES, so a rule reaches a shared link by being declared
// rather than by being remembered here.
const SHORT_URL_SURFACE = ['short_url']

// A share URL is rewritten by the nfl-week migration and by nothing else -- it
// never enters the versioned chain in data-view-storage/migrations.mjs, because
// a query string carries no version field. So a renamed dvoa_type VALUE has to
// be rewritten here or it is not rewritten anywhere, and unlike a saved view a
// shared link cannot be re-saved once it is out.
const migrate_dvoa_type_entries = (entries) => {
  if (!Array.isArray(entries)) return entries
  return entries.map((entry) => {
    if (!entry || typeof entry !== 'object' || !entry.params) return entry
    const { params, changed } = apply_dvoa_type_value_renames(entry.params)
    return changed ? { ...entry, params } : entry
  })
}

// Same reasoning one level up: a renamed column ID has to be rewritten here or a
// shared link naming the old one breaks on render with no way to repair it. An
// entry is either a bare id string or `{ column_id, params }`, and both shapes
// occur in production URLs.
const migrate_column_id_entries = (entries) => {
  if (!Array.isArray(entries)) return entries
  return entries.map((entry) => {
    if (typeof entry === 'string') return apply_column_id_rename(entry)
    if (!entry || typeof entry !== 'object' || !entry.column_id) return entry
    const column_id = apply_column_id_rename(entry.column_id)
    return column_id === entry.column_id ? entry : { ...entry, column_id }
  })
}

// Pre-rename spellings of `table_state` keys that a shared short URL may still
// carry, mapped to the key that replaced them. These are PERMANENT: a short URL
// is immutable once shared, so unlike a saved view or a localStorage snapshot
// there is no read-time rewrite that can ever retire an entry here.
//
// A URL query string carries no version field, so it never enters the versioned
// migration chain in `libs-shared/data-view-storage/migrations.mjs`. That is why
// the June 2026 `splits` -> `row_axes` rename shipped a `v2_to_v3` rule and still
// lost the row axes of 188 of the 682 production data-view URLs for six weeks:
// they rendered at the wrong grain silently, and the three that also sorted on
// the lost axis emitted an unreachable reference and produced unexecutable SQL.
//
// This is now DERIVED from `TABLE_STATE_RENAMES`, which is the one place a
// top-level key rename is declared, so this surface can no longer be forgotten
// by a rename that lands in the registry. It stays a named export here because
// it is this parser's accepted set, and the gate below reads the parser rather
// than the registry so the two cannot drift.
//
// `db/gates/check-data-view-url-param-coverage.mjs` is the gate that makes the
// next such rename loud. It reads this map as its set of accepted legacy keys,
// so an entry that stops being declared for the short_url surface becomes a
// reported finding there — which is also how that gate's negative control works.
export const LEGACY_URL_PARAM_ALIASES = SHORT_URL_KEY_ALIASES

const is_empty_for_type = (value, type) => {
  if (type === 'array') return !Array.isArray(value) || value.length === 0
  if (type === 'object') return !value || Object.keys(value).length === 0
  return !value
}

// Re-runs the schema parser over a params copy in which each empty aliased key
// has been given its legacy key's raw value, so the legacy value is parsed by
// the same typed logic as a current one rather than by a second parser that can
// drift from it. The schema-driven parser fabricates an empty value for an
// absent key, so "absent" and "explicitly empty" are indistinguishable here --
// and both defer to the legacy key without ambiguity, since no production URL
// carries a non-empty pair.
const apply_legacy_aliases = (search_params, table_state) => {
  const substitutions = []

  for (const [legacy_key, target_key] of Object.entries(
    LEGACY_URL_PARAM_ALIASES
  )) {
    const raw = search_params.get(legacy_key)
    if (raw === null) continue

    const type = SHARE_LINK_URL_SCHEMA.table_state[target_key]
    if (!type) continue
    if (!is_empty_for_type(table_state[target_key], type)) continue

    substitutions.push([target_key, raw])
  }

  if (!substitutions.length) return table_state

  const aliased_params = new URLSearchParams(search_params)
  for (const [target_key, raw] of substitutions) {
    aliased_params.set(target_key, raw)
  }

  return parse_url_params_to_table_state(aliased_params).table_state
}

export default function parse_table_state_from_url(search_params) {
  const { table_state: parsed_table_state, view_fields } =
    parse_url_params_to_table_state(search_params)

  const table_state = apply_legacy_aliases(search_params, parsed_table_state)

  // Top-level VALUE renames, which no gate can see: both param-coverage gates
  // walk KEYS, so a shared link carrying a renamed axis value stays accepted
  // and renders at the wrong grain. Applied after the key aliases above so a
  // URL carrying the legacy KEY gets its values rewritten too.
  const { table_state: axes } = apply_table_state_value_renames(
    {
      // The schema parser's array branch falls back to `[]` only for absent or
      // unparseable input, so a well-formed non-array (`row_axes={"week":true}`)
      // flows straight through as an object and every downstream axis consumer
      // reads garbage. Guard it here for the current and the aliased key alike.
      row_axes: Array.isArray(table_state.row_axes) ? table_state.row_axes : [],
      row_grain:
        Array.isArray(table_state.row_grain) && table_state.row_grain.length
          ? table_state.row_grain
          : ['player']
    },
    { surfaces: SHORT_URL_SURFACE }
  )

  return {
    columns: migrate_column_id_entries(
      migrate_dvoa_type_entries(migrate_entries_array(table_state.columns))
    ),
    prefix_columns: migrate_column_id_entries(
      migrate_dvoa_type_entries(
        migrate_entries_array(table_state.prefix_columns)
      )
    ),
    where: migrate_column_id_entries(
      migrate_dvoa_type_entries(migrate_entries_array(table_state.where))
    ),
    // `sort` carries a column_id too, so it has to follow the rename or a shared
    // link sorts on an id no column supplies.
    sort: migrate_column_id_entries(migrate_sort_array(table_state.sort)),
    row_axes: axes.row_axes,
    row_grain: axes.row_grain,
    q: table_state.q,
    rank_aggregation: table_state.rank_aggregation,
    scatter_plot_options: table_state.scatter_plot_options,
    disable_scatter_plot: table_state.disable_scatter_plot,
    view_id: view_fields.view_id,
    view_name: view_fields.view_name,
    view_description: view_fields.view_description,
    view_search_column_id: view_fields.view_search_column_id
  }
}
