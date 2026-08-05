import { parse_url_params_to_table_state } from 'react-table/src/utils/parse-url-params-to-table-state.mjs'

import {
  migrate_entries_array,
  migrate_sort_array
} from '#libs-shared/data-views-nfl-week-migration.mjs'

// `splits` is the pre-rename spelling of `row_axes` and is a permanent legacy
// alias: shared short URLs cannot be rewritten, and 188 of the 682 production
// data-view URLs carry a non-empty `splits` while none carry both keys. A URL
// whose axes are dropped here renders at the wrong grain silently, and when the
// lost axis is `week` a sort on it also emits an unreachable reference.
const parse_legacy_splits = (search_params) => {
  const raw = search_params.get('splits')
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    return []
  }
}

export default function parse_table_state_from_url(search_params) {
  const { table_state, view_fields } =
    parse_url_params_to_table_state(search_params)

  // The schema-driven parser fabricates `[]` for an absent `row_axes`, so an
  // empty value is indistinguishable from a missing one -- and both defer to
  // `splits` without ambiguity, since no URL carries a non-empty pair.
  const row_axes = table_state.row_axes?.length
    ? table_state.row_axes
    : parse_legacy_splits(search_params)

  return {
    columns: migrate_entries_array(table_state.columns),
    prefix_columns: migrate_entries_array(table_state.prefix_columns),
    where: migrate_entries_array(table_state.where),
    sort: migrate_sort_array(table_state.sort),
    row_axes,
    row_grain:
      Array.isArray(table_state.row_grain) && table_state.row_grain.length
        ? table_state.row_grain
        : ['player'],
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
