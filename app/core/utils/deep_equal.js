// Plain-JS structural equality. The data-view selectors and the restore-
// dispatch-suppression check need to compare plain-JS table_state objects
// (see reducer.js:9-10 plain-JS comment); Immutable.is would be wrong.

const deep_equal = (a, b) => {
  if (a === b) return true
  if (a == null || b == null) return a === b
  if (typeof a !== typeof b) return false
  if (typeof a !== 'object') return false

  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return false
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!deep_equal(a[i], b[i])) return false
    }
    return true
  }
  if (Array.isArray(b)) return false

  const keys_a = Object.keys(a)
  const keys_b = Object.keys(b)
  if (keys_a.length !== keys_b.length) return false
  for (const key of keys_a) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false
    if (!deep_equal(a[key], b[key])) return false
  }
  return true
}

export default deep_equal
