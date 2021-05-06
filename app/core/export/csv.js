/* global Blob */

function convertToCSV(objArray) {
  const array = typeof objArray !== 'object' ? JSON.parse(objArray) : objArray
  let str = ''

  for (let i = 0; i < array.length; i++) {
    let line = ''
    for (const index in array[i]) {
      if (line !== '') line += ','
      line += array[i][index]
    }
    str += line + '\r\n'
  }
  return str
}

export function csv({ headers, data, fileName = 'teflon-export.csv' }) {
  if (headers) {
    data.unshift(headers)
  }

  // Convert Object to JSON
  const jsonObject = JSON.stringify(data)
  const csv = convertToCSV(jsonObject)
  const exportedFilenmae = fileName + '.csv'
  const blob = new Blob([csv], { type: 'text/csvcharset=utf-8' })
  if (navigator.msSaveBlob) {
    // IE 10+
    navigator.msSaveBlob(blob, exportedFilenmae)
  } else {
    const link = document.createElement('a')
    if (link.download !== undefined) {
      // feature detection
      // Browsers that support HTML5 download attribute
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', exportedFilenmae)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }
}
