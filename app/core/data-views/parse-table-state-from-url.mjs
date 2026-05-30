import { parse_url_params_to_table_state } from 'react-table/src/utils/parse-url-params-to-table-state.mjs'

import {
  migrate_entries_array,
  migrate_sort_array
} from '#libs-shared/data-views-nfl-week-migration.mjs'

export default function parse_table_state_from_url(search_params) {
  const { table_state, view_fields } =
    parse_url_params_to_table_state(search_params)

  return {
    columns: migrate_entries_array(table_state.columns),
    prefix_columns: migrate_entries_array(table_state.prefix_columns),
    where: migrate_entries_array(table_state.where),
    sort: migrate_sort_array(table_state.sort),
    splits: table_state.splits,
    // Legacy ?subjects= back-compat: new ?row_grain= wins; fall back to
    // legacy if present; default to ['player'] otherwise. Carry both names
    // through one release cycle then drop the subjects branch.
    row_grain:
      Array.isArray(table_state.row_grain) && table_state.row_grain.length
        ? table_state.row_grain
        : Array.isArray(table_state.subjects) && table_state.subjects.length
          ? table_state.subjects
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
