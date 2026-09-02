import * as table_constants from 'react-table/src/constants.mjs'

// Turn a sandboxed-SQL result envelope into the two things the client needs: a
// column descriptor per projected alias, and the FIRST table_state.
//
// THE SPLIT, and it is the whole design. Postgres already knows the alias, the
// projection order and the type; nothing knows the human title, the pinning
// intent or the width. So the derivable half is READ and the authored half is
// DECLARED, and the two may not overlap. Letting an author declare data_type
// freely would re-open the entire class of failure where a declared type
// disagrees with the column's real one and a number renders as text -- so a
// data_type annotation is admitted ONLY for an alias whose OID the type
// resolver could not bucket, and is a rejection anywhere else.
//
// RECONCILIATION IS TOTAL IN BOTH DIRECTIONS. An annotation naming an alias the
// statement does not project is a rejection, and so is a projected alias
// carrying no annotation. The alias contract in the SQL guard is what makes
// that possible: every projection is explicitly named, so there is no
// positional or generated alias for either side to disagree about.

const { TABLE_DATA_TYPES } = table_constants

// Width in pixels, by type. A number is right-aligned and short; text is the
// one that actually needs room. These are the FIRST widths -- resize is display
// state the user owns immediately after.
const DEFAULT_SIZE_BY_DATA_TYPE = new Map([
  [TABLE_DATA_TYPES.NUMBER, 70],
  [TABLE_DATA_TYPES.BOOLEAN, 70],
  [TABLE_DATA_TYPES.DATE, 110],
  [TABLE_DATA_TYPES.TEXT, 140],
  [TABLE_DATA_TYPES.JSON, 200]
])

const FALLBACK_SIZE = 140
const MIN_SIZE = 50
const MAX_SIZE = 400

// Exactly the keys an annotation may carry. Anything else is a rejection rather
// than an ignored key: an ignored key is how an author spends an afternoon
// wondering why their `sortable: false` did nothing.
const ANNOTATION_KEYS = new Set([
  'column_title',
  'header_label',
  'fixed',
  'size',
  'data_type'
])

export class QueryViewDerivationError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'QueryViewDerivationError'
    this.code = code
    // The socket only shows a message it is told is showable; without this an
    // authored refusal naming the offending alias is replaced by a generic
    // banner, which is the opposite of useful for the person who wrote the
    // annotation.
    this.is_invalid_request = true
  }
}

const reject = (code, message) => {
  throw new QueryViewDerivationError(code, message)
}

const KNOWN_DATA_TYPES = new Set(Object.values(TABLE_DATA_TYPES))

const resolve_size = ({ alias, annotation, data_type }) => {
  if (annotation.size === undefined) {
    return DEFAULT_SIZE_BY_DATA_TYPE.get(data_type) || FALLBACK_SIZE
  }
  const size = Number(annotation.size)
  if (!Number.isFinite(size) || size < MIN_SIZE || size > MAX_SIZE) {
    reject(
      'annotation_size_out_of_range',
      `column ${alias}: size must be between ${MIN_SIZE} and ${MAX_SIZE}, got ${annotation.size}`
    )
  }
  return size
}

const resolve_data_type = ({ alias, annotation, field }) => {
  if (!field.unbucketable) {
    // The resolver named a type, so an annotation here can only disagree with
    // Postgres. Rejecting is what makes "derive everything derivable" a rule
    // rather than a preference.
    if (annotation.data_type !== undefined) {
      reject(
        'annotation_declares_derivable_data_type',
        `column ${alias}: data_type is derived from the query (pg type '${field.pg_type_name}') and must not be declared`
      )
    }
    return field.data_type
  }

  if (annotation.data_type === undefined) {
    reject(
      'unbucketable_data_type_without_annotation',
      `column ${alias}: pg type '${field.pg_type_name}' (oid ${field.data_type_oid}) has no data_type mapping, so column_annotations must declare one`
    )
  }
  if (!KNOWN_DATA_TYPES.has(annotation.data_type)) {
    reject(
      'annotation_unknown_data_type',
      `column ${alias}: declared data_type ${annotation.data_type} is not a table data type`
    )
  }
  return annotation.data_type
}

