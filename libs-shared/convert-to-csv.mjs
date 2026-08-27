const format_value = (value) => {
  if (value === null || value === undefined) {
    return ''
  }

  // Dates and JSON columns arrive as objects on the array input path but as
  // strings on the JSON input path; render both the same way so the two input
  // modes produce identical output.
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return String(value)
}

/**
 * Convert rows to CSV.
 *
 * Row 0 is the header object — a `{field: field}` map that both defines the
 * column set for every subsequent row and renders as the header line. Keys
 * present only in later rows are not emitted.
 *
 * @param {object[]|string} objArray - rows, or the JSON encoding of them
 * @returns {string} CSV text, CRLF terminated
 */
export default function (objArray) {
  const array = typeof objArray === 'string' ? JSON.parse(objArray) : objArray

  if (!array?.length) {
    return ''
  }

  const fields = Object.keys(array[0])

  let str = ''
  for (let i = 0; i < array.length; i++) {
    const cells = fields.map((field) => {
      let value = format_value(array[i][field])

      // Escape quotes and wrap in quotes if value contains comma, quote, or newline
      if (
        value.includes(',') ||
        value.includes('"') ||
        value.includes('\n') ||
        value.includes('\r')
      ) {
        value = '"' + value.replace(/"/g, '""') + '"'
      }

      return value
    })

    str += cells.join(',') + '\r\n'
  }

  return str
}
