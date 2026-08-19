// The measure contract for the stats-from-plays factories.
//
//     value(scope) = combine(accumulate(facts in scope))
//
// A column declares a set of additive accumulators plus a pure combine applied
// strictly after accumulation, and every downstream artifact derives from that
// one declaration: the season render (`with_select`), the numerator measure
// expression (`measure_expr`), the period-CTE aggregate selector, the
// advertised `supports_output`, the echoed `supports_periods`, and the
// rounding. Additivity is what makes a measure evaluable at any grain --
// accumulate over the facts the grain names, then combine -- which is why
// "sum of per-period ratios" is not expressible here rather than being
// prevented by a comment on each column that discovered it.
//
//   measure: {
//     accumulators: { <name>: { aggregate, expr } },
//     combine: 'identity' | (accumulator_sql, { divide }) => <sql fragment>,
//     decimals: <int | null>
//   }
//
// `combine` is REQUIRED and `'identity'` requires exactly one accumulator.
// Absence is not identity: a misspelled key would otherwise fall through,
// advertise a denominator vocabulary on a ratio column, and emit wrong SQL
// with nothing throwing.
//
// `decimals` defaults to null, and to 2 for a bare distinct count, whose RATE
// render is fractional. It does not round an integral SEASON render -- a count
// has nothing to round, and rounding one would move every distinct-count
// golden while changing no value.

import { render_accumulators, validate_accumulator } from './accumulator.mjs'
import { render_combine, validate_combine } from './combine.mjs'
import { derive_supports_output } from './capability.mjs'

const INTEGRAL_AGGREGATES = new Set(['count', 'count_distinct'])

// The aggregations the output-aggregator registry can actually serve today.
// `mean` joins this list when it is registered; capability derivation itself
// already offers it, so advertising is gated here rather than there.
const SERVEABLE_AGGREGATIONS = ['rate', 'count']

const assert_measure = ({ stat_name, measure }) => {
  if (!measure || typeof measure !== 'object') {
    throw new Error(
      `measure-contract: ${stat_name} requires a measure object { accumulators, combine }`
    )
  }
  const entries = Object.entries(measure.accumulators || {})
  if (entries.length === 0) {
    throw new Error(
      `measure-contract: ${stat_name} declares no accumulators; a measure requires at least one`
    )
  }
  for (const [name, accumulator] of entries) {
    validate_accumulator({ label: `${stat_name}.${name}`, accumulator })
  }
  validate_combine({
    measure_name: stat_name,
    combine: measure.combine,
    accumulators: measure.accumulators
  })
}

export const derive_measure = ({ stat_name, measure, supports_periods }) => {
  assert_measure({ stat_name, measure })

  const { accumulators, combine } = measure
  const entries = Object.entries(accumulators)
  const [sole_name, sole_accumulator] = entries.length === 1 ? entries[0] : []

  const decimals =
    measure.decimals != null
      ? measure.decimals
      : combine === 'identity' &&
          sole_accumulator?.aggregate === 'count_distinct'
        ? 2
        : null

  // An integral value has nothing to round at the season grain, whatever its
  // rate render does.
  const value_is_integral =
    combine === 'identity' &&
    INTEGRAL_AGGREGATES.has(sole_accumulator.aggregate)

  const accumulator_sql = render_accumulators({
    measure_name: stat_name,
    accumulators
  })

  const with_select = render_combine({
    measure_name: stat_name,
    combine,
    accumulator_sql,
    decimals: value_is_integral ? null : decimals
  })

  // The numerator measure expression is the accumulated fact expression, which
  // exists only where one accumulator carries the whole measure. A column with
  // a real combine supplies its own numerator handling. It ignores table_name
  // because the inner expression references `nfl_plays` columns
  // unambiguously; a column may still pass an explicit table-qualified
  // override, which the factory prefers over this default.
  const measure_expr = sole_name ? () => sole_accumulator.expr : null

  const aggregate = sole_accumulator ? sole_accumulator.aggregate : null

  const capability = derive_supports_output({
    denominator_unit_periods: ['game', ...supports_periods]
  })
  const supports_output = {
    periods: capability.periods,
    aggregations: capability.aggregations.filter((aggregation) =>
      SERVEABLE_AGGREGATIONS.includes(aggregation)
    )
  }

  return {
    with_select,
    measure_expr,
    aggregate,
    supports_output,
    supports_periods,
    decimals
  }
}
