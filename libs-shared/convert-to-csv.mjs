const format_value = (value) => {
  if (value === null || value === undefined) {
    return ''
  }

  // Dates and JSON columns arrive as objects from knex but as plain values once
  // a row has been through a normalizer; render both the same way so every
  // caller produces identical output for the same underlying cell.
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return String(value)
}

const render_cell = (value) => {
  const formatted = format_value(value)

  // Escape quotes and wrap in quotes if value contains comma, quote, or newline
  if (
    formatted.includes(',') ||
    formatted.includes('"') ||
    formatted.includes('\n') ||
    formatted.includes('\r')
  ) {
    return '"' + formatted.replace(/"/g, '""') + '"'
  }

  return formatted
}

const render_row = (values) => values.map(render_cell).join(',') + '\r\n'

const resolve_columns = ({ rows, columns }) => {
  const specs = columns ?? Object.keys(rows[0])

  return specs.map((spec) =>
    typeof spec === 'string' ? { key: spec, header: spec } : spec
  )
}

/**
 * Convert rows to CSV, header line included.
 *
 * @param {object} params
 * @param {object[]} params.rows - one object per data row
 * @param {(string | {key: string, header: string})[]} [params.columns] - the
 *   ordered column set. A bare string names a column whose header text is its
 *   own key; the object form carries a display header that differs from the
 *   key. Defaults to the keys of the first row. A key absent from a row renders
 *   as an empty cell.
 * @returns {string} CSV text, CRLF terminated, empty when there are no rows
 */
export default function convert_to_csv({ rows, columns }) {
  if (!rows?.length) {
    return ''
  }

  const resolved_columns = resolve_columns({ rows, columns })

  let str = render_row(resolved_columns.map(({ header }) => header))
  for (const row of rows) {
    str += render_row(resolved_columns.map(({ key }) => row[key]))
  }

  return str
}
