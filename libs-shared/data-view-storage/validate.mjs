// Single source of table_state validity for the data-view storage subsystem.
// Consumed by storage.mjs (write gate), the data-views reducer
// (DATA_VIEW_CHANGED guard), and sagas (read-path guard).

export const is_valid_table_state = (table_state) => {
  if (!table_state || typeof table_state !== 'object') return false
  if (!Array.isArray(table_state.columns)) return false
  if (!Array.isArray(table_state.prefix_columns)) return false
  return table_state.columns.length > 0 || table_state.prefix_columns.length > 0
}

export const is_empty_new_view = (table_state) =>
  Boolean(table_state) &&
  typeof table_state === 'object' &&
  Array.isArray(table_state.columns) &&
  table_state.columns.length === 0
