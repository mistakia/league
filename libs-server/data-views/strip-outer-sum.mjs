// Outer-`SUM(...)` recognizer used by stats-from-plays column factories to
// auto-derive `measure_expr` from a `with_select_string`. Returns the inner
// expression when the string is a single outer `SUM(...)` form; returns null
// for ratios, AVGs, or any expression with trailing operators. The depth-
// counting pass after the regex guards against false matches like
// `SUM(x) + SUM(y)` where the regex's `.*` would greedily include the second
// SUM.
export const strip_outer_sum = (with_select_string) => {
  if (typeof with_select_string !== 'string') return null
  const match = with_select_string.match(/^SUM\(([\s\S]*)\)$/)
  if (!match) return null
  let depth = 0
  for (let i = 0; i < match[1].length; i++) {
    if (match[1][i] === '(') depth++
    else if (match[1][i] === ')') {
      if (depth === 0) return null
      depth--
    }
  }
  return depth === 0 ? match[1] : null
}

// Translate the legacy `per_<period>` rate-type tokens into the canonical
// period names consumed by the output-aggregator registry.
export const derive_periods_from_rate_types = (rate_types) =>
  rate_types.map((t) => t.replace(/^per_/, ''))
