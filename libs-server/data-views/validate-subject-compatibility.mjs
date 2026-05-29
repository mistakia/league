import derive_column_subjects from './derive-column-subjects.mjs'

// Runtime check: every column_id referenced by prefix_columns, columns, or
// where must declare compatibility with the active subject. A def with no
// derivable subjects (no explicit `subjects`, no grain) is treated as
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

const check_item = ({ item, field, subject, defs, errors }) => {
  const column_id = item_column_id(item)
  if (!column_id) return
  const def = defs[column_id]
  if (!def) return
  const allowed = derive_column_subjects(def)
  if (!allowed.length) return
  if (allowed.includes(subject)) return
  errors.push(
    `ColumnSubjectMismatch: column '${column_id}' (${field}) requires subject ` +
      `${JSON.stringify(allowed)} but active subject is '${subject}'`
  )
}

export default function validate_subject_compatibility({
  subjects = ['player'],
  prefix_columns = [],
  columns = [],
  where = [],
  defs
}) {
  const subject = subjects[0]
  const errors = []
  prefix_columns.forEach((item, i) =>
    check_item({ item, field: `prefix_columns[${i}]`, subject, defs, errors })
  )
  columns.forEach((item, i) =>
    check_item({ item, field: `columns[${i}]`, subject, defs, errors })
  )
  where.forEach((item, i) =>
    check_item({ item, field: `where[${i}]`, subject, defs, errors })
  )
  return errors
}
