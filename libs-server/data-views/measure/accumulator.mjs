// The closed accumulator vocabulary and its SQL rendering.
//
// An accumulator is one additive fact aggregation. A measure declares a set of
// them plus a combine applied strictly after accumulation, which is what makes
// a measure evaluable at any grain: accumulate over the facts the grain names,
// then combine. Everything that renders an aggregate for a measure comes
// through here, so the set cannot drift between the season render, the period
// CTE and the year-offset recombination.
//
// COUNT_DISTINCT IS NOT ADDITIVE IN GENERAL, and the contract admits it.
// Sum-of-per-partition-distinct equals distinct-over-the-union only when the
// distinct key is nested inside every partition boundary the measure will ever
// be evaluated at. That holds for the keys in use today because each is
// `esbid`-prefixed and every partition (game, season) is a coarsening of
// `esbid`. It does NOT hold for a key that spans partitions --
// `COUNT(DISTINCT opponent_nfl_team)` is expressible here and would be
// silently wrong summed across games. Declaring `count_distinct` is a claim
// that the key is partition-contained; check it before writing one.

export const AGGREGATES = Object.freeze(['sum', 'count', 'count_distinct'])

const VALID_AGGREGATES = new Set(AGGREGATES)

const RENDERERS = {
  sum: (expr) => `SUM(${expr})`,
  count: (expr) => `COUNT(${expr})`,
  count_distinct: (expr) => `COUNT(DISTINCT ${expr})`
}

// Throws on a malformed accumulator so a bad declaration fails at module load
// rather than emitting wrong SQL at query time. `label` names the measure and
// accumulator in the message, since a bare aggregate name identifies nothing.
export const validate_accumulator = ({ label, accumulator }) => {
  if (!accumulator || typeof accumulator !== 'object') {
    throw new Error(
      `accumulator: ${label} requires an object { aggregate, expr }`
    )
  }
  if (!VALID_AGGREGATES.has(accumulator.aggregate)) {
    throw new Error(
      `accumulator: ${label} has unknown aggregate '${accumulator.aggregate}' (expected ${AGGREGATES.join(' | ')})`
    )
  }
  if (typeof accumulator.expr !== 'string' || accumulator.expr.length === 0) {
    throw new Error(`accumulator: ${label} requires a non-empty string expr`)
  }
}

export const render_accumulator = ({ label = 'accumulator', accumulator }) => {
  validate_accumulator({ label, accumulator })
  return RENDERERS[accumulator.aggregate](accumulator.expr)
}

// Render every accumulator of a measure into a name -> SQL map, which is what
// a combine receives.
export const render_accumulators = ({ measure_name, accumulators }) => {
  const entries = Object.entries(accumulators || {})
  if (entries.length === 0) {
    throw new Error(
      `accumulator: ${measure_name} declares no accumulators; a measure requires at least one`
    )
  }
  return Object.fromEntries(
    entries.map(([name, accumulator]) => [
      name,
      render_accumulator({ label: `${measure_name}.${name}`, accumulator })
    ])
  )
}
