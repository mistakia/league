// v2 -> v3: rename table_state.subjects -> table_state.row_grain. The data
// shape is unchanged; only the key name changes. Saved views authored under
// the older `subjects` vocabulary continue to load and surface under the
// unified `row_grain` name.

export const migrate_table_state = (table_state) => {
  if (!table_state || typeof table_state !== 'object') {
    return { changed: false, table_state }
  }
  if (!Object.prototype.hasOwnProperty.call(table_state, 'subjects')) {
    return { changed: false, table_state }
  }
  const { subjects, ...rest } = table_state
  return {
    changed: true,
    table_state: { ...rest, row_grain: subjects }
  }
}
