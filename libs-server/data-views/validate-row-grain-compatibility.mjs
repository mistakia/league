import derive_column_row_grains from './derive-column-row-grains.mjs'

// Runtime check: every column_id referenced by prefix_columns, columns, or
// where must declare compatibility with the active row_grain. A def with no
// derivable row_grains (no explicit `row_grains`, no grain) is treated as
// compatible -- the column-coverage spec is the gate for missing
// declarations, not the runtime path.
//
// Returns an array of error message strings (empty on success), matching
// the shape produced by table_state_validator's failure branch so the
// caller can merge them into a single thrown error.

const item_column_id = (item) => {
  if (typeof item === 'string') return item
  if (item && typeof item === 'object') return item.column_id
  return null
}

const check_item = ({ item, field, row_grain_id, defs, errors }) => {
  const column_id = item_column_id(item)
  if (!column_id) return
  const def = defs[column_id]
  if (!def) return
  const allowed = derive_column_row_grains(def)
  if (!allowed.length) return
  if (allowed.includes(row_grain_id)) return
  errors.push(
    `ColumnRowGrainMismatch: column '${column_id}' (${field}) requires row_grain ` +
      `${JSON.stringify(allowed)} but active row_grain is '${row_grain_id}'`
  )
}

export default function validate_row_grain_compatibility({
  row_grain = ['player'],
  prefix_columns = [],
  columns = [],
  where = [],
  defs
}) {
  const row_grain_id = row_grain[0]
  const errors = []
  prefix_columns.forEach((item, i) =>
    check_item({
      item,
      field: `prefix_columns[${i}]`,
      row_grain_id,
      defs,
      errors
    })
  )
  columns.forEach((item, i) =>
    check_item({ item, field: `columns[${i}]`, row_grain_id, defs, errors })
  )
  where.forEach((item, i) =>
    check_item({ item, field: `where[${i}]`, row_grain_id, defs, errors })
  )
  return errors
}
