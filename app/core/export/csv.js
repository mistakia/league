/* global Blob */

import { convert_to_csv } from '@libs-shared'

export function csv({ headers, data, fileName = 'xo-football-export.csv' }) {
  if (headers) {
    data.unshift(headers)
  }

  // Convert Object to JSON
  const jsonObject = JSON.stringify(data)
  const csv = convert_to_csv(jsonObject)
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
