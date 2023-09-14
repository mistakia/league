export default function (obj) {
  let k
  let cls = ''
  for (k in obj) {
    if (obj[k]) {
      cls && (cls += ' ')
      cls += k
    }
  }
  return cls
}
