export default function (str) {
  if (typeof str !== 'string') {
    return null
  }

  // squish internal whitespace
  str = str.replace(/\s+/gi, ' ')

  // trim whitespace
  str = str.replace(/^\s|\s$/gi, '')

  // suffix removal
  str = str.replace(/ Jr[.]?$| Sr[.]?$| III$| II$| IV$| V$|'|\.|,/gi, '')

  return str.toLowerCase()
}
