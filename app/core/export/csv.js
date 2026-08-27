/* global Blob */

import { convert_to_csv } from '#libs-shared'

export function csv({ headers, data, fileName = 'xo-football-export.csv' }) {
  // `headers` maps a row key to the display text for its column, so it also
  // defines the column set and their order when present.
  const columns = headers
    ? Object.entries(headers).map(([key, header]) => ({ key, header }))
    : undefined
  const csv = convert_to_csv({ rows: data, columns })
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
