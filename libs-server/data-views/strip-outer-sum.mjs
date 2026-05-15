// Outer-`SUM(...)` recognizer used by stats-from-plays column factories to
// auto-derive `measure_expr` from a `with_select_string`. Returns the inner
// expression when the string is a single outer `SUM(...)` form; returns null
// for ratios, AVGs, or any expression with trailing operators. The depth-
// counting pass after the regex guards against false matches like
// `SUM(x) + SUM(y)` where the regex's `.*` would greedily include the second
// SUM.
const strip_outer_call = (s, name) => {
  if (typeof s !== 'string') return null
  const re = new RegExp(`^${name}\\(([\\s\\S]*)\\)$`)
  const match = s.match(re)
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

export const strip_outer_sum = (with_select_string) => {
  const sum_inner = strip_outer_call(with_select_string, 'SUM')
  if (sum_inner !== null) return sum_inner
  // Recognize `COUNT(CASE WHEN <pred> THEN 1 ELSE NULL END)` as equivalent
  // to `SUM(CASE WHEN <pred> THEN 1 ELSE 0 END)`. The auto-derived inner
  // expression returned here keeps the same row-level semantics: 1 when
  // predicate holds, 0 otherwise. COUNT semantics over NULL also discard
  // the row from the count, which matches SUM-of-zero in the outer SUM
  // wrapper applied by build_period_cte.
  const count_inner = strip_outer_call(with_select_string, 'COUNT')
  if (count_inner !== null) {
    return count_inner.replace(/\bELSE\s+NULL\s+END\b/i, 'ELSE 0 END')
  }
  return null
}

// Translate the legacy `per_<period>` rate-type tokens into the canonical
// period names consumed by the output-aggregator registry.
export const derive_periods_from_rate_types = (rate_types) =>
  rate_types.map((t) => t.replace(/^per_/, ''))
