export default function (objArray) {
  const array = typeof objArray !== 'object' ? JSON.parse(objArray) : objArray

  if (!array.length) {
    return ''
  }

  let str = ''

  // Get the header from the first row (which should be the header object)
  const header = array[0]
  const fields = Object.keys(header)

  for (let i = 0; i < array.length; i++) {
    let line = ''
    for (const field of fields) {
      if (line !== '') line += ','

      // Handle values that might contain commas, quotes, or newlines
      let value = array[i][field]
      if (value === null || value === undefined) {
        value = ''
      } else {
        value = String(value)
        // Escape quotes and wrap in quotes if value contains comma, quote, or newline
        if (
          value.includes(',') ||
          value.includes('"') ||
          value.includes('\n') ||
          value.includes('\r')
        ) {
          value = '"' + value.replace(/"/g, '""') + '"'
        }
      }

      line += value
    }
    str += line + '\r\n'
  }
  return str
}
