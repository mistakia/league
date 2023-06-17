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

  // remove all characters except alpha, space or hyphen
  str = str.replace(/[^a-zA-Z -]/gi, '')

  return str.toLowerCase()
}
