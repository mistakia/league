import * as table_constants from 'react-table/src/constants.mjs'

// Derives the arguments `calculatePercentiles` needs from a plays view's
// table_state columns, for the cell background shading react-table applies.
//
// The keys are BARE column ids, and that is load-bearing. react-table's cell
// looks its percentile up under `${accessorKey}_${column_index}` only when the
// table sets `enable_duplicate_column_ids`; otherwise it uses the bare
// `accessorKey` (node_modules/react-table/src/table-cell/table-cell.js). The
// data-views page sets that flag and so builds suffixed keys; no plays table
// does, so a key built the data-views way matches nothing, shades no cell, and
// raises nothing. Every plays field's accessorKey is its column_id, stamped
// unconditionally in app/core/plays-view-fields/index.js.
//
// A consequence of the bare key: two instances of the same column with
// different params share one entry, so the first instance's
// `reverse_percentiles` decides the shading direction for both. That is
// inherent to the un-suffixed lookup rather than a choice made here.
export default function derive_plays_percentile_stats({
  table_state_columns = [],
  plays_view_fields
}) {
  const seen_column_ids = new Set()
  const percentile_stat_keys = []
  const reverse_percentile_stats = {}

  for (const column of table_state_columns) {
    const column_id = typeof column === 'string' ? column : column.column_id
    const column_params = typeof column === 'string' ? {} : column.params || {}
    const field = plays_view_fields[column_id]

    // An unregistered column id cannot carry a percentile. The data-views
    // equivalent reports one to bugsnag because a rename there can strand a
    // saved view; the plays registry has no rename path to strand one.
    if (!field) continue

    if (field.data_type !== table_constants.TABLE_DATA_TYPES.NUMBER) continue

    // Identifiers and calendar ordinals are numbers that carry no magnitude,
    // so a percentile over them is noise rather than signal.
    if (field.disable_percentiles) continue

    if (seen_column_ids.has(column_id)) continue
    seen_column_ids.add(column_id)

    percentile_stat_keys.push(column_id)

    const is_reversed =
      typeof field.reverse_percentiles === 'function'
        ? field.reverse_percentiles(column_params)
        : field.reverse_percentiles

    if (is_reversed) {
      reverse_percentile_stats[column_id] = true
    }
  }

  return { percentile_stat_keys, reverse_percentile_stats }
}