/**
 * @param {object} opts
 * @param {Array<{ name: string, data_type: number|null, data_type_oid: number, pg_type_name: string, unbucketable?: boolean }>} opts.data_view_fields -
 *   the executor's resolved field descriptors, in projection order
 * @param {object} opts.column_annotations - per-alias authored block
 * @returns {{ columns: Array<object>, table_state_seed: object }}
 */
export default function derive_view_from_query_result({
  data_view_fields,
  column_annotations
}) {
  if (!Array.isArray(data_view_fields) || !data_view_fields.length) {
    reject(
      'no_projected_columns',
      'the statement projected no columns, so there is nothing to render'
    )
  }
  if (!column_annotations || typeof column_annotations !== 'object') {
    reject('missing_column_annotations', 'column_annotations is required')
  }

  const projected_aliases = data_view_fields.map((field) => field.name)

  // Duplicate aliases would collide in the row object AND make the annotation
  // lookup ambiguous, so they are refused here rather than resolved by a
  // last-one-wins that nobody chose.
  const seen = new Set()
  for (const alias of projected_aliases) {
    if (seen.has(alias)) {
      reject(
        'duplicate_projected_alias',
        `the statement projects ${alias} more than once`
      )
    }
    seen.add(alias)
  }

  for (const alias of Object.keys(column_annotations)) {
    if (!seen.has(alias)) {
      reject(
        'annotation_for_unprojected_alias',
        `column_annotations names ${alias}, which the statement does not project`
      )
    }
  }

  const columns = []
  const prefix_columns = []

  for (const field of data_view_fields) {
    const alias = field.name
    const annotation = column_annotations[alias]
    if (!annotation || typeof annotation !== 'object') {
      reject(
        'unannotated_projected_alias',
        `the statement projects ${alias}, which carries no column_annotations entry`
      )
    }

    for (const key of Object.keys(annotation)) {
      if (!ANNOTATION_KEYS.has(key)) {
        reject(
          'unknown_annotation_key',
          `column ${alias}: '${key}' is not an annotation key (${[...ANNOTATION_KEYS].join(', ')})`
        )
      }
    }

    if (!annotation.column_title) {
      reject(
        'annotation_missing_column_title',
        `column ${alias}: column_title is required -- nothing in the query can supply it`
      )
    }

    const data_type = resolve_data_type({ alias, annotation, field })

    columns.push({
      column_id: alias,
      // The table reads a cell as row.original[`${accessorKey}_${index}`]. An
      // ad-hoc alias is unique by the duplicate check above, so its index is
      // always 0 -- which is exactly why run-query-backed-view re-keys the rows
      // rather than teaching the table a second convention.
      accessorKey: alias,
      column_title: annotation.column_title,
      header_label: annotation.header_label || annotation.column_title,
      data_type,
      size: resolve_size({ alias, annotation, data_type }),
      pg_type_name: field.pg_type_name,
      // The marker every ad-hoc-column guard keys on. A registry column never
      // carries it, so a check for it cannot be confused by one.
      is_query_backed: true,
      ...(annotation.fixed ? { fixed: annotation.fixed } : {})
    })

    if (annotation.fixed) prefix_columns.push(alias)
  }

  return {
    columns,
    // The FIRST table_state and nothing more. sort, where, offset and limit are
    // deliberately empty: the moment this view is saved the user owns them, and
    // re-deriving them on reload is what silently resets a saved sort every
    // time the view is opened.
    table_state_seed: {
      columns: columns
        .filter((column) => !column.fixed)
        .map((column) => column.column_id),
      prefix_columns,
      sort: [],
      where: [],
      row_axes: [],
      row_grain: []
    }
  }
}
