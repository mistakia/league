// The single site where a measure's combine is rendered, at any grain.
//
// It replaces five hand-written copies of the same ratio arithmetic that did
// not agree with each other: the display path emitted `NULLIF`, yielding NULL
// for a zero denominator, while two filter paths emitted
// `CASE WHEN den > 0 THEN ... ELSE 0 END` and answered zero for the same
// input. There is one answer here and it is NULL -- a player with no team
// targets did not have a 0% share.
//
// Two rules the emitter enforces rather than trusting each column to repeat:
//
//   - The numerator cast belongs at DIVISION SITES ONLY. `nfl_plays` counters
//     are `integer`/`smallint`, so `bigint / bigint` truncates (measured: 6
//     against a true 6.7498637602179837). An IDENTITY combine must therefore
//     emit today's bare `SUM(x)` -- casting blindly would move every additive
//     golden and false-trip the vocabulary checkpoint.
//   - A percentage scale sits to the LEFT of the division. `100.0 * num / den`
//     promotes to numeric before dividing; `100.0 * (num / den)` is integer
//     division and collapses the value to 0.

// Guarded division: NULL on a zero denominator, and numeric throughout.
//
// With `scale` the literal is numeric and promotes the quotient on its own, so
// no cast is emitted and the form matches the existing percentage renders byte
// for byte. Without one the numerator carries the `::decimal`.
export const guarded_divide = ({ numerator, denominator, scale = null }) => {
  const dividend =
    scale != null ? `${scale} * ${numerator}` : `${numerator}::decimal`
  return `${dividend} / NULLIF(${denominator}, 0)`
}

export const apply_decimals = ({ sql, decimals }) =>
  decimals != null ? `ROUND(${sql}, ${decimals})` : sql

// `combine` is `'identity'` or a function of the rendered accumulator map.
// Absence is NOT identity -- a misspelled key would otherwise fall through to
// identity, advertise a denominator vocabulary on a ratio column and emit
// wrong SQL with no throw anywhere.
export const validate_combine = ({ measure_name, combine, accumulators }) => {
  const names = Object.keys(accumulators || {})
  if (combine !== 'identity' && typeof combine !== 'function') {
    throw new Error(
      `combine: ${measure_name} must declare combine as 'identity' or a function`
    )
  }
  if (combine === 'identity' && names.length !== 1) {
    throw new Error(
      `combine: ${measure_name} declares an identity combine with ${names.length} accumulators; identity requires exactly one`
    )
  }
}

// Render the combine over a name -> SQL map of already-rendered accumulators.
// The map is what makes this grain-agnostic: the caller decides whether those
// fragments aggregate the whole scope, one period, or one offset window.
export const render_combine = ({
  measure_name,
  combine,
  accumulator_sql,
  decimals = null
}) => {
  validate_combine({ measure_name, combine, accumulators: accumulator_sql })

  if (combine === 'identity') {
    const [only] = Object.values(accumulator_sql)
    return apply_decimals({ sql: only, decimals })
  }

  const sql = combine(accumulator_sql, { divide: guarded_divide })
  if (typeof sql !== 'string' || sql.length === 0) {
    throw new Error(`combine: ${measure_name} combine returned no SQL fragment`)
  }
  return apply_decimals({ sql, decimals })
}
